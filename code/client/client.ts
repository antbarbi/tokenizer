import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';


// Add this helper function
async function accountExists(address: PublicKey): Promise<boolean> {
  const provider = anchor.AnchorProvider.env();
  try {
    const account = await provider.connection.getAccountInfo(address);
    return account !== null;
  } catch (error) {
    return false;
  }
}

// client.ts
async function main() {
  // Initialize provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Your program ID from declare_id!()
  // const programId = new PublicKey("FaHQQcpF2YyJ8LBjJ2svXcNRRgWeAgy9LLk1fzHvTXza");
  const programId = pg.PROGRAM_ID
  const program = anchor.workspace.TokenProgram;

  const wallet = provider.wallet;
  console.log("Main wallet public key:", wallet.publicKey.toString());
  
  // Create a second wallet to demonstrate transfers
  const secondWalletSeed = new Uint8Array(32).fill(1); // Simple seed for testing
  const secondWallet = Keypair.fromSeed(secondWalletSeed);
  console.log("Second wallet public key:", secondWallet.publicKey.toString());

  try {
    // 1. DERIVE MINT PDA (keep this the same)
    const [mintPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_mint"), wallet.publicKey.toBuffer()],
      programId
    );
    console.log("Mint PDA:", mintPDA.toString());
    
    // 2. CREATE MINT (keep this the same)
    const mintExists = await accountExists(mintPDA);
    if (!mintExists) {
      console.log("Creating mint...");
      await program.methods
        .createMint(9)
        .accounts({
          mint: mintPDA,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log("Mint created successfully");
    } else {
      console.log("Mint already exists");
    }
    
    // 3. DERIVE ATA ADDRESSES (REPLACE PDA derivation)
    const tokenAccount1ATA = getAssociatedTokenAddressSync(
      mintPDA,
      wallet.publicKey
    );
    console.log("First Token Account ATA:", tokenAccount1ATA.toString());
    
    const tokenAccount2ATA = getAssociatedTokenAddressSync(
      mintPDA,
      secondWallet.publicKey
    );
    console.log("Second Token Account ATA:", tokenAccount2ATA.toString());
    
    // 4. CREATE FIRST TOKEN ACCOUNT
    const token1Exists = await accountExists(tokenAccount1ATA);
    if (!token1Exists) {
      console.log("Creating first token account...");
      await program.methods
        .createTokenAccount()
        .accounts({
          tokenAccount: tokenAccount1ATA,
          mint: mintPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("First token account created");
    } else {
      console.log("First token account already exists");
    }
    
    // 5. FUND SECOND WALLET (keep this the same)
    const transferSolTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: secondWallet.publicKey,
        lamports: 10000000,
      })
    );
    await provider.sendAndConfirm(transferSolTx);
    console.log("Funded second wallet with SOL");
    
    // 6. CREATE SECOND TOKEN ACCOUNT
    const token2Exists = await accountExists(tokenAccount2ATA);
    if (!token2Exists) {
      console.log("Creating second token account...");
      await program.methods
        .createTokenAccount()
        .accounts({
          tokenAccount: tokenAccount2ATA,
          mint: mintPDA,
          owner: secondWallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([secondWallet])
        .rpc();
      console.log("Second token account created");
    } else {
      console.log("Second token account already exists");
    }

// 7. MINT TOKENS (update account addresses)
    const mintAmount = new anchor.BN(1000000000); // 1 token with 9 decimals
    console.log("Minting tokens to first account...");
    await program.methods
      .mintTokens(mintAmount)
      .accounts({
        mint: mintPDA,
        tokenAccount: tokenAccount1ATA,
        mintAuthority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // 8. INITIAL BALANCES
    let tokenAccount1 = await getAccount(provider.connection, tokenAccount1ATA, 'confirmed');
    let tokenAccount2 = await getAccount(provider.connection, tokenAccount2ATA, 'confirmed');

    console.log("BEFORE TRANSFER:");
    console.log("Account 1:", Number(tokenAccount1.amount) / Math.pow(10, 9), "tokens");
    console.log("Account 2:", Number(tokenAccount2.amount) / Math.pow(10, 9), "tokens");

    // 9. TRANSFER TOKENS
    const transferAmount = new anchor.BN(500000000); // 0.5 tokens
    console.log("\nTransferring 0.5 tokens...");
    await program.methods
      .transferTokens(transferAmount)
      .accounts({
        source: tokenAccount1ATA,
        destination: tokenAccount2ATA,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // 10. FINAL BALANCES
    tokenAccount1 = await getAccount(provider.connection, tokenAccount1ATA, 'confirmed');
    tokenAccount2 = await getAccount(provider.connection, tokenAccount2ATA, 'confirmed');

    console.log("\nAFTER TRANSFER:");
    console.log("Account 1:", Number(tokenAccount1.amount) / Math.pow(10, 9), "tokens");
    console.log("Account 2:", Number(tokenAccount2.amount) / Math.pow(10, 9), "tokens");

  } catch (error) {
    console.error("Error:", error);
  }
}

main();