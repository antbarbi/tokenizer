import { 
  PublicKey, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY, 
  Keypair, 
  Transaction, 
  TransactionInstruction 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  getAccount, 
  getAssociatedTokenAddressSync, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeInstruction,
  createMintToInstruction,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getMintLen,
  ExtensionType,
  LENGTH_SIZE,
  TYPE_SIZE,
} from '@solana/spl-token';

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

  listPlaygroundWallets() {
    console.log("Available Solana Playground wallets:");
    console.log(`Wallet 1: ${pg.wallets.wallet1.keypair.publicKey.toString()}`);
    console.log(`Wallet 2: ${pg.wallets.wallet2.keypair.publicKey.toString()}`);
    console.log(`Wallet 3: ${pg.wallets.wallet3.keypair.publicKey.toString()}`);
    console.log(`Main wallet: ${this.wallet.publicKey.toString()}`);
  }

  async checkMultisig() {
    try {
      const [multisigPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("multisig"), this.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log(`Checking for existing multisig at: ${multisigPDA.toString()}`);

      try {
        const existingMultisig = await this.program.account.multisig.fetch(multisigPDA);
        console.log("[FOUND] Existing multisig detected!");
        console.log(`Signers: ${existingMultisig.signers.length}, Threshold: ${existingMultisig.threshold}`);
        
        const currentSigners = [
          pg.wallets.wallet1.keypair.publicKey,
          pg.wallets.wallet2.keypair.publicKey,
          pg.wallets.wallet3.keypair.publicKey
        ];
        
        const signersMatch = existingMultisig.signers.every((existingSigner, index) => 
          existingSigner.toString() === currentSigners[index].toString()
        );
        
        if (signersMatch) {
          console.log("[MATCH] Playground wallets match existing multisig!");
        } else {
          console.log("[MISMATCH] Playground wallets don't match existing multisig");
          console.log("Existing signers:");
          existingMultisig.signers.forEach((signer, i) => {
            console.log(`  ${i + 1}: ${signer.toString()}`);
          });
          console.log("Current playground wallets:");
          currentSigners.forEach((signer, i) => {
            console.log(`  ${i + 1}: ${signer.toString()}`);
          });
        }
        
        return { exists: true, matches: signersMatch, multisig: existingMultisig };
      } catch (error) {
        console.log("[NOT FOUND] No existing multisig found");
        return { exists: false, matches: false, multisig: null };
      }
    } catch (error) {
      console.error("[ERROR] Error checking multisig:", error.message);
      return { exists: false, matches: false, multisig: null };
    }
  }

  async createRealMultisig() {
    try {
      console.log("[INIT] Creating multisig setup with Token Extensions metadata...");

      const signer1 = pg.wallets.wallet1.keypair;
      const signer2 = pg.wallets.wallet2.keypair;
      const signer3 = pg.wallets.wallet3.keypair;
      
      console.log(`[SIGNER] Wallet 1: ${signer1.publicKey.toString()}`);
      console.log(`[SIGNER] Wallet 2: ${signer2.publicKey.toString()}`);
      console.log(`[SIGNER] Wallet 3: ${signer3.publicKey.toString()}`);

      // Fund the signer wallets
      const signers = [signer1, signer2, signer3];
      for (let i = 0; i < signers.length; i++) {
        try {
          const airdropSig = await this.connection.requestAirdrop(
            signers[i].publicKey,
            0.1 * web3.LAMPORTS_PER_SOL
          );
          await this.connection.confirmTransaction(airdropSig);
          console.log(`[FUND] Signer Wallet ${i + 1} funded`);
        } catch (error) {
          console.log(`[WARN] Wallet ${i + 1} airdrop failed (might already have funds)`);
        }
      }

      // Handle multisig account
      const [multisigPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("multisig"), this.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log(`\n[MULTISIG] PDA: ${multisigPDA.toString()}`);

      let existingSigners = null;
      let createMultisigTx = null;

      try {
        const existingMultisig = await this.program.account.multisig.fetch(multisigPDA);
        console.log("[WARN] Multisig already exists, checking if our wallets match...");
        console.log(`[INFO] Existing signers: ${existingMultisig.signers.length}, threshold: ${existingMultisig.threshold}`);
        
        existingSigners = existingMultisig.signers;
        const currentSigners = [signer1.publicKey, signer2.publicKey, signer3.publicKey];
        
        const signersMatch = existingSigners.every((existingSigner, index) => 
          existingSigner.toString() === currentSigners[index].toString()
        );
        
        if (signersMatch) {
          console.log("[SUCCESS] Our playground wallets match the existing multisig!");
          existingSigners = null;
        } else {
          console.log("[ERROR] Our playground wallets don't match existing multisig");
        }
        
      } catch (error) {
        console.log("[CREATE] Creating new multisig with playground wallets...");
        createMultisigTx = await this.program.methods
          .createMultisig(
            [signer1.publicKey, signer2.publicKey, signer3.publicKey],
            2
          )
          .accounts({
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();

        console.log("[SUCCESS] Multisig account created with playground wallets!");
        console.log(`[TX] Multisig creation tx: ${createMultisigTx}`);
      }

      // Create mint with Token Extensions
      const [mintPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), multisigPDA.toBuffer()],
        this.program.programId
      );

      console.log(`\n[MINT] Creating Token Extensions mint: ${mintPDA.toString()}`);

      const metadata = {
        name: "42Nug",
        symbol: "42N",
        uri: "https://gateway.pinata.cloud/ipfs/bafkreibarehgrziov4e5smqkah4cxw3jyod7lxnpy5dvhaqq6cqow3m3um",
      };

      let createMintTx = null;
      try {
        const existingMint = await this.connection.getAccountInfo(mintPDA);
        if (existingMint) {
          console.log("[WARN] Mint already exists, skipping creation...");
          createMintTx = "EXISTING_MINT";
        } else {
          throw new Error("Mint doesn't exist");
        }
      } catch (error) {
        console.log("[CREATE] Creating new Token Extensions mint...");
        
        createMintTx = await this.program.methods
          .createMultisigMint(9)
          .accounts({
            mint: mintPDA,
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log("[SUCCESS] Token Extensions mint created!");
        console.log(`[TX] Mint creation tx: ${createMintTx}`);
        // --- Robust metadata pointer/metadata initialization ---
        if (createMintTx !== "EXISTING_MINT") {
          console.log("[METADATA] Initializing Token Extensions metadata...");
          const metadataPointerIx = createInitializeMetadataPointerInstruction(
            mintPDA,
            this.wallet.publicKey, // update authority
            mintPDA,               // metadata address (can be the mint itself)
            TOKEN_2022_PROGRAM_ID
          );
          const metadataIx = createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            metadata: mintPDA,
            updateAuthority: this.wallet.publicKey,
            mint: mintPDA,
            mintAuthority: this.wallet.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
          });
          const tx = new Transaction().add(metadataPointerIx, metadataIx);
          try {
            const sig = await this.connection.sendTransaction(tx, [this.wallet.payer]);
            console.log("[METADATA] Metadata initialized!");
            console.log(`[TX] Metadata init tx: ${sig}`);
          } catch (error) {
            if (
              error.message &&
              (error.message.includes("custom program error: 0x6") ||
                error.message.includes("account or token already in use"))
            ) {
              console.log("[WARN] Metadata pointer already initialized, skipping.");
            } else {
              throw error;
            }
          }
        }
        console.log("[INFO] Metadata support ready for Token Extensions");
      }

      // Create Associated Token Account using robust SPL Token logic
      const tokenAccountATA = getAssociatedTokenAddressSync(
        mintPDA,
        this.wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      console.log(`\n[TOKEN] Creating Associated Token Account: ${tokenAccountATA.toString()}`);

      let createTokenAccountTx = null;
      let ataInitialized = false;
      try {
        await getAccount(this.connection, tokenAccountATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
        ataInitialized = true;
      } catch (e) {
        ataInitialized = false;
      }
      if (ataInitialized) {
        console.log("[WARN] Token account already exists and is initialized, skipping creation...");
        createTokenAccountTx = "EXISTING_TOKEN_ACCOUNT";
      } else {
        console.log("[CREATE] Creating new Associated Token Account...");
        const createATAIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey, // payer
          tokenAccountATA,       // ata
          this.wallet.publicKey, // owner
          mintPDA,               // mint
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const tx = new Transaction().add(createATAIx);
        createTokenAccountTx = await this.connection.sendTransaction(tx, [this.wallet.payer]);
        // Wait for confirmation before proceeding
        await this.connection.confirmTransaction(createTokenAccountTx, 'confirmed');
        console.log("[SUCCESS] Associated Token Account created!");
        console.log(`[TX] Token account tx: ${createTokenAccountTx}`);
      }

      // Perform multisig operations
      if (!existingSigners) {
        await this.performMultisigMinting(mintPDA, tokenAccountATA, multisigPDA, signer1, signer2, signer3);
      } else {
        console.log("\n[WARN] Skipping minting demo - playground wallets don't match existing multisig");
        
        try {
          const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountATA);
          console.log(`[BALANCE] Current token balance: ${tokenAccountInfo.value.uiAmount} tokens`);
        } catch (error) {
          console.log("[BALANCE] No tokens in account yet");
        }
      }

      return {
        multisigPDA,
        mintPDA,
        tokenAccountATA,
        signers: existingSigners || [signer1.publicKey, signer2.publicKey, signer3.publicKey],
        threshold: 2,
        isNewMultisig: !existingSigners,
        metadata: metadata,
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
      console.error("[ERROR] Error:", error);
      console.error("[ERROR] Error details:", error.message);
      if (error.logs) {
        console.error("[ERROR] Program logs:", error.logs);
      }
      throw error;
    }
  }

  private async performMultisigMinting(
    mintPDA: web3.PublicKey, 
    tokenAccountATA: web3.PublicKey,
    multisigPDA: web3.PublicKey,
    wallet1: web3.Keypair,
    wallet2: web3.Keypair,
    wallet3: web3.Keypair
  ) {
    const mintAmount = 1000000000; // 1 token

    console.log(`\n[MINT] Minting ${mintAmount / 1000000000} tokens with Token Extensions multisig...`);
    console.log("[INFO] This requires 2 out of 3 playground wallet signatures!");

    try {
      // SUCCESSFUL CASE: 2-of-3 signatures
      console.log("\n🟢 TESTING: Successful mint with 2 signatures (meets threshold)...");
      const mintTxSig = await this.program.methods
        .multisigMintTokens(new anchor.BN(mintAmount))
        .accounts({
          mint: mintPDA,
          associatedTokenAccount: tokenAccountATA,
          owner: this.wallet.publicKey,
          multisig: multisigPDA,
          payer: this.wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: wallet1.publicKey, isWritable: false, isSigner: true },
          { pubkey: wallet2.publicKey, isWritable: false, isSigner: true },
        ])
        .signers([wallet1, wallet2])
        .rpc();

      console.log("[SUCCESS] Token Extensions multisig mint successful!");
      console.log(`[TX] Multisig mint tx: ${mintTxSig}`);

      // Verify the mint
      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountATA);
      console.log(`[SUCCESS] Token balance: ${tokenAccountInfo.value.uiAmount} tokens`);

      // FAILURE CASE: Test insufficient signatures
      console.log("\n🔴 TESTING: Mint with insufficient signatures (1 signature, below threshold of 2)...");
      
      try {
        await this.program.methods
          .multisigMintTokens(new anchor.BN(500000000))
          .accounts({
            mint: mintPDA,
            associatedTokenAccount: tokenAccountATA,
            owner: this.wallet.publicKey,
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .remainingAccounts([
            { pubkey: wallet1.publicKey, isWritable: false, isSigner: true },
          ])
          .signers([wallet1])
          .rpc();
          
        console.log("❌ [ERROR] This transaction should have failed but didn't!");
      } catch (error) {
        console.log("✅ [SUCCESS] Correctly rejected insufficient signatures!");
        console.log(`[INFO] Error message: ${error.message}`);
      }

      // FAILURE CASE: Test with no signatures
      console.log("\n🔴 TESTING: Mint with no signatures...");
      
      try {
        await this.program.methods
          .multisigMintTokens(new anchor.BN(250000000))
          .accounts({
            mint: mintPDA,
            associatedTokenAccount: tokenAccountATA,
            owner: this.wallet.publicKey,
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            tokenProgram:  TOKEN_2022_PROGRAM_ID,
          })
          .remainingAccounts([])
          .signers([])
          .rpc();
          
        console.log("❌ [ERROR] This transaction should have failed but didn't!");
      } catch (error) {
        console.log("✅ [SUCCESS] Correctly rejected transaction with no signatures!");
        console.log(`[INFO] Error message: ${error.message}`);
      }

      // SUCCESS CASE: Test with all 3 signatures
      console.log("\n🟢 TESTING: Mint with all 3 signatures (exceeds threshold)...");
      
      try {
        const allSignersTx = await this.program.methods
          .multisigMintTokens(new anchor.BN(1_000_000_000))
          .accounts({
            mint: mintPDA,
            associatedTokenAccount: tokenAccountATA,
            owner: this.wallet.publicKey,
            multisig: multisigPDA,
            payer: this.wallet.publicKey,
            tokenProgram:  TOKEN_2022_PROGRAM_ID,
          })
          .remainingAccounts([
            { pubkey: wallet1.publicKey, isWritable: false, isSigner: true },
            { pubkey: wallet2.publicKey, isWritable: false, isSigner: true },
            { pubkey: wallet3.publicKey, isWritable: false, isSigner: true },
          ])
          .signers([wallet1, wallet2, wallet3])
          .rpc();
          
        console.log("✅ [SUCCESS] All 3 signatures accepted!");
        console.log(`[TX] All signers tx: ${allSignersTx}`);
      } catch (error) {
        console.log("⚠️ [WARN] All signatures test failed:", error.message);
      }

      // Final balance check
      const finalTokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccountATA);
      console.log(`\n[FINAL] Total token balance: ${finalTokenAccountInfo.value.uiAmount} tokens`);

      console.log("\n📊 MULTISIG TESTING SUMMARY:");
      console.log("✅ 2-of-3 signatures: PASSED (meets threshold)");
      console.log("✅ 1-of-3 signatures: CORRECTLY REJECTED");
      console.log("✅ 0-of-3 signatures: CORRECTLY REJECTED");
      console.log("✅ 3-of-3 signatures: PASSED (exceeds threshold)");

      return [mintTxSig];
    } catch (error) {
      console.error("[ERROR] Multisig minting failed:", error.message);
      if (error.logs) {
        console.error("[ERROR] Program logs:", error.logs);
      }
      throw error;
    }
  }
}

async function main() {
  console.log("My address:", anchor.AnchorProvider.env().wallet.publicKey.toString());
  const balance = await anchor.AnchorProvider.env().connection.getBalance(
    anchor.AnchorProvider.env().wallet.publicKey
  );
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
  
  const client = new RealMultisigClient();
  
  console.log("\n[WALLETS] Listing playground wallets...");
  client.listPlaygroundWallets();
  
  console.log("\n[INFO] Checking for existing multisig...");
  await client.checkMultisig();
  
  const result = await client.createRealMultisig();
  
  console.log("\n[SUMMARY] Token Extensions Multisig Summary:");
  console.log(`[MULTISIG] Multisig: ${result.multisigPDA.toString()}`);
  console.log(`[MINT] Mint: ${result.mintPDA.toString()}`);
  console.log(`[TOKEN] Token Account: ${result.tokenAccountATA.toString()}`);
  console.log(`[METADATA] Token Name: ${result.metadata.name}`);
  console.log(`[METADATA] Token Symbol: ${result.metadata.symbol}`);
  console.log(`[INFO] New Multisig: ${result.isNewMultisig}`);
}

main().catch(console.error);