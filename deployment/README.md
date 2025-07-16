# Deployment Guide

This guide provides step-by-step instructions for deploying and testing the 42nug token program on Solana.

## Quick Start

**Web-based Development (Recommended for beginners):**
- Visit [Solana Playground](https://beta.solpg.io/)
- No local installation required
- Built-in wallet and devnet funding

## Environment Setup

1. **Launch [Solana Test Validator](https://solana.com/developers/guides/getstarted/solana-test-validator)** 

    At the root of the project 
    ```bash
    docker compose up
    ```

1. **Access Playground**
   ```
   https://beta.solpg.io/
   ```

2. **Import Project**
   - manually import `code` or `bonus` in SolanaPlayground

3. **Configure Environment**
   - Select Solana Localhost (gear, bottom left)
   - Click on `not connected` next to the gear and follow instructions
   - Generate 3 playground wallets on the top right (wallet1, wallet2, wallet3)

## Deployment Process

### Step 1: Build the Program

**Solana Playground:**
- Click "Build" button in the IDE
- Check build output for any errors

### Step 2: Deploy to Localhost

**Solana Playground:**
- Click "Deploy" button
- Confirm transaction in built-in wallet

## Testing the Program

Tests are already provided in `code` and `bonus`, in SolanaPlayground click on `run` in the IDE.

## Support Resources

### Documentation
- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://book.anchor-lang.com/)
- [SPL Token Guide](https://spl.solana.com/token)

### Community
- [Solana Discord](https://discord.gg/solana)
- [Anchor Discord](https://discord.gg/anchor)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/solana)

### Tools
- [Solana Explorer](https://explorer.solana.com/)
- [Solana Playground](https://beta.solpg.io/)
- [Sol Faucet](https://faucet.solana.com/)
