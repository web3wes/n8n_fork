#!/bin/bash

# n8n Workflow Generation Test Script
# Uses curl with cookie-based authentication

set -e  # Exit on any error

# Configuration
N8N_URL="http://localhost:5678"
EMAIL="jonesclarence37@gmail.com"
PASSWORD="TRanspac12!@"
COOKIE_FILE="cookies.txt"

echo "=== n8n Workflow Generation Test ==="
echo

# Step 1: Login and save cookies
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

# Step 2: Sync Knowledge Core
echo
echo "🔄 Syncing Knowledge Core..."
SYNC_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$N8N_URL/rest/ai/knowledge-core/sync" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Sync Response: $SYNC_RESPONSE"

# Step 3: Check text-to-workflow status
echo
echo "📊 Checking text-to-workflow status..."
STATUS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$N8N_URL/rest/ai/text-to-workflow/status")
echo "Status: $STATUS_RESPONSE"

# Step 4: Generate test workflows
echo
echo "🚀 Generating test workflows..."

# Test workflow prompts
declare -a PROMPTS=(
    "Build a workflow that monitors Google Drive for new files, analyzes them with OpenAI, and saves the results to Airtable"
    "Create a workflow that receives webhook data, processes it with a function, and sends notifications via Slack"
    "Build a workflow that gets customer data from a webhook, checks if they are premium users, and sends different emails based on their status"
    "Create an e-commerce workflow that processes new orders, updates inventory, sends confirmation emails, and logs everything"
)

# Generate workflows
for i in "${!PROMPTS[@]}"; do
    WORKFLOW_NUM=$((i + 1))
    echo
    echo "📝 Generating workflow $WORKFLOW_NUM..."
    echo "Prompt: ${PROMPTS[i]}"

    WORKFLOW_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$N8N_URL/rest/ai/generate-workflow" \
      -H "Content-Type: application/json" \
      -d "{
        \"prompt\": \"${PROMPTS[i]}\"
      }")

    # Save response to file
    OUTPUT_FILE="generated-workflow-$WORKFLOW_NUM-$(date +%Y%m%d-%H%M%S).json"
    echo "$WORKFLOW_RESPONSE" > "$OUTPUT_FILE"

    # Check if response is valid JSON and contains workflow data
    if echo "$WORKFLOW_RESPONSE" | jq empty 2>/dev/null; then
        NODE_COUNT=$(echo "$WORKFLOW_RESPONSE" | jq '.nodes | length' 2>/dev/null || echo "unknown")
        echo "✅ Workflow $WORKFLOW_NUM generated successfully"
        echo "   📄 Saved to: $OUTPUT_FILE"
        echo "   🔗 Nodes: $NODE_COUNT"

        # Show brief workflow summary
        if [ "$NODE_COUNT" != "unknown" ] && [ "$NODE_COUNT" -gt 0 ]; then
            echo "   📋 Node types:"
            echo "$WORKFLOW_RESPONSE" | jq -r '.nodes[].type' 2>/dev/null | sed 's/^/      - /' || echo "      - Unable to parse node types"
        fi
    else
        echo "❌ Workflow $WORKFLOW_NUM generation failed"
        echo "   Response: $WORKFLOW_RESPONSE"
    fi

    # Small delay between requests
    sleep 2
done

# Step 5: Test workflow import (if any workflows were generated)
echo
echo "🔍 Testing workflow import..."

# Find the most recently generated workflow file
LATEST_WORKFLOW=$(ls -t generated-workflow-*-*.json 2>/dev/null | head -n1)

if [ -n "$LATEST_WORKFLOW" ]; then
    echo "Testing import of: $LATEST_WORKFLOW"

    # Try to import the workflow
    IMPORT_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$N8N_URL/rest/workflows/import" \
      -H "Content-Type: application/json" \
      -d "@$LATEST_WORKFLOW")

    if echo "$IMPORT_RESPONSE" | jq empty 2>/dev/null; then
        echo "✅ Workflow import test successful"
        WORKFLOW_ID=$(echo "$IMPORT_RESPONSE" | jq -r '.id' 2>/dev/null)
        if [ "$WORKFLOW_ID" != "null" ] && [ -n "$WORKFLOW_ID" ]; then
            echo "   🆔 Imported workflow ID: $WORKFLOW_ID"
        fi
    else
        echo "❌ Workflow import test failed"
        echo "   Response: $IMPORT_RESPONSE"
    fi
else
    echo "⚠️  No workflow files found to test import"
fi

# Cleanup
echo
echo "🧹 Cleaning up..."
rm -f "$COOKIE_FILE"

echo
echo "=== Test Complete ==="
echo "📁 Generated workflow files:"
ls -la generated-workflow-*-*.json 2>/dev/null || echo "   No workflow files found"

echo
echo "💡 Tips:"
echo "   - Check the generated JSON files for workflow structure"
echo "   - Import successful workflows into n8n UI for testing"
echo "   - Monitor n8n logs if any workflows fail to import"
