use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
// Add these imports
use anchor_spl::metadata::{
    create_metadata_accounts_v3,
    CreateMetadataAccountsV3,
    Metadata,
};

declare_id!("8habFRuakcsNxRugQiTs77jxfug2mTSaWY6WJTooiuGt");

#[program]
mod token_program {
    use super::*;
    
    pub fn create_mint(ctx: Context<CreateMint>, decimals: u8) -> Result<()> {
        msg!("Token mint created: {}", ctx.accounts.mint.key());
        Ok(())
    }
    
    pub fn create_token_account(ctx: Context<CreateTokenAccount>) -> Result<()> {
        msg!("Token account created: {}", ctx.accounts.token_account.key());
        Ok(())
    }
    
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::mint_to(cpi_ctx, amount)?;
        
        msg!("Minted {} tokens to {}", amount, ctx.accounts.token_account.key());
        Ok(())
    }

    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        // Create the transfer CPI instruction
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.source.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        // Execute transfer
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Transferred {} tokens from {} to {}", 
            amount, 
            ctx.accounts.source.key(), 
            ctx.accounts.destination.key()
        );
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 9,
        mint::authority = payer,
        seeds = [b"token_mint", payer.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateTokenAccount<'info> {
    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = owner,
        seeds = [b"token_account", owner.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        mint::authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        token::mint = mint,
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    pub mint_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(
        mut,
        token::authority = authority,
    )]
    pub source: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = source.mint,
    )]
    pub destination: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}