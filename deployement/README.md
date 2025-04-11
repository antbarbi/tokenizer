# Deployement

## Setup

### Create an account for mint authority:
```bash
solana-keygen grind --starts-with perso:1
```

### Set the account as the default keypair:
```bash
solana config set --keypair your-token-acount.json
```

### Change to devnet:
```bash
solana config set --url devnet
```
If we do `solana config get` we can see that the URL is set to devnet which is our testing and free pipeline

### Get some SOL:

In order to be able to mint some coins we need to have some SOL, with devnet we are able to generate SOL from thin air with: 
- https://faucet.solana.com/  

We can check that with `solana balance` 

## Create our token

### Create a mint address:

```bash
solana-keygen grind --starts-with mnt:1
```

### Minting our token:

This command will `create-token`:
1. `--program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`: specifies which token program to use.
1. `--enable-metadata`: allows our token to have additional information like name, symbol and image.
1. `--decimal`: sets the divisibility of your token

```
spl-token create-token \
--program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
--enable-metadata \
--decimals 9 \
mnt-your-mint-address.json
```

spl-token initialize-metadata mntkYVqttjx5cVTipjiDLVwtvR58W2ejCGY1mzb21Nk 42nug 42n <YOUR_TOKEN_URI>

# Ressources

- https://blog.networkchuck.com/posts/create-a-solana-token/
- https://solana.com/docs/core
