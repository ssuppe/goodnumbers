#!/bin/bash
# Pre-req: npm install -g madge
echo "🔍 Analyzing dependency graph for cycles..."
# We check the source directories to catch logic cycles before compilation
npx madge --circular --extensions ts packages/types/src packages/schemas/src packages/common/src