#!/bin/bash

echo "Tool Router Implementation Test"
echo "================================"
echo ""

echo "1. Checking dependencies..."
if npm list @modelcontextprotocol/sdk > /dev/null 2>&1; then
  echo "   ✓ @modelcontextprotocol/sdk installed"
else
  echo "   ✗ @modelcontextprotocol/sdk not found"
  exit 1
fi

if npm list composio-core > /dev/null 2>&1; then
  echo "   ✓ composio-core installed"
else
  echo "   ✗ composio-core not found"
  exit 1
fi

echo ""
echo "2. Checking environment..."
if [ -f .env.local ]; then
  echo "   ✓ .env.local exists"
  if grep -q "COMPOSIO_API_KEY" .env.local; then
    echo "   ✓ COMPOSIO_API_KEY configured"
  else
    echo "   ✗ COMPOSIO_API_KEY not found in .env.local"
    echo "     Add: COMPOSIO_API_KEY=your-api-key"
  fi
else
  echo "   ✗ .env.local not found"
  echo "     Copy example.env.local to .env.local"
fi

echo ""
echo "3. Checking file structure..."
files=(
  "convex/schema.ts"
  "convex/crons.ts"
  "convex/lib/toolRouterClient.ts"
  "convex/lib/getToolRouterClient.ts"
  "convex/toolRouter/sessions.ts"
  "convex/toolRouter/tasks.ts"
  "convex/workers/twitterMonitor.ts"
  "src/app/api/tool-router/create-session/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ✗ $file missing"
  fi
done

echo ""
echo "4. Next steps:"
echo "   - Add COMPOSIO_API_KEY to .env.local"
echo "   - Run: npx convex dev"
echo "   - Test: curl -X POST http://localhost:3000/api/tool-router/create-session \\"
echo "           -H 'Content-Type: application/json' \\"
echo "           -d '{\"userId\":\"test_user\",\"toolkits\":[]}'"
echo ""
echo "See NEXT_STEPS.md for complete guide"
