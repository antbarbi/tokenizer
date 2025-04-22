# fizzbuzz
# Built with Seahorse v0.2.0
#
# On-chain, persistent FizzBuzz!

from seahorse.prelude import *

declare_id('8k8YvtXV17HHc4EVpRa6P2A29w2FunZYNhTdtDqRujnN')

class Multisig(Account):
    signer1: Pubkey
    signer2: Pubkey  
    threshold: u8
    bump: u8

class MintProposal(Account):
    mint: Pubkey                # Mint to use
    recipient: Pubkey           # Recipient account
    amount: u64                 # Amount to mint
    approvals: u8               # Number of approvals received
    is_executed: bool           # Whether the proposal was executed
    approved_by_1: bool         # Track if signer1 approved
    approved_by_2: bool         # Track if signer2 approved  
    bump: u8                    # Bump seed for the PDA

class InviteProposal(Account):
    invitee: Pubkey
    godfather: Pubkey
    is_executed: bool           # Whether the proposal was executed
    approved_by_1: bool         # Track if signer1 approved
    approved_by_2: bool         # Track if signer2 approved  
    approvals: u8
    bump: u8                    # Bump seed for the PDA

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
    new_token_account: Empty[TokenAccount],
    signer1: Pubkey,
    signer2: Pubkey,
    threshold: u8,
    payer: Signer
):
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
    multisig.bump = bump

    new_token_account.init(
      payer = signer,
      seeds = ['top-token-account'],
      mint = mint,
      authority = multisig
    )

@instruction
def invite(
  invite: Empty[InviteProposal],
  invitee: Pubkey,  # Changed from Signer to Pubkey
  godfather_acc: TokenAccount,
  godfather_signer: Signer,
  mint: TokenMint, #Unused
  multisig: Multisig #Unused
):
  bump = invite.bump()

  proposal = invite.init(
    payer = godfather_signer,
    seeds = ['invite-proposal', invitee]  # Fixed: seed → seeds
  )

  proposal.invitee = invitee
  proposal.godfather = godfather_acc.key()
  proposal.is_executed = False
  proposal.approved_by_1 = False
  proposal.approved_by_2 = False
  proposal.approvals = 0  # Initialize to zero
  proposal.bump = bump


@instruction
def approve_invite(  # Added new instruction
  invite: InviteProposal,
  multisig: Multisig,
  signer: Signer
):
  assert not invite.is_executed, "Proposal already executed"
  
  is_signer1 = signer.key() == multisig.signer1
  is_signer2 = signer.key() == multisig.signer2
  
  assert is_signer1 or is_signer2, "Not an authorized signer"
  
  if is_signer1 and not invite.approved_by_1:
      invite.approved_by_1 = True
      invite.approvals += 1
  
  if is_signer2 and not invite.approved_by_2:
      invite.approved_by_2 = True
      invite.approvals += 1

@instruction
def execute_invite(
  invite: InviteProposal,
  mint: TokenMint,
  invitee_token_account: Empty[TokenAccount],  # Empty account to initialize
  godfather_token_account: TokenAccount,  # Existing token account
  multisig: Multisig,
  executor: Signer,  # Fixed typo
  rent_receiver: Signer  # Who gets rent back
):
  # Verify proposal state
  assert not invite.is_executed, "Proposal already executed"
  assert invite.approvals >= multisig.threshold, "Not enough approvals"
  
  # Initialize invitee's token account
  invitee_token_account.init(
    payer = executor,
    seeds = ['token-account', invite.invitee],
    mint = mint,
    authority = invite.invitee  # The invitee controls their own account
  )
  
  # Mint reward to godfather's token account
  mint.mint(
    authority = multisig,
    to = godfather_token_account,
    amount = 2 * 10_000,
    signer_seeds = ['multisig', multisig.bump]
  )

  # Mint welcome tokens to invitee's new token account
  mint.mint(
    authority = multisig,
    to = invitee_token_account,
    amount = 1 * 10_000,
    signer_seeds = ['multisig', multisig.bump]
  )

  # Mark as executed
  invite.is_executed = True
  
  # Return rent to specified receiver
  invite.close(rent_receiver)