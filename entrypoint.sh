#!/bin/zsh
set -e

# Copy id.json to mounted volume if /mnt exists
if [ -d "/mnt" ]; then
  cp /root/.config/solana/id.json /mnt
fi

echo "Starting Solana test validator..."

# Kill any existing validator
pkill -f solana-test-validator || true
sleep 2

# Start simple validator (no Metaplex needed!)
echo "Starting clean validator for Token Extensions..."
solana-test-validator --reset --quiet &

VALIDATOR_PID=$!

# Wait for validator to start
echo "Waiting for validator to start..."
sleep 10

# Test if validator is running
if ps -p $VALIDATOR_PID > /dev/null; then
  echo "✅ Validator started successfully"
else
  echo "❌ Validator failed to start"
  exit 1
fi

# Set RPC URL
solana config set --url localhost

# Test connection
echo "Testing RPC connection..."
if solana epoch-info > /dev/null 2>&1; then
  echo "✅ RPC connection successful"
else
  echo "❌ RPC connection failed"
fi

# Keep container running
exec /bin/zsh