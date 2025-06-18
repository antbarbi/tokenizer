// Remove all imports - Solana Playground provides these globally

class MultisigMintClient {
  private connection: any;
  private program: any;
  private wallet: any;

  constructor() {
    // Get connection, program, and wallet from Solana Playground's global objects
    this.connection = pg.connection;
    this.program = pg.program;
    this.wallet = pg.wallet;
  }

  async createMultisigAndMint() {
    try {
      console.log("🚀 Starting multisig mint proof of concept...");

      // Step 1: Create PERSISTENT multisig signers (using deterministic seeds)
      const seed1 = "signer1";
      const seed2 = "signer2";
      const seed3 = "signer3";
      
      const signer1 = web3.Keypair.fromSeed(new Uint8Array(32).fill(1)); // Deterministic signer 1
      const signer2 = web3.Keypair.fromSeed(new Uint8Array(32).fill(2)); // Deterministic signer 2
      const signer3 = web3.Keypair.fromSeed(new Uint8Array(32).fill(3)); // Deterministic signer 3
      
      const signers = [signer1.publicKey, signer2.publicKey, signer3.publicKey];
      const threshold = 2; // Require 2 out of 3 signatures

      console.log("👥 Using persistent multisig signers:");
      console.log(`  Signer 1: ${signer1.publicKey.toString()}`);
      console.log(`  Signer 2: ${signer2.publicKey.toString()}`);
      console.log(`  Signer 3: ${signer3.publicKey.toString()}`);
      console.log(`  Threshold: ${threshold}`);

      // Step 2: Create persistent multisig account (using deterministic seed)
      const multisigSeed = new Uint8Array(32).fill(100); // Deterministic multisig seed
      const multisigKeypair = web3.Keypair.fromSeed(multisigSeed);
      
      console.log(`\n🔐 Using multisig account: ${multisigKeypair.publicKey.toString()}`);

      // Use the TOKEN_PROGRAM_ID constant directly
      const TOKEN_PROGRAM_ID = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      
      // Check if multisig account already exists
      const existingMultisig = await this.connection.getAccountInfo(multisigKeypair.publicKey);
      
      if (!existingMultisig) {
        console.log("🆕 Creating new multisig account...");
        
        // Create and fund the multisig account
        const multisigRent = await this.connection.getMinimumBalanceForRentExemption(355);
        
        const createMultisigAccountIx = web3.SystemProgram.createAccount({
          fromPubkey: this.wallet.publicKey,
          newAccountPubkey: multisigKeypair.publicKey,
          lamports: multisigRent,
          space: 355,
          programId: TOKEN_PROGRAM_ID,
        });

        // Create the initialize multisig instruction manually
        const initMultisigData = Buffer.alloc(1 + 1 + (32 * signers.length));
        initMultisigData.writeUInt8(2, 0); // InitializeMultisig instruction discriminant
        initMultisigData.writeUInt8(threshold, 1); // threshold
        
        // Write signer pubkeys
        for (let i = 0; i < signers.length; i++) {
          signers[i].toBuffer().copy(initMultisigData, 2 + (i * 32));
        }

        const initMultisigIx = new web3.TransactionInstruction({
          keys: [
            { pubkey: multisigKeypair.publicKey, isSigner: false, isWritable: true },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ...signers.map(signer => ({ pubkey: signer, isSigner: false, isWritable: false }))
          ],
          programId: TOKEN_PROGRAM_ID,
          data: initMultisigData,
        });

        const multisigTx = new web3.Transaction()
          .add(createMultisigAccountIx)
          .add(initMultisigIx);

        // Sign and send the transaction
        const multisigSignature = await web3.sendAndConfirmTransaction(
          this.connection,
          multisigTx,
          [this.wallet.keypair, multisigKeypair]
        );
        
        console.log("✅ Multisig account created successfully!");
        console.log(`📝 Multisig creation signature: ${multisigSignature}`);
      } else {
        console.log("♻️ Reusing existing multisig account!");
      }

      // Step 3: Reuse existing PDA or create new one
      const [mintPDA] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("multisig_mint"), this.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log(`\n🪙 Checking mint PDA: ${mintPDA.toString()}`);

      // Check if mint already exists
      const existingMint = await this.connection.getAccountInfo(mintPDA);
      
      if (existingMint) {
        console.log("♻️ Reusing existing mint PDA!");
        console.log(`📝 Mint PDA: ${mintPDA.toString()}`);
      } else {
        console.log("🆕 Creating new mint with multisig authority...");
        
        const createMintTx = await this.program.methods
          .createMultisigMint(9) // 9 decimals
          .accounts({
            mint: mintPDA,
            multisigAuthority: multisigKeypair.publicKey,
            payer: this.wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log("✅ Mint created with multisig authority!");
        console.log(`📝 Create mint transaction: ${createMintTx}`);
      }

      // Step 4: Create token account for receiving minted tokens  
      const recipient = web3.Keypair.generate();
      
      // Calculate associated token address manually
      const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
      const [tokenAccount] = web3.PublicKey.findProgramAddressSync(
        [
          recipient.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mintPDA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log(`\n💰 Creating token account: ${tokenAccount.toString()}`);

      // Check if token account already exists
      const existingTokenAccount = await this.connection.getAccountInfo(tokenAccount);
      
      if (existingTokenAccount) {
        console.log("♻️ Token account already exists, skipping creation...");
      } else {
        // Create associated token account instruction manually
        const createATAData = Buffer.alloc(0); // No data needed for ATA creation
        
        const createTokenAccountIx = new web3.TransactionInstruction({
          keys: [
            { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: tokenAccount, isSigner: false, isWritable: true },
            { pubkey: recipient.publicKey, isSigner: false, isWritable: false },
            { pubkey: mintPDA, isSigner: false, isWritable: false },
            { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: createATAData,
        });

        const tokenAccountTx = new web3.Transaction().add(createTokenAccountIx);
        const tokenAccountSignature = await web3.sendAndConfirmTransaction(
          this.connection,
          tokenAccountTx,
          [this.wallet.keypair]
        );

        console.log("✅ Token account created!");
        console.log(`📝 Token account creation signature: ${tokenAccountSignature}`);
      }

    // Step 5: Mint tokens using multisig (this is the key part!)
    const mintAmount = 1000000000; // 1 token with 9 decimals

    console.log(`\n🎯 Minting ${mintAmount / 1000000000} tokens using multisig...`);

    // Create SPL Token MintTo instruction with multisig
    const mintToData = Buffer.alloc(9);
    mintToData.writeUInt8(7, 0); // MintTo instruction discriminant
    mintToData.writeBigUInt64LE(BigInt(mintAmount), 1); // Amount as u64

    const mintToIx = new web3.TransactionInstruction({
      keys: [
        { pubkey: mintPDA, isSigner: false, isWritable: true }, // mint
        { pubkey: tokenAccount, isSigner: false, isWritable: true }, // destination
        { pubkey: multisigKeypair.publicKey, isSigner: false, isWritable: false }, // multisig authority
        { pubkey: signer1.publicKey, isSigner: true, isWritable: false }, // multisig signer 1
        { pubkey: signer2.publicKey, isSigner: true, isWritable: false }, // multisig signer 2
      ],
      programId: TOKEN_PROGRAM_ID,
      data: mintToData,
    });

      const mintTx = new web3.Transaction().add(mintToIx);

      // Get recent blockhash and add it to the transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      mintTx.recentBlockhash = blockhash;
      mintTx.feePayer = this.wallet.publicKey;

      // Include the multisig signers in the transaction (they need to actually sign)
      const signature = await web3.sendAndConfirmTransaction(
        this.connection,
        mintTx,
        [this.wallet.keypair, signer1, signer2] // Include the multisig signer keypairs
      );

      console.log("✅ Multisig mint successful!");
      console.log(`📝 Transaction signature: ${signature}`);

      // Step 6: Verify the mint
      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      console.log(`\n🎉 Final token balance: ${tokenAccountInfo.value.uiAmount} tokens`);

      return {
        mintPDA,
        multisigAccount: multisigKeypair.publicKey,
        tokenAccount,
        signature
      };
,
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

// Main function for Solana Playground
const runClient = async () => {
  console.log("My address:", pg.wallet.publicKey.toString());
  const balance = await pg.connection.getBalance(pg.wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
  
  const client = new MultisigMintClient();
  await client.createMultisigAndMint();
};

runClient();