#!/bin/zsh
set -e

# Copy id.json to mounted volume if /data exists
if [ -d "/mnt" ]; then
  cp /root/.config/solana/id.json /mnt
fi

# Start the validator with the Metaplex Token Metadata program
exec solana-test-validator \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /root/program-bins/mpl_token_metadata.so \
  --reset