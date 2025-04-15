from seahorse.prelude import *

declare_id('')

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
def use_token_account(
  signer_account: TokenAccount,
  recipient: TokenAccount,
  signer: Signer
):
  # Transfers 100 tokens from `signer_account` to `recipient`.
  # `signer` must be the authority (owner) for `signer_token_account`.
  # Note that the amounts here are in *native* token quantities - you need to
  # account for decimals when you make calls to .transfer().
  signer_account.transfer(
    authority = signer,
    to = recipient,
    amount = 100
  )