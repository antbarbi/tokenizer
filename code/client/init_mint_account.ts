// Client
console.log("My address:", pg.wallet.publicKey.toString());
const balance = await pg.connection.getBalance(pg.wallet.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

const programId = new web3.PublicKey(pg.PROGRAM_ID);

const [newTokenMint] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("token-mint"), pg.wallet.publicKey.toBuffer()], programId
);

console.log("New token mint:", newTokenMint.toBase58())

const txSig = await pg.program.methods.initTokenMint()
  .accounts({
    newTokenMint,
    signer: pg.wallet.publicKey,
    systemProgram: web3.SystemProgram.programId
  })
  .rpc()

console.log("Transaction Signature:", txSig)