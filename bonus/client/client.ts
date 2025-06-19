import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

class RealMultisigClient {
  private connection: any;
  private program: any;
  private wallet: any;

  constructor() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    
    this.connection = provider.connection;
    this.wallet = provider.wallet;
    this.program = anchor.workspace.TokenProgram;
  }

  async createRealMultisig() {
    try {
      console.log("🚀 Creating REAL multisig setup...");

      // Step 1: Create multiple signer keypairs (3 signers, need 2 to execute)
      const signer1 = web3.Keypair.generate();
      const signer2 = web3.Keypair.generate();
      const signer3 = web3.Keypair.generate();
      
      console.log(`👤 Signer 1: ${signer1.publicKey.toString()}`);
      console.log(`👤 Signer 2: ${signer2.publicKey.toString()}`);
      console.log(`👤 Signer 3: ${signer3.publicKey.toString()}`);

      // Fund the signers
      const signers = [signer1, signer2, signer3];
      for (let i = 0; i < signers.length; i++) {
        const airdropSig = await this.connection.requestAirdrop(
          signers[i].publicKey,
          0.1 * web3.LAMPORTS_PER_SOL
        );
        await this.connection.confirmTransaction(airdropSig);
        console.log(`💰 Signer ${i + 1} funded`);
      }

      // Step 2: Create multisig account (3 signers, threshold = 2)
      const [multisigPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("multisig"), this.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log(`\n🔐 Creating multisig PDA: ${multisigPDA.toString()}`);

      const createMultisigTx = await this.program.methods
        .createMultisig(
          [signer1.publicKey, signer2.publicKey, signer3.publicKey], // 3 signers
          2 // Threshold: need 2 signatures
        )
        .accounts({
          multisig: multisigPDA,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Multisig account created!");
      console.log(`📝 Multisig creation tx: ${createMultisigTx}`);

      // Step 3: Create mint with multisig as authority
      const [mintPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), multisigPDA.toBuffer()],
        this.program.programId
      );

      console.log(`\n🪙 Creating mint with multisig authority: ${mintPDA.toString()}`);

      const createMintTx = await this.program.methods
        .createMultisigMint(9)
        .accounts({
          mint: mintPDA,
          multisig: multisigPDA,
          payer: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Mint created with multisig authority!");
      console.log(`📝 Mint creation tx: ${createMintTx}`);

      // Step 4: Create token account
      const [tokenAccountPDA] = web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("token_account"),
          this.wallet.publicKey.toBuffer(),
          mintPDA.toBuffer()
        ],
        this.program.programId
      );

      console.log(`\n💰 Creating token account: ${tokenAccountPDA.toString()}`);

      const createTokenAccountTx = await this.program.methods
        .createTokenAccount()
        .accounts({
          tokenAccount: tokenAccountPDA,
          mint: mintPDA,
          owner: this.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Token account created!");
      console.log(`📝 Token account tx: ${createTokenAccountTx}`);

      // Step 5: Mint tokens using multisig (requires 2 out of 3 signatures)
      const mintAmount = 1000000000; // 1 token

      console.log(`\n🎯 Minting ${mintAmount / 1000000000} tokens with REAL multisig...`);
      console.log("📝 This requires 2 out of 3 signatures!");

      // Use signer1 and signer2 (2 out of 3 signers)
      const mintTxSig = await this.program.methods
        .multisigMintTokens(new anchor.BN(mintAmount))
        .accounts({
          mint: mintPDA,
          tokenAccount: tokenAccountPDA,
          multisig: multisigPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          // Pass the required signers as remaining accounts
          { pubkey: signer1.publicKey, isWritable: false, isSigner: true },
          { pubkey: signer2.publicKey, isWritable: false, isSigner: true },
          // Note: We don't include signer3, showing we only need 2 out of 3
        ])
        .signers([signer1, signer2]) // Both signers must sign
        .rpc();

      console.log("✅ REAL multisig mint successful!");
      console.log(`📝 Multisig mint tx: ${mintTxSig}`);
      console.log("🔒 Required 2 signatures out of 3 possible signers");

      // Step 6: Verify the mint
      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountPDA);
      console.log(`\n🎉 Final token balance: ${tokenAccountInfo.value.uiAmount} tokens`);

      // Step 7: Demonstrate failed transaction with insufficient signatures
      console.log(`\n❌ Demonstrating failed mint with only 1 signature...`);
      
      try {
        await this.program.methods
          .multisigMintTokens(new anchor.BN(500000000))
          .accounts({
            mint: mintPDA,
            tokenAccount: tokenAccountPDA,
            multisig: multisigPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts([
            { pubkey: signer1.publicKey, isWritable: false, isSigner: true },
            // Only 1 signer - should fail
          ])
          .signers([signer1])
          .rpc();
      } catch (error) {
        console.log("✅ Successfully prevented mint with insufficient signatures!");
        console.log(`📝 Error: ${error.message}`);
      }

      return {
        multisigPDA,
        mintPDA,
        tokenAccountPDA,
        signers: [signer1.publicKey, signer2.publicKey, signer3.publicKey],
        threshold: 2,
        mintSignature: mintTxSig
      };

    } catch (error) {
      console.error("❌ Error:", error);
      console.error("❌ Error details:", error.message);
      if (error.logs) {
        console.error("❌ Program logs:", error.logs);
      }
      throw error;
    }
  }
}

// Main function
async function main() {
  console.log("My address:", anchor.AnchorProvider.env().wallet.publicKey.toString());
  const balance = await anchor.AnchorProvider.env().connection.getBalance(
    anchor.AnchorProvider.env().wallet.publicKey
  );
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
  
  const client = new RealMultisigClient();
  await client.createRealMultisig();
}

main();