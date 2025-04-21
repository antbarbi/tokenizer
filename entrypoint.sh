#!/bin/zsh
set -e

# Copy id.json to mounted volume if /data exists
if [ -d "/data" ]; then
  cp /root/.config/solana/id.json /data/
fi

# Start the validator
exec solana-test-validator