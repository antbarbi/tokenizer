// const mintPda = new web3.PublicKey("8CKSGZdM2v7fxJDeo6BsGUZwq8E99Nii4zSP4bRQYsMR");

// console.log("mintPda:", mintPda.toBase58())

// const programId = new web3.PublicKey(pg.PROGRAM_ID);

// const [newTokenAccount] = web3.PublicKey.findProgramAddressSync(
//   [Buffer.from("token-account"), pg.wallet.publicKey.toBuffer()], programId
// );

// console.log("newTokenAccount:", newTokenAccount.toBase58())

// const txSig = await pg.program.methods.initTokenAccount()
//   .accounts({
//     newTokenAccount,
//     mint: mintPda,
//     signer: pg.wallet.publicKey,
//     systemProgram: web3.SystemProgram.programId
//   }).rpc()

// console.log("Transaction:", txSig)