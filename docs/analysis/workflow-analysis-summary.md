# n8n Workflow Structure Analysis

**Generated:** 2025-06-21T18:04:10.461Z
**Total Workflows Analyzed:** 10

## Workflow Statistics

- **Total Nodes:** 94
- **Total Connections:** 84
- **Average Nodes per Workflow:** 9
- **Average Connections per Workflow:** 8

## Common Workflow Patterns

### Triggers (2)
- When clicking "Execute Workflow"
- When clicking ‘Test workflow’

### Actions (80)
- Sample Data
- Run Once for All Items
- Run Once for All Items (Legacy Syntax)
- Run Once for Each Item
- Run Once for Each Item  (Legacy Syntax)
- Crypto Hash into Hex
- Crypto Hash into MD5
- Crypto Sign data with RSA-MD5
- Crypto Hmac data with MD5
- Crypto Generate UUID

...and 70 more

### Transformations (0)


### Helpers (0)


## Top Node Types

1. **n8n-nodes-base.manualTrigger** (10 instances)
2. **n8n-nodes-base.convertToFile** (10 instances)
3. **n8n-nodes-base.extractFromFile** (10 instances)
4. **n8n-nodes-base.set** (9 instances)
5. **n8n-nodes-base.jwt** (9 instances)
6. **n8n-nodes-base.noOp** (8 instances)
7. **n8n-nodes-base.code** (7 instances)
8. **n8n-nodes-base.crypto** (7 instances)
9. **n8n-nodes-base.html** (7 instances)
10. **n8n-nodes-base.moveBinaryData** (7 instances)

## Workflow Generation Insights

Based on this analysis, the text-to-workflow system should:

1. **Recognize common patterns**: Most workflows follow trigger → action/transformation → output patterns
2. **Handle node connections**: Average of 8 connections per workflow
3. **Support parameterization**: Most nodes have configurable parameters
4. **Consider workflow size**: Average workflow has 9 nodes

## Next Steps for Knowledge Core

- [ ] Create workflow template library based on common patterns
- [ ] Build connection logic rules from data flow analysis
- [ ] Develop parameter mapping system
- [ ] Create workflow validation rules

