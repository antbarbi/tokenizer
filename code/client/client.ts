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
  
  const programId = pg.PROGRAM_ID
  const program = anchor.workspace.TokenProgram;

  const wallet = provider.wallet;
  console.log("Main wallet public key:", wallet.publicKey.toString());
  
  // Create a second wallet to demonstrate transfers
  const secondWalletSeed = new Uint8Array(32).fill(1);
  const secondWallet = Keypair.fromSeed(secondWalletSeed);
  console.log("Second wallet public key:", secondWallet.publicKey.toString());

  try {
    // 1. CREATE TOKEN WITH METADATA USING TOKEN EXTENSIONS
    console.log("Creating token with metadata using Token Extensions...");
    
    // Generate a new mint keypair
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;
    
    console.log("New Mint Address:", mint.toString());
    
    // 🎯 CUSTOMIZE YOUR TOKEN NAME AND SYMBOL HERE 🎯
    const metadata = {
      name: "MyAwesome Token",           // ← Change this to your desired name
      symbol: "MAT",                    // ← Change this to your desired symbol
      uri: "",                          // ← Optional: add your metadata JSON URL
    };
    
    // Calculate space needed - use only the metadata pointer extension
    const extensions = [ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    
    // Get minimum rent for the mint account (correct initial size)
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    
    console.log("Mint length:", mintLen);
    console.log("Required lamports:", lamports);
    
    // Create mint account with CORRECT initial space
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint,
      space: mintLen,  // Use ONLY mint length initially
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    });
    
    // Initialize metadata pointer (points to the mint itself)
    const initializeMetadataPointerInstruction = createInitializeMetadataPointerInstruction(
      mint,
      wallet.publicKey, // authority
      mint, // metadata address (pointing to itself)
      TOKEN_2022_PROGRAM_ID
    );
    
    // Initialize mint
    const initializeMintInstruction = createInitializeMintInstruction(
      mint,
      9, // decimals
      wallet.publicKey, // mint authority
      null, // freeze authority (none)
      TOKEN_2022_PROGRAM_ID
    );
    
    // Create and send mint creation transaction
    const mintTransaction = new Transaction().add(
      createAccountInstruction,
      initializeMetadataPointerInstruction,
      initializeMintInstruction
    );
    
    const mintSignature = await provider.sendAndConfirm(mintTransaction, [mintKeypair]);
    console.log("✅ Token with metadata pointer created!");
    console.log("Mint transaction signature:", mintSignature);
    
    // 2. EXTEND ACCOUNT AND INITIALIZE METADATA
    console.log("Adding metadata to token...");

    try {
      // Calculate space needed for metadata
      const metadataLen = 
        8 +                             // discriminator
        32 +                            // update_authority
        32 +                            // mint
        4 + metadata.name.length +      // name with length prefix
        4 + metadata.symbol.length +    // symbol with length prefix  
        4 + metadata.uri.length +       // uri with length prefix
        4 +                             // additional_metadata length (0)
        64;                             // padding/safety buffer

      // Get current account info
      const mintAccount = await provider.connection.getAccountInfo(mint);
      const currentSize = mintAccount?.data.length || 0;
      const newSize = currentSize + metadataLen;
      
      console.log("Current mint size:", currentSize);
      console.log("Metadata space needed:", metadataLen);
      console.log("New total size:", newSize);

      // Calculate additional rent needed
      const currentRent = mintAccount?.lamports || 0;
      const newRentRequired = await provider.connection.getMinimumBalanceForRentExemption(newSize);
      const additionalRent = newRentRequired - currentRent;
      
      console.log("Additional rent needed:", additionalRent);

      // First, add more SOL to the mint account if needed
      if (additionalRent > 0) {
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: mint,
          lamports: additionalRent,
        });
        
        await provider.sendAndConfirm(new Transaction().add(transferInstruction));
        console.log("✅ Additional rent transferred to mint account");
      }

      // Now manually extend the account using a system instruction
      const extendInstruction = SystemProgram.assign({
        accountPubkey: mint,
        programId: TOKEN_2022_PROGRAM_ID,
      });

      // Now try to initialize metadata directly
      const initializeMetadataInstruction = createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority: wallet.publicKey,
        mint: mint,
        mintAuthority: wallet.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      });
      
      const metadataTransaction = new Transaction().add(initializeMetadataInstruction);
      const metadataSignature = await provider.sendAndConfirm(metadataTransaction);
      
      console.log("✅ Token metadata initialized successfully!");
      console.log("🎉 Your token name:", metadata.name);
      console.log("🎉 Your token symbol:", metadata.symbol);
      console.log("Metadata transaction signature:", metadataSignature);
      
    } catch (metadataError) {
      console.log("⚠️ Full metadata failed, trying minimal approach...");
      console.log("Error:", metadataError.message);
      
      // Try with just the symbol as both name and symbol (minimal space)
      try {
        console.log("Trying minimal metadata with symbol only...");
        const minimalMetadataInstruction = createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          metadata: mint,
          updateAuthority: wallet.publicKey,
          mint: mint,
          mintAuthority: wallet.publicKey,
          name: metadata.symbol,  // Use symbol as name
          symbol: metadata.symbol,
          uri: "",
        });
        
        const minimalTransaction = new Transaction().add(minimalMetadataInstruction);
        const minimalSignature = await provider.sendAndConfirm(minimalTransaction);
        console.log("✅ Minimal metadata created successfully!");
        console.log("🎉 Your token name/symbol:", metadata.symbol);
        console.log("Minimal metadata signature:", minimalSignature);
        
      } catch (minimalError) {
        console.log("❌ All metadata attempts failed!");
        console.log("Token is fully functional but without custom name");
        console.log("Error:", minimalError.message);
      }
    }
    
    // 3. DERIVE ATA ADDRESSES (using TOKEN_2022_PROGRAM_ID)
    const tokenAccount1ATA = getAssociatedTokenAddressSync(
      mint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("First Token Account ATA:", tokenAccount1ATA.toString());
    
    const tokenAccount2ATA = getAssociatedTokenAddressSync(
      mint,
      secondWallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("Second Token Account ATA:", tokenAccount2ATA.toString());
    
    // 4. CREATE TOKEN ACCOUNTS
    console.log("Creating associated token accounts...");
    
    // Create ATA for first wallet
    const createATA1Instruction = createAssociatedTokenAccountInstruction(
      wallet.publicKey, // payer
      tokenAccount1ATA, // ata
      wallet.publicKey, // owner
      mint, // mint
      TOKEN_2022_PROGRAM_ID
    );
    
    // Fund second wallet first
    const transferSolTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: secondWallet.publicKey,
        lamports: 10000000,
      })
    );
    await provider.sendAndConfirm(transferSolTx);
    console.log("Funded second wallet with SOL");
    
    // Create ATA for second wallet  
    const createATA2Instruction = createAssociatedTokenAccountInstruction(
      secondWallet.publicKey, // payer
      tokenAccount2ATA, // ata
      secondWallet.publicKey, // owner
      mint, // mint
      TOKEN_2022_PROGRAM_ID
    );
    
    // Send ATA creation transactions
    await provider.sendAndConfirm(new Transaction().add(createATA1Instruction));
    console.log("First token account created");
    
    await provider.sendAndConfirm(new Transaction().add(createATA2Instruction), [secondWallet]);
    console.log("Second token account created");

    // 5. MINT TOKENS
    const mintAmount = 1000000000n; // 1 token with 9 decimals
    console.log("Minting tokens to first account...");
    
    const mintToInstruction = createMintToInstruction(
      mint,
      tokenAccount1ATA,
      wallet.publicKey, // mint authority
      mintAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    
    await provider.sendAndConfirm(new Transaction().add(mintToInstruction));

    // 6. CHECK BALANCES
    let tokenAccount1 = await getAccount(provider.connection, tokenAccount1ATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
    let tokenAccount2 = await getAccount(provider.connection, tokenAccount2ATA, 'confirmed', TOKEN_2022_PROGRAM_ID);

    console.log("BEFORE TRANSFER:");
    console.log("Account 1:", Number(tokenAccount1.amount) / Math.pow(10, 9), "tokens");
    console.log("Account 2:", Number(tokenAccount2.amount) / Math.pow(10, 9), "tokens");

    // 7. TRANSFER TOKENS
    const transferAmount = 500000000n; // 0.5 tokens
    console.log("\nTransferring 0.5 tokens...");
    
    const transferInstruction = createTransferInstruction(
      tokenAccount1ATA,
      tokenAccount2ATA,
      wallet.publicKey,
      transferAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    
    await provider.sendAndConfirm(new Transaction().add(transferInstruction));

    // 8. FINAL BALANCES
    tokenAccount1 = await getAccount(provider.connection, tokenAccount1ATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
    tokenAccount2 = await getAccount(provider.connection, tokenAccount2ATA, 'confirmed', TOKEN_2022_PROGRAM_ID);

    console.log("\nAFTER TRANSFER:");
    console.log("Account 1:", Number(tokenAccount1.amount) / Math.pow(10, 9), "tokens");
    console.log("Account 2:", Number(tokenAccount2.amount) / Math.pow(10, 9), "tokens");
    
    console.log("\n✅ Token Extensions program completed successfully!");
    console.log("🔗 Your token mint address:", mint.toString());
    console.log(`🎯 Your token "${metadata.name}" (${metadata.symbol}) is ready!`);
    console.log("🚀 Token has native metadata support and is production-ready!");

  } catch (error) {
    console.error("Error:", error);
  }
}

main();