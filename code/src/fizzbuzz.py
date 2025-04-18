# fizzbuzz
# Built with Seahorse v0.2.0
#
# On-chain, persistent FizzBuzz!

from seahorse.prelude import *

# This is your program's public key and it will update
# automatically when you build the project.
declare_id('7PduUCgBLb5YKVMEmkHYCFpLPYcEDoVj2kXoV1MsN4zU')

@instruction
def init_token_account(
  new_token_account: Empty[TokenAccount],
  mint: TokenMint,
  signer: Signer
):
  # On top of the regular init args, you need to provide:
  #   - the mint that this token account will hold tokens of
  #   - the account that has authority over this account.
  new_token_account.init(
    payer = signer,
    seeds = ['token-account', signer],
    mint = mint,
    authority = signer
  )

@instruction
def init_token_mint(
  new_token_mint: Empty[TokenMint],
  signer: Signer
):
  # On top of the regular init args, you need to provide:
  #   - the number of decimals that this token will have
  #   - the account that has authority over this account.
  new_token_mint.init(
    payer = signer,
    seeds = ['token-mint', signer],
    decimals = 6,
    authority = signer
  )

@instruction
def use_token_mint(
  mint: TokenMint,
  recipient: TokenAccount,
  signer: Signer,
  recipient_signer: Signer
):
  # Mint 100 tokens from our `mint` to `recipient`.
  # `signer` must be the authority (owner) for `mint`.
  # Note that the amounts here are in *native* token quantities - you need to
  # account for decimals when you make calls to .mint().
  mint.mint(
    authority = signer,
    to = recipient,
    amount = 100 * 1_000_000
  )
  
  # Burn 99 tokens from the `recipient` account (so after this instruction,
  # `recipient` will gain exactly 1 token.)
  # `recipient_signer` must be the authority for the `recipient` token account.
  mint.burn(
    authority = recipient_signer,
    holder = recipient,
    amount = 99 * 1_000_000
  )

class Multisig(Account):
    signers: [Pubkey; 5]  # Up to 5 authorized signers
    threshold: u8         # Number of required signatures

@instruction
def use_token_mint_multisig(
    multisig: Multisig,
    mint: TokenMint,
    recipient: TokenAccount,
    signer1: Signer,
    signer2: Signer,
    # Add more signers as needed
    recipient_signer: Signer
):
    # Collect all provided signers
    provided_signers = [signer1.key(), signer2.key()]  # Add more as needed

    # Count how many provided signers are in the multisig's authorized list
    valid_signers = 0
    for s in provided_signers:
        for auth in multisig.signers:
            if s == auth:
                valid_signers += 1
                break

    # Check if threshold is met
    assert valid_signers >= multisig.threshold, "Not enough multisig approvals"

    # Proceed with mint and burn as before
    mint.mint(
        authority = signer1,  # or any of the valid signers
        to = recipient,
        amount = 100 * 1_000_000
    )
    mint.burn(
        authority = recipient_signer,
        holder = recipient,
        amount = 99 * 1_000_000
    )