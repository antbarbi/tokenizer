import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';

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
    const accountExists = async (pubkey) => {
      try {
        const accountInfo = await provider.connection.getAccountInfo(pubkey);
        return accountInfo !== null;
      } catch (e) {
        return false;
      }
    };

    // 1. DERIVE MINT PDA
    const [mintPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_mint"), wallet.publicKey.toBuffer()],
      programId
    );
    console.log("Mint PDA:", mintPDA.toString());
    
    // 2. CREATE MINT
    const mintExists = await accountExists(mintPDA);
    if (!mintExists) {
      console.log("Creating mint...");
      await program.methods
        .createMint(9) // 9 decimals
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
      console.log("Mint already exists, skipping creation");
    }
    
    // 3. DERIVE FIRST TOKEN ACCOUNT PDA (for main wallet)
    const [tokenAccount1PDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        wallet.publicKey.toBuffer(),
        mintPDA.toBuffer()
      ],
      programId
    );
    console.log("First Token Account PDA:", tokenAccount1PDA.toString());
    
    // 4. CREATE FIRST TOKEN ACCOUNT
    const token1Exists = await accountExists(tokenAccount1PDA);
    if (!token1Exists) {
      console.log("Creating first token account...");
      await program.methods
        .createTokenAccount()
        .accounts({
          tokenAccount: tokenAccount1PDA,
          mint: mintPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } else {
      console.log("First token account already exists, skipping creation");
    }

    
    // 5. DERIVE SECOND TOKEN ACCOUNT PDA (for second wallet)
    const [tokenAccount2PDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_account"),
        secondWallet.publicKey.toBuffer(),
        mintPDA.toBuffer()
      ],
      programId
    );
    console.log("Second Token Account PDA:", tokenAccount2PDA.toString());
    
    // 6. CREATE SECOND TOKEN ACCOUNT
    // Need to fund second wallet with a small amount of SOL for rent
    const transferSolTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: secondWallet.publicKey,
        lamports: 10000000, // 0.01 SOL
      })
    );
    await provider.sendAndConfirm(transferSolTx);
    console.log("Funded second wallet with SOL");
    
    const token2Exists = await accountExists(tokenAccount2PDA);
    if (!token2Exists) {
      console.log("Creating second token account...");
      await program.methods
        .createTokenAccount()
        .accounts({
          tokenAccount: tokenAccount2PDA,
          mint: mintPDA,
          owner: secondWallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([secondWallet])
        .rpc();
    } else {
      console.log("Second token account already exists, skipping creation");
    }

    // Fetch token account information BEFORE displaying balances
    let tokenAccount1 = await getAccount(
      provider.connection, 
      tokenAccount1PDA,
      'confirmed'
    );
    let tokenAccount2 = await getAccount(
      provider.connection, 
      tokenAccount2PDA,
      'confirmed'
    );

    console.log("First token account balance:", 
      tokenAccount1.amount.toString() / Math.pow(10, 9), "tokens");
    console.log("Second token account balance:", 
      tokenAccount2.amount.toString() / Math.pow(10, 9), "tokens");


    // 7. MINT TOKENS TO FIRST ACCOUNT
    const mintAmount = new anchor.BN(1000000000); // 1 token with 9 decimals
    console.log("Minting tokens to first account...");
    await program.methods
      .mintTokens(mintAmount)
      .accounts({
        mint: mintPDA,
        tokenAccount: tokenAccount1PDA,
        mintAuthority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    tokenAccount1 = await getAccount(
      provider.connection, 
      tokenAccount1PDA,
      'confirmed'
    );
    tokenAccount2 = await getAccount(
      provider.connection, 
      tokenAccount2PDA,
      'confirmed'
    );

    console.log("First token account balance:", 
      tokenAccount1.amount.toString() / Math.pow(10, 9), "tokens");
    console.log("Second token account balance:", 
      tokenAccount2.amount.toString() / Math.pow(10, 9), "tokens");

    // 8. TRANSFER TOKENS FROM FIRST TO SECOND ACCOUNT
    try {
      const transferAmount = new anchor.BN(500000000); // 0.5 tokens
      console.log("Transferring tokens from first to second account...");
      const tx = await program.methods
        .transferTokens(transferAmount)
        .accounts({
          source: tokenAccount1PDA,
          destination: tokenAccount2PDA,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: 'confirmed' });
      console.log("Transfer transaction signature:", tx);
      
      // Wait a moment for the transaction to be fully processed
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: tx
      });
      
    } catch (error) {
      console.error("Transfer failed with error:", error);
    }
    
    // 9. DISPLAY TOKEN BALANCES
    tokenAccount1 = await getAccount(
      provider.connection, 
      tokenAccount1PDA,
      'confirmed'
    );
    tokenAccount2 = await getAccount(
      provider.connection, 
      tokenAccount2PDA,
      'confirmed'
    );

    console.log("First token account balance:", 
      tokenAccount1.amount.toString() / Math.pow(10, 9), "tokens");
    console.log("Second token account balance:", 
      tokenAccount2.amount.toString() / Math.pow(10, 9), "tokens");

  } catch (error) {
    console.error("Error:", error);
  }
}

main();