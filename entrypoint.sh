#!/bin/zsh
set -e

# Copy id.json to mounted volume if /mnt exists
if [ -d "/mnt" ]; then
  cp /root/.config/solana/id.json /mnt
fi

echo "Starting Solana test validator with Metaplex programs..."

# Kill any existing validator
pkill -f solana-test-validator || true
sleep 2

# Start the validator by cloning Metaplex from mainnet
echo "Starting validator and cloning Metaplex Token Metadata program from mainnet..."
solana-test-validator \
  --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  --url https://api.mainnet-beta.solana.com \
  --reset \
  --quiet &

VALIDATOR_PID=$!

# Wait longer for the program to be cloned from mainnet
echo "Waiting for validator to start and clone program from mainnet..."
sleep 30

# Test if validator is running
if ps -p $VALIDATOR_PID > /dev/null; then
  echo "✅ Validator started successfully"
else
  echo "❌ Validator failed to start"
  exit 1
fi

# Set RPC URL
solana config set --url localhost

# Test connection and program deployment
echo "Testing RPC connection and Metaplex deployment..."
if solana epoch-info > /dev/null 2>&1; then
  echo "✅ RPC connection successful"
  
  # Test if Metaplex program is actually deployed
  if solana program show metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s > /dev/null 2>&1; then
    echo "✅ Metaplex Token Metadata program is deployed and cloned from mainnet"
    # Show program details
    solana program show metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
  else
    echo "❌ Metaplex program not properly deployed"
  fi
else
  echo "❌ RPC connection failed"
fi

echo ""
echo "Container ready!"
echo "Metaplex Token Metadata Program: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"

# Keep container running
exec /bin/zsh