#!/bin/bash
# scripts/security-check.sh

EXIT_CODE=0

# 1. Check for accidental exposure of "Password" or "Secret" in shared types
echo "🔍 Scanning shared types for sensitive keywords..."
if grep -rEi "password|secret|token|key" packages/types/src; then
  echo "⚠️  WARNING: Sensitive keywords found in shared types. Verify these are not actual secrets or internal fields."
  # We warn but don't fail, as 'token' might be 'sessionToken' (public) vs 'apiSecret' (private)
fi

# 2. Verify private: true in all packages
echo "🔍 Verifying package privacy..."
for pkg in packages/*; do
  if [ -f "$pkg/package.json" ]; then
    if ! grep -q '"private": true' "$pkg/package.json"; then
      echo "❌ ERROR: $pkg is not marked private! This is a supply chain risk."
      EXIT_CODE=1
    fi
  fi
done

exit $EXIT_CODE
