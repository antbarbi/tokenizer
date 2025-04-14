from seahorse.prelude import *

declare_id('your_program_id_here')

@instruction
def create_token(signer: Signer, mint: TokenMint, token_program: TokenProgram):
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