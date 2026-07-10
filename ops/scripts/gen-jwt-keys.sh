#!/usr/bin/env bash
# gen-jwt-keys.sh — Generate RSA 2048 JWT key pair for ELMS production
# Usage: ./scripts/gen-jwt-keys.sh
# Copy the output lines directly into .env.production

set -euo pipefail

TMP_PRIV=$(mktemp)
TMP_PUB=$(mktemp)

cleanup() {
  rm -f "$TMP_PRIV" "$TMP_PUB"
}
trap cleanup EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$TMP_PRIV" 2>/dev/null
openssl rsa -pubout -in "$TMP_PRIV" -out "$TMP_PUB" 2>/dev/null

# Format the PEM as a single-line value with \n separators (suitable for .env files)
format_pem() {
  awk '{printf "%s\\n", $0}' "$1"
}

echo ""
echo "# ── Paste these into ops/.env.production ───────────────────────────────────"
echo "JWT_PRIVATE_KEY=\"$(format_pem "$TMP_PRIV")\""
echo "JWT_PUBLIC_KEY=\"$(format_pem "$TMP_PUB")\""
echo ""
echo "# Keys generated successfully. Treat JWT_PRIVATE_KEY as a secret."
