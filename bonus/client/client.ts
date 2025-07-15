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
      console.log("🚀 Creating REAL multisig setup with Playground wallets...");

      // Step 1: Use Solana Playground wallets as signers
      const signer1 = pg.wallets.wallet1.keypair; // Access wallet1 from Playground
      const signer2 = pg.wallets.wallet2.keypair; // Access wallet2 from Playground  
      const signer3 = pg.wallets.wallet3.keypair; // Access wallet3 from Playground
      
      console.log(`👤 Signer Wallet 1: ${signer1.publicKey.toString()}`);
      console.log(`👤 Signer Wallet 2: ${signer2.publicKey.toString()}`);
      console.log(`👤 Signer Wallet 3: ${signer3.publicKey.toString()}`);

      // Fund the signer wallets
      const signers = [signer1, signer2, signer3];
      for (let i = 0; i < signers.length; i++) {
        try {
          const airdropSig = await this.connection.requestAirdrop(
            signers[i].publicKey,
            0.1 * web3.LAMPORTS_PER_SOL
          );
          await this.connection.confirmTransaction(airdropSig);
          console.log(`💰 Signer Wallet ${i + 1} funded`);
        } catch (error) {
          console.log(`⚠️ Wallet ${i + 1} airdrop failed (might already have funds)`);
        }
      }

      // Step 2: Handle multisig account (reuse if exists, create if not)
      const [multisigPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("multisig"), this.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log(`\n🔐 Multisig PDA: ${multisigPDA.toString()}`);

      let existingSigners = null;
      let createMultisigTx = null;

      // Check if multisig already exists and compare with our wallets
      try {
        const existingMultisig = await this.program.account.multisig.fetch(multisigPDA);
        console.log("⚠️ Multisig already exists, checking if our wallets match...");
        console.log(`📋 Existing signers: ${existingMultisig.signers.length}, threshold: ${existingMultisig.threshold}`);
        
        existingSigners = existingMultisig.signers;
        const currentSigners = [signer1.publicKey, signer2.publicKey, signer3.publicKey];
        
        // Check if our playground wallets match the existing multisig
        const signersMatch = existingSigners.every((existingSigner, index) => 
          existingSigner.toString() === currentSigners[index].toString()
        );
        
        if (signersMatch) {
          console.log("✅ Our playground wallets match the existing multisig!");
          console.log(`👤 Wallet 1: ${existingSigners[0].toString()}`);
          console.log(`👤 Wallet 2: ${existingSigners[1].toString()}`);
          console.log(`👤 Wallet 3: ${existingSigners[2].toString()}`);
          existingSigners = null; // Treat as new so we can use our wallets
        } else {
          console.log("❌ Our playground wallets don't match existing multisig");
          console.log("📋 Existing multisig signers:");
          existingSigners.forEach((signer, index) => {
            console.log(`👤 Existing signer ${index + 1}: ${signer.toString()}`);
          });
          console.log("🔄 Current playground wallets:");
          currentSigners.forEach((signer, index) => {
            console.log(`👤 Playground wallet ${index + 1}: ${signer.toString()}`);
          });
        }
        
      } catch (error) {
        // Account doesn't exist, create it
        console.log("🔐 Creating new multisig with playground wallets...");
        createMultisigTx = await this.program.methods
          .createMultisig(
            [signer1.publicKey, signer2.publicKey, signer3.publicKey], // 3 wallets
            2 // Threshold: need 2 signatures
          )
          .accounts({
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();

        console.log("✅ Multisig account created with playground wallets!");
        console.log(`📝 Multisig creation tx: ${createMultisigTx}`);
      }

      // Step 3: Create mint with multisig as authority
      const [mintPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), multisigPDA.toBuffer()],
        this.program.programId
      );

      console.log(`\n🪙 Creating mint with multisig authority: ${mintPDA.toString()}`);

      let createMintTx = null;
      try {
        const existingMint = await this.connection.getAccountInfo(mintPDA);
        if (existingMint) {
          console.log("⚠️ Mint already exists, skipping creation...");
          console.log(`🪙 Existing mint: ${mintPDA.toString()}`);
          createMintTx = "EXISTING_MINT";
        } else {
          throw new Error("Mint doesn't exist");
        }
      } catch (error) {
        console.log("🪙 Creating new mint...");
        createMintTx = await this.program.methods
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
      }

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

      let createTokenAccountTx = null;
      try {
        const existingTokenAccount = await this.connection.getAccountInfo(tokenAccountPDA);
        if (existingTokenAccount) {
          console.log("⚠️ Token account already exists, skipping creation...");
          console.log(`💰 Existing token account: ${tokenAccountPDA.toString()}`);
          createTokenAccountTx = "EXISTING_TOKEN_ACCOUNT";
        } else {
          throw new Error("Token account doesn't exist");
        }
      } catch (error) {
        console.log("💰 Creating new token account...");
        createTokenAccountTx = await this.program.methods
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
      }

      // Step 5: Perform multisig operations if we have matching wallets
      if (!existingSigners) {
        await this.performMultisigMinting(mintPDA, tokenAccountPDA, multisigPDA, signer1, signer2, signer3);
      } else {
        console.log("\n⚠️ Skipping minting demo - playground wallets don't match existing multisig");
        console.log("💡 Use matching wallets or create new multisig with different payer");
        
        try {
          const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountPDA);
          console.log(`💰 Current token balance: ${tokenAccountInfo.value.uiAmount} tokens`);
        } catch (error) {
          console.log("💰 No tokens in account yet");
        }
      }

      return {
        multisigPDA,
        mintPDA,
        tokenAccountPDA,
        signers: existingSigners || [signer1.publicKey, signer2.publicKey, signer3.publicKey],
        threshold: 2,
        isNewMultisig: !existingSigners,
        playgroundWallets: {
          wallet1: signer1.publicKey.toString(),
          wallet2: signer2.publicKey.toString(),
          wallet3: signer3.publicKey.toString()
        },
        transactions: {
          createMultisig: createMultisigTx,
          createMint: createMintTx,
          createTokenAccount: createTokenAccountTx
        }
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

  private async performMultisigMinting(
    mintPDA: web3.PublicKey, 
    tokenAccountPDA: web3.PublicKey, 
    multisigPDA: web3.PublicKey,
    wallet1: web3.Keypair,
    wallet2: web3.Keypair,
    wallet3: web3.Keypair
  ) {
    const mintAmount = 1000000000; // 1 token

    console.log(`\n🎯 Minting ${mintAmount / 1000000000} tokens with playground wallet multisig...`);
    console.log("📝 This requires 2 out of 3 playground wallet signatures!");

    // Use wallet1 and wallet2 (2 out of 3 playground wallets)
    const mintTxSig = await this.program.methods
      .multisigMintTokens(new anchor.BN(mintAmount))
      .accounts({
        mint: mintPDA,
        tokenAccount: tokenAccountPDA,
        multisig: multisigPDA,
        payer: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: wallet1.publicKey, isWritable: false, isSigner: true },
        { pubkey: wallet2.publicKey, isWritable: false, isSigner: true },
      ])
      .signers([wallet1, wallet2])
      .rpc();

    console.log("✅ Playground wallet multisig mint successful!");
    console.log(`📝 Multisig mint tx: ${mintTxSig}`);
    console.log("🔒 Required 2 playground wallet signatures out of 3 possible");

    // Verify the mint
    const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountPDA);
    console.log(`\n🎉 Token balance: ${tokenAccountInfo.value.uiAmount} tokens`);

    // Demonstrate failed transaction with insufficient signatures
    console.log(`\n❌ Demonstrating failed mint with only 1 playground wallet signature...`);
    
    try {
      await this.program.methods
        .multisigMintTokens(new anchor.BN(500000000))
        .accounts({
          mint: mintPDA,
          tokenAccount: tokenAccountPDA,
          multisig: multisigPDA,
          payer: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: wallet1.publicKey, isWritable: false, isSigner: true },
        ])
        .signers([wallet1])
        .rpc();
        
      console.log("❌ ERROR: This should have failed!");
    } catch (error) {
      console.log("✅ Successfully prevented mint with insufficient signatures!");
      console.log(`📝 Error: ${error.message}`);
    }

    // Demonstrate different playground wallet combination (wallet2 + wallet3)
    console.log(`\n🎯 Minting with different playground wallets (2 & 3)...`);
    
    const mintTxSig2 = await this.program.methods
      .multisigMintTokens(new anchor.BN(500000000))
      .accounts({
        mint: mintPDA,
        tokenAccount: tokenAccountPDA,
        multisig: multisigPDA,
        payer: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: wallet2.publicKey, isWritable: false, isSigner: true },
        { pubkey: wallet3.publicKey, isWritable: false, isSigner: true },
      ])
      .signers([wallet2, wallet3])
      .rpc();

    console.log("✅ Second playground wallet multisig mint successful!");
    console.log(`📝 Second mint tx: ${mintTxSig2}`);

    const finalTokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountPDA);
    console.log(`\n🎉 Final token balance: ${finalTokenAccountInfo.value.uiAmount} tokens`);

    return [mintTxSig, mintTxSig2];
  }

  // Utility method to list available playground wallets
  listPlaygroundWallets() {
    console.log("\n🔑 Available Playground Wallets:");
    console.log(`👛 Wallet 1: ${pg.wallets.wallet1.publicKey.toString()}`);
    console.log(`👛 Wallet 2: ${pg.wallets.wallet2.publicKey.toString()}`);
    console.log(`👛 Wallet 3: ${pg.wallets.wallet3.publicKey.toString()}`);
    
    // You can also check for more wallets if they exist
    try {
      if (pg.wallets.wallet4) {
        console.log(`👛 Wallet 4: ${pg.wallets.wallet4.publicKey.toString()}`);
      }
      if (pg.wallets.wallet5) {
        console.log(`👛 Wallet 5: ${pg.wallets.wallet5.publicKey.toString()}`);
      }
    } catch (error) {
      // Wallets don't exist
    }
  }

  // Check existing multisig
  async checkMultisig() {
    const [multisigPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multisig"), this.wallet.publicKey.toBuffer()],
      this.program.programId
    );

    try {
      const multisig = await this.program.account.multisig.fetch(multisigPDA);
      console.log(`📋 Multisig exists at: ${multisigPDA.toString()}`);
      console.log(`👤 Wallet Signers: ${multisig.signers.length}, Threshold: ${multisig.threshold}`);
      console.log(`🔢 Nonce: ${multisig.nonce}`);
      multisig.signers.forEach((signer, index) => {
        console.log(`👛 Wallet ${index + 1}: ${signer.toString()}`);
      });
      return { multisigPDA, multisig };
    } catch (error) {
      console.log(`❌ No multisig found at: ${multisigPDA.toString()}`);
      return null;
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
  
  // List available playground wallets
  console.log("\n🔑 Listing playground wallets...");
  client.listPlaygroundWallets();
  
  console.log("\n🔍 Checking for existing multisig...");
  await client.checkMultisig();
  
  const result = await client.createRealMultisig();
  
  console.log("\n📊 Summary:");
  console.log(`🔐 Multisig: ${result.multisigPDA.toString()}`);
  console.log(`🪙 Mint: ${result.mintPDA.toString()}`);
  console.log(`💰 Token Account: ${result.tokenAccountPDA.toString()}`);
  console.log(`🆕 New Multisig: ${result.isNewMultisig}`);
  console.log("\n👛 Playground Wallet Signers:");
  console.log(`Wallet 1: ${result.playgroundWallets.wallet1}`);
  console.log(`Wallet 2: ${result.playgroundWallets.wallet2}`);
  console.log(`Wallet 3: ${result.playgroundWallets.wallet3}`);
}

main().catch(console.error);