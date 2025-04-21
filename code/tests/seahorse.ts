import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import type { Fizzbuzz } from "../target/types/fizzbuzz";

describe("FizzBuzz", async () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Fizzbuzz as anchor.Program<Fizzbuzz>;
  
  // Generate the fizzbuzz account public key from its seeds
  const [fizzBuzzAccountPk] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("fizzbuzz"), program.provider.publicKey.toBuffer()],
    program.programId
  );

  it("init", async () => {
    // Send transaction
    const txHash = await program.methods
      .init()
      .accounts({
        fizzbuzz: fizzBuzzAccountPk,
        owner: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
      console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm transaction
    await program.provider.connection.confirmTransaction(txHash);

    // Fetch the created account
    const fizzBuzzAccount = await program.account.fizzBuzz.fetch(
      fizzBuzzAccountPk
    );

    console.log("Fizz:", fizzBuzzAccount.fizz);
    console.log("Buzz:", fizzBuzzAccount.buzz);
    console.log("N:", fizzBuzzAccount.n.toString());
  });

  it("doFizzbuzz", async () => {
    // Send transaction
    const txHash = await program.methods
      .doFizzbuzz(new BN(6000))
      .accounts({
        fizzbuzz: fizzBuzzAccountPk,
      })
      .rpc();

    // Confirm transaction
    await program.provider.connection.confirmTransaction(txHash);

    // Fetch the fizzbuzz account
    const fizzBuzzAccount = await program.account.fizzBuzz.fetch(
      fizzBuzzAccountPk
    );

    console.log("Fizz:", fizzBuzzAccount.fizz);
    assert(fizzBuzzAccount.fizz)

    console.log("Buzz:", fizzBuzzAccount.buzz);
    assert(fizzBuzzAccount.buzz)

    console.log("N:", fizzBuzzAccount.n.toString());
    assert.equal(fizzBuzzAccount.n, 0);
  });
});
