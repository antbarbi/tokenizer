use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

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
        require!(signers.len() <= 10, CustomError::TooManySigners);
        
        let multisig = &mut ctx.accounts.multisig;
        multisig.signers = signers.clone();
        multisig.threshold = threshold;
        multisig.nonce = 0;
        multisig.bump = ctx.bumps.multisig;
        
        msg!("Multisig created with {} signers, threshold: {}", signers.len(), threshold);
        Ok(())
    }
    
    // Create mint with multisig authority
    pub fn create_multisig_mint(
        ctx: Context<CreateMultisigMint>, 
        decimals: u8
    ) -> Result<()> {
        // The mint is already created by Anchor with Token Extensions support
        // Metadata will be added separately via client-side instructions
        msg!("Token Extensions mint created with decimals: {}, Authority: {}", 
             decimals, ctx.accounts.multisig.key());
        Ok(())
    }

    // Create ATA
    pub fn create_associated_token_account(ctx: Context<CreateAssociatedTokenAccount>) -> Result<()> {
        msg!("Associated Token Account created: {}", ctx.accounts.associated_token_account.key());
        Ok(())
    }
    
    // Multisig mint tokens
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
        
        // Create CPI to mint tokens using Token Extensions
        let payer_key = ctx.accounts.payer.key();
        let seeds = &[
            b"multisig",
            payer_key.as_ref(),
            &[multisig.bump]
        ];
        let signer_seeds = &[&seeds[..]];
        
        // Use anchor_spl::token_interface for Token Extensions
        let cpi_accounts = anchor_spl::token_interface::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.associated_token_account.to_account_info(),
            authority: ctx.accounts.multisig.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        anchor_spl::token_interface::mint_to(cpi_ctx, amount)?;
        
        msg!("Multisig minted {} tokens with {} signatures", amount, valid_signatures);
        Ok(())
    }
    
    // Transfer tokens using multisig
    pub fn multisig_transfer(
        ctx: Context<MultisigTransfer>, 
        amount: u64
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        
        // Verify signatures (same logic as mint)
        let valid_signatures = ctx.remaining_accounts.len();
        require!(
            valid_signatures >= multisig.threshold as usize, 
            CustomError::NotEnoughSignatures
        );
        
        for signer_info in ctx.remaining_accounts.iter() {
            require!(signer_info.is_signer, CustomError::SignerMustSign);
            require!(
                multisig.signers.contains(signer_info.key), 
                CustomError::UnauthorizedSigner
            );
        }
        
        multisig.nonce += 1;
        
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.from_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to_ata.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        // Use transfer_checked instead of deprecated transfer
        anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        
        msg!("Multisig transferred {} tokens", amount);
        Ok(())
    }
}

// Multisig account structure
#[account]
pub struct Multisig {
    pub signers: Vec<Pubkey>,
    pub threshold: u8,
    pub nonce: u64,
    pub bump: u8,
}

// Create multisig account
#[derive(Accounts)]
pub struct CreateMultisig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 4 + 32 * 10 + 1 + 8 + 1, // Account discriminator + Vec<Pubkey> + threshold + nonce + bump
        seeds = [b"multisig", payer.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Create mint with Token Extensions support (simplified)
#[derive(Accounts)]
pub struct CreateMultisigMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 9,
        mint::authority = multisig,
        mint::token_program = token_program,
        mint::freeze_authority = multisig,
        seeds = [b"mint", multisig.key().as_ref()],
        bump
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    pub multisig: Account<'info, Multisig>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

// Create Associated Token Account
#[derive(Accounts)]
pub struct CreateAssociatedTokenAccount<'info> {
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub associated_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// CHECK: This is the owner of the ATA
    pub owner: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// Multisig mint tokens with ATA
#[derive(Accounts)]
pub struct MultisigMintTokens<'info> {
    #[account(
        mut,
        mint::authority = multisig,
        mint::token_program = token_program,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub associated_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Owner of the ATA
    pub owner: AccountInfo<'info>,
    
    #[account(mut)]
    pub multisig: Account<'info, Multisig>,
    
    pub payer: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    // remaining_accounts will contain the signers
}

// Transfer between ATAs
#[derive(Accounts)]
pub struct MultisigTransfer<'info> {
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = from_authority,
        associated_token::token_program = token_program,
    )]
    pub from_ata: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = to_authority,
        associated_token::token_program = token_program,
    )]
    pub to_ata: InterfaceAccount<'info, TokenAccount>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// CHECK: Authority for the from_ata
    pub from_authority: AccountInfo<'info>,
    
    /// CHECK: Authority for the to_ata  
    pub to_authority: AccountInfo<'info>,
    
    #[account(mut)]
    pub multisig: Account<'info, Multisig>,
    
    pub token_program: Interface<'info, TokenInterface>,
    // remaining_accounts will contain the signers
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