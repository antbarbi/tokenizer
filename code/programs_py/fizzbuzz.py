# fizzbuzz
# Built with Seahorse v0.2.0
#
# On-chain, persistent FizzBuzz!

from seahorse.prelude import *

declare_id('4zBjDvXgzLAM1GQbMye8baUtTES3qx6MRFpgodg3Laea')

class Multisig(Account):
    signer1: Pubkey
    signer2: Pubkey  
    threshold: u8
    bump: u8

# Helper function (not an instruction)
def check_valid_signer(
  signer: Signer,
  multisig: Multisig
):
  number_of_signers = 0
  if signer.key() == multisig.signer1:
    number_of_signers += 1
  if signer.key() == multisig.signer2:
    number_of_signers += 1
  assert number_of_signers > 0, "Not an authorized signer"


@instruction
def init(
    multisig: Empty[Multisig],
    mint: Empty[TokenMint],
    signer1: Pubkey,
    signer2: Pubkey,
    threshold: u8,
    payer: Signer
):
    # Get bump BEFORE initialization (method call is valid)
    bump = multisig.bump()

    multisig = multisig.init(
        payer=payer,
        seeds=["multisig"],
    )

    mint.init(
      payer = payer,
      seeds = ['42nug-mint'],
      decimals = 4,
      authority = multisig
    )

    multisig.signer1 = signer1
    multisig.signer2 = signer2
    multisig.threshold = threshold
    multisig.bump = bump  # Store the bump as a field

@instruction
def init_token_account(
  new_token_account: Empty[TokenAccount],
  mint: TokenMint,
  signer: Signer
):
  new_token_account.init(
    payer = signer,
    seeds = ['token-account', signer],
    mint = mint,
    authority = signer
  )

@instruction
def mint_token_to_recipient(
  mint: TokenMint,
  recipient: TokenAccount,
  multisig: Multisig,
  signer: Signer,
):
  bump = multisig.bump
  # 1. Check if signer is authorized
  check_valid_signer(signer, multisig)
  
  # 2. Mint tokens using multisig as authority (with signer_seeds for PDA signing)
  mint.mint(
    authority = multisig,  # CHANGED: Use multisig instead of signer
    to = recipient,
    amount = 1 * 10_000,  # Adjusted for 4 decimals (you used decimals=4)
    signer = ['multisig', bump]  # This tells the program to sign on behalf of the PDA
  )