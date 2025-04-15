from seahorse.prelude import *

declare_id('')

@instruction
def create_token(signer: Signer, mint: TokenMint, token_program: Program):
    # Initialize the mint account
    token_program.initialize_mint(
        mint=mint,
        mint_authority=signer,
        decimals=9,
        freeze_authority=signer
    )
    print(f"Token created with mint {mint.key()}")


@instruction
def mint_token(signer: Signer, mint: TokenMint, token_account: TokenAccount, 
               token_program: TokenProgram, amount: u64):
    # Mint tokens to an account
    token_program.mint_to(
        mint=mint,
        to=token_account,
        authority=signer,
        amount=amount
    )
    print(f"Minted {amount} tokens to {token_account.key()}")


@instruction
def transfer_token(sender: Signer, from_account: TokenAccount, to_account: TokenAccount, 
                  token_program: TokenProgram, amount: u64):
    # Transfer tokens between accounts
    token_program.transfer(
        from_=from_account,
        to=to_account,
        authority=sender,
        amount=amount
    )
    print(f"Transferred {amount} tokens from {from_account.key()} to {to_account.key()}")


@instruction
def burn_token(signer: Signer, mint: TokenMint, token_account: TokenAccount, 
              token_program: TokenProgram, amount: u64):
    # Burn tokens from an account
    token_program.burn(
        account=token_account,
        mint=mint,
        authority=signer,
        amount=amount
    )
    print(f"Burned {amount} tokens from {token_account.key()}")