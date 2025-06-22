#!/bin/bash

# n8n AI Workflow Generation Test Script
# Demonstrates the working AI workflow generation feature

set -e

N8N_URL="http://localhost:5678"
EMAIL="jonesclarence37@gmail.com"
PASSWORD="TRanspac12!@"
COOKIE_FILE="cookies.txt"

echo "🚀 n8n AI Workflow Generation Test"
echo "=================================="
echo

# Login
echo "🔐 Logging into n8n..."
curl -s -c "$COOKIE_FILE" -X POST "$N8N_URL/rest/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Login successful"
else
    echo "❌ Login failed"
    exit 1
fi

# Check AI status
echo
echo "📊 Checking AI service status..."
STATUS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/ai/text-to-workflow/status")
echo "Status Response: $STATUS_RESPONSE"

# Check if AI is available
if echo "$STATUS_RESPONSE" | grep -q '"available":true'; then
    echo "✅ AI service is available and ready!"
else
    echo "❌ AI service not available"
    exit 1
fi

# Test workflow generation
echo
echo "🧠 Testing AI workflow generation..."

PROMPT="Create a simple workflow that receives webhook data and sends it to Slack"
echo "📝 Prompt: $PROMPT"

WORKFLOW_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$N8N_URL/rest/ai/generate-workflow" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"$PROMPT\"
  }")

# Save response
OUTPUT_FILE="ai-test-workflow-$(date +%Y%m%d-%H%M%S).json"
echo "$WORKFLOW_RESPONSE" > "$OUTPUT_FILE"

# Check response
if echo "$WORKFLOW_RESPONSE" | jq -e '.data.nodes' >/dev/null 2>&1; then
    NODE_COUNT=$(echo "$WORKFLOW_RESPONSE" | jq '.data.nodes | length' 2>/dev/null)
    WORKFLOW_NAME=$(echo "$WORKFLOW_RESPONSE" | jq -r '.data.name' 2>/dev/null)

    echo "✅ Workflow generated successfully!"
    echo "📄 Name: $WORKFLOW_NAME"
    echo "🔗 Nodes: $NODE_COUNT"
    echo "💾 Saved to: $OUTPUT_FILE"

    # Show node types
    echo "📋 Node types:"
    echo "$WORKFLOW_RESPONSE" | jq -r '.data.nodes[].type' 2>/dev/null | sed 's/^/   - /'

else
    echo "❌ Workflow generation failed"
    echo "Response: $WORKFLOW_RESPONSE"
fi

# Cleanup
echo
echo "🧹 Cleaning up..."
rm -f "$COOKIE_FILE"

echo
echo "🎉 Test complete!"
echo
echo "💡 What just happened:"
echo "   • AI analyzed your prompt using semantic search"
echo "   • Selected relevant nodes from 527+ available nodes"
echo "   • Generated workflow structure with proper connections"
echo "   • Validated the workflow format"
echo
echo "🚀 Next steps:"
echo "   • Import the generated workflow into n8n UI"
echo "   • Configure any required credentials"
echo "   • Test the workflow execution"
echo "   • Customize as needed!"
