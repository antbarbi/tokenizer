
const mintPda = new web3.PublicKey("8CKSGZdM2v7fxJDeo6BsGUZwq8E99Nii4zSP4bRQYsMR");

const programId = new web3.PublicKey(pg.PROGRAM_ID);

const [newTokenAccount] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("token-account"), pg.wallet.publicKey.toBuffer()], programId
);

const accountInfo = await pg.connection.getParsedAccountInfo(newTokenAccount);

if (
  accountInfo.value &&
  "parsed" in accountInfo.value.data &&
  accountInfo.value.data.program === "spl-token"
) {
  const amount = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
  console.log("Token balance:", amount);
} else {
  console.log("No token account found or not a token account.");
}

const txSig = await pg.program.methods.useTokenMint()
  .accounts({
    mint: mintPda,
    recipient: newTokenAccount,
    signer: pg.wallet.publicKey,
    recipientSigner: pg.wallet.publicKey
  })
  .rpc()

console.log("transaction:", txSig)

const newAccountInfo = await pg.connection.getParsedAccountInfo(newTokenAccount);

if (
  newAccountInfo.value &&
  "parsed" in newAccountInfo.value.data &&
  newAccountInfo.value.data.program === "spl-token"
) {
  const amount = newAccountInfo.value.data.parsed.info.tokenAmount.uiAmount;
  console.log("Token balance:", amount);
} else {
  console.log("No token account found or not a token account.");
}