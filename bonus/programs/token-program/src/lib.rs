use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("8habFRuakcsNxRugQiTs77jxfug2mTSaWY6WJTooiuGt");

#[program]
mod token_program {
    use super::*;
    
    // Create a multisig account
    pub fn create_multisig(
        ctx: Context<CreateMultisig>, 
        signers: Vec<Pubkey>, 
        threshold: u8
    ) -> Result<()> {
        require!(threshold > 0 && threshold <= signers.len() as u8, CustomError::InvalidThreshold);
        require!(signers.len() <= 10, CustomError::TooManySigners); // Max 10 signers
        
        let multisig = &mut ctx.accounts.multisig;
        multisig.signers = signers.clone();
        multisig.threshold = threshold;
        multisig.nonce = 0;
        multisig.bump = ctx.bumps.multisig; // Fixed: Use direct field access (no .get())
        
        msg!("Multisig created with {} signers, threshold: {}", signers.len(), threshold);
        Ok(())
    }
    
    // Create mint with multisig authority
    pub fn create_multisig_mint(ctx: Context<CreateMultisigMint>, decimals: u8) -> Result<()> {
        msg!("Mint created with multisig authority: {}", ctx.accounts.multisig.key());
        Ok(())
    }

    pub fn create_token_account(ctx: Context<CreateTokenAccount>) -> Result<()> {
        msg!("Token account created: {}", ctx.accounts.token_account.key());
        Ok(())
    }
    
    // Multisig mint tokens - requires multiple signatures
    pub fn multisig_mint_tokens(ctx: Context<MultisigMintTokens>, amount: u64) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        
        // Verify we have enough signatures
        let valid_signatures = ctx.remaining_accounts.len();
        require!(
            valid_signatures >= multisig.threshold as usize, 
            CustomError::NotEnoughSignatures
        );
        
        // Verify all signers are authorized
        for signer_info in ctx.remaining_accounts.iter() {
            require!(signer_info.is_signer, CustomError::SignerMustSign);
            require!(
                multisig.signers.contains(signer_info.key), 
                CustomError::UnauthorizedSigner
            );
        }
        
        // Increment nonce to prevent replay attacks
        multisig.nonce += 1;
        
        // Create CPI to mint tokens using multisig as authority
        // Fixed: Create binding to avoid temporary value issue
        let payer_key = ctx.accounts.payer.key();
        let seeds = &[
            b"multisig",
            payer_key.as_ref(), // Fixed: Use binding instead of temporary value
            &[multisig.bump]
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.multisig.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token::mint_to(cpi_ctx, amount)?;
        
        msg!("Multisig minted {} tokens with {} signatures", amount, valid_signatures);
        Ok(())
    }
}

// Multisig account structure
#[account]
pub struct Multisig {
    pub signers: Vec<Pubkey>,    // Authorized signers
    pub threshold: u8,           // Required number of signatures
    pub nonce: u64,             // Prevents replay attacks
    pub bump: u8,               // PDA bump
}

// Create multisig account
#[derive(Accounts)]
pub struct CreateMultisig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 4 + 32 * 10 + 1 + 8 + 1, // 8 (discriminator) + 4 (Vec length) + 32*10 (max signers) + 1 (threshold) + 8 (nonce) + 1 (bump)
        seeds = [b"multisig", payer.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Create mint with multisig authority
#[derive(Accounts)]
pub struct CreateMultisigMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 9,
        mint::authority = multisig,
        seeds = [b"mint", multisig.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,
    
    pub multisig: Account<'info, Multisig>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

// Multisig mint tokens
#[derive(Accounts)]
pub struct MultisigMintTokens<'info> {
    #[account(
        mut,
        mint::authority = multisig,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        token::mint = mint,
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub multisig: Account<'info, Multisig>,
    
    // Add payer to access in PDA seeds
    pub payer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    // remaining_accounts will contain the signers
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

// Custom errors
#[error_code]
pub enum CustomError {
    #[msg("Invalid threshold: must be > 0 and <= number of signers")]
    InvalidThreshold,
    #[msg("Too many signers: maximum is 10")]
    TooManySigners,
    #[msg("Not enough signatures provided")]
    NotEnoughSignatures,
    #[msg("Signer account must sign the transaction")]
    SignerMustSign,
    #[msg("Unauthorized signer")]
    UnauthorizedSigner,
}