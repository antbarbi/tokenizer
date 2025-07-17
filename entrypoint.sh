#!/bin/zsh
set -e

# Copy id.json to mounted volume if /mnt exists
if [ -d "/mnt" ]; then
  cp /root/.config/solana/id.json /mnt
fi

echo "Starting Solana test validator with Metaplex programs..."

# Start the validator with Metaplex programs in background
solana-test-validator \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s /root/program-bins/mpl_token_metadata.so \
  --bpf-program auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg /root/program-bins/mpl_token_auth_rules.so \
  --reset &

# Wait for validator to start
sleep 5

echo "✅ Validator started with Metaplex programs loaded"
echo "📝 Token Metadata Program: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
echo "🔐 Token Auth Rules Program: auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg"
echo ""
echo "To test Metaplex availability, run:"
echo "  solana program show metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
echo ""

# Keep container running with interactive shell
exec /bin/zsh