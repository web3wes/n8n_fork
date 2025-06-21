#!/usr/bin/env node

/**
 * n8n Workflow Structure Analysis Script
 *
 * This script implements Step 2 of the Text-to-Workflow Knowledge Core:
 * - Analyzes workflow JSON structure and patterns
 * - Documents node connections and data flow
 * - Identifies common workflow patterns
 *
 * Based on the theoretical framework in docs/text-to-workflow-research.md
 */

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function analyzeWorkflowStructure(workflowData) {
	const analysis = {
		meta: workflowData.meta || {},
		nodeCount: workflowData.nodes ? workflowData.nodes.length : 0,
		nodes: [],
		connections: workflowData.connections || {},
		connectionCount: 0,
		patterns: {
			triggers: [],
			actions: [],
			transformations: [],
			helpers: [],
		},
		dataFlow: [],
	};

	// Analyze nodes
	if (workflowData.nodes) {
		workflowData.nodes.forEach((node) => {
			const nodeAnalysis = {
				id: node.id,
				name: node.name,
				type: node.type,
				typeVersion: node.typeVersion,
				position: node.position,
				parameters: node.parameters || {},
				parameterCount: Object.keys(node.parameters || {}).length,
				hasCredentials: !!node.credentials,
				disabled: !!node.disabled,
			};

			analysis.nodes.push(nodeAnalysis);

			// Categorize by type pattern
			if (node.type.includes('trigger') || node.type.includes('Trigger')) {
				analysis.patterns.triggers.push(node.name);
			} else if (
				node.type.includes('Set') ||
				node.type.includes('Code') ||
				node.type.includes('Function') ||
				node.type.includes('Transform')
			) {
				analysis.patterns.transformations.push(node.name);
			} else if (
				node.type.includes('NoOp') ||
				node.type.includes('Wait') ||
				node.type.includes('Split')
			) {
				analysis.patterns.helpers.push(node.name);
			} else {
				analysis.patterns.actions.push(node.name);
			}
		});
	}

	// Analyze connections
	Object.keys(analysis.connections).forEach((sourceNode) => {
		const connections = analysis.connections[sourceNode];
		Object.keys(connections).forEach((outputType) => {
			const outputs = connections[outputType];
			outputs.forEach((outputArray) => {
				outputArray.forEach((connection) => {
					analysis.connectionCount++;
					analysis.dataFlow.push({
						from: sourceNode,
						to: connection.node,
						type: connection.type,
						index: connection.index,
					});
				});
			});
		});
	});

	return analysis;
}

function findWorkflowFiles() {
	const patterns = [
		'packages/nodes-base/nodes/**/test/*.workflow.json',
		'packages/@n8n/nodes-langchain/nodes/**/test/*.workflow.json',
	];

	let files = [];
	patterns.forEach((pattern) => {
		files = files.concat(glob.sync(pattern));
	});

	return files.slice(0, 10); // Limit to first 10 for analysis
}

async function analyzeWorkflows() {
	console.log('🔍 Starting n8n Workflow Structure Analysis');
	console.log('This analysis implements Step 2 of the Knowledge Core foundation');

	const workflowFiles = findWorkflowFiles();
	console.log(`📁 Found ${workflowFiles.length} workflow files to analyze`);

	const analyses = [];
	const summary = {
		totalWorkflows: 0,
		totalNodes: 0,
		totalConnections: 0,
		commonPatterns: {
			triggers: new Set(),
			actions: new Set(),
			transformations: new Set(),
			helpers: new Set(),
		},
		nodeTypes: new Map(),
		averageNodesPerWorkflow: 0,
		averageConnectionsPerWorkflow: 0,
	};

	for (const file of workflowFiles) {
		try {
			const workflowData = JSON.parse(fs.readFileSync(file, 'utf8'));
			const analysis = analyzeWorkflowStructure(workflowData);

			analysis.sourceFile = path.relative(process.cwd(), file);
			analyses.push(analysis);

			// Update summary
			summary.totalWorkflows++;
			summary.totalNodes += analysis.nodeCount;
			summary.totalConnections += analysis.connectionCount;

			// Track patterns
			analysis.patterns.triggers.forEach((t) => summary.commonPatterns.triggers.add(t));
			analysis.patterns.actions.forEach((a) => summary.commonPatterns.actions.add(a));
			analysis.patterns.transformations.forEach((t) =>
				summary.commonPatterns.transformations.add(t),
			);
			analysis.patterns.helpers.forEach((h) => summary.commonPatterns.helpers.add(h));

			// Track node types
			analysis.nodes.forEach((node) => {
				const count = summary.nodeTypes.get(node.type) || 0;
				summary.nodeTypes.set(node.type, count + 1);
			});
		} catch (error) {
			console.warn(`⚠️  Could not analyze ${file}: ${error.message}`);
		}
	}

	// Calculate averages
	if (summary.totalWorkflows > 0) {
		summary.averageNodesPerWorkflow = Math.round(summary.totalNodes / summary.totalWorkflows);
		summary.averageConnectionsPerWorkflow = Math.round(
			summary.totalConnections / summary.totalWorkflows,
		);
	}

	// Convert Sets to Arrays for JSON serialization
	summary.commonPatterns.triggers = Array.from(summary.commonPatterns.triggers);
	summary.commonPatterns.actions = Array.from(summary.commonPatterns.actions);
	summary.commonPatterns.transformations = Array.from(summary.commonPatterns.transformations);
	summary.commonPatterns.helpers = Array.from(summary.commonPatterns.helpers);

	// Convert Map to Object
	summary.topNodeTypes = Array.from(summary.nodeTypes.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([type, count]) => ({ type, count }));
	delete summary.nodeTypes;

	// Save results
	const timestamp = new Date().toISOString();

	// Detailed analysis
	fs.writeFileSync(
		path.join(OUTPUT_DIR, 'workflow-analyses.json'),
		JSON.stringify(analyses, null, 2),
	);

	// Summary report
	const summaryReport = {
		meta: {
			timestamp,
			analysisType: 'workflow-structure',
		},
		summary,
	};

	fs.writeFileSync(
		path.join(OUTPUT_DIR, 'workflow-summary.json'),
		JSON.stringify(summaryReport, null, 2),
	);

	// Generate markdown report
	const markdownReport = generateMarkdownReport(summaryReport);
	fs.writeFileSync(path.join(OUTPUT_DIR, 'workflow-analysis-summary.md'), markdownReport);

	console.log('✅ Workflow analysis complete!');
	console.log(`📊 Analyzed ${summary.totalWorkflows} workflows`);
	console.log(`📝 Results saved to ${OUTPUT_DIR}`);

	return summaryReport;
}

function generateMarkdownReport(report) {
	const { summary } = report;

	return `# n8n Workflow Structure Analysis

**Generated:** ${report.meta.timestamp}
**Total Workflows Analyzed:** ${summary.totalWorkflows}

## Workflow Statistics

- **Total Nodes:** ${summary.totalNodes}
- **Total Connections:** ${summary.totalConnections}
- **Average Nodes per Workflow:** ${summary.averageNodesPerWorkflow}
- **Average Connections per Workflow:** ${summary.averageConnectionsPerWorkflow}

## Common Workflow Patterns

### Triggers (${summary.commonPatterns.triggers.length})
${summary.commonPatterns.triggers.map((t) => `- ${t}`).join('\n')}

### Actions (${summary.commonPatterns.actions.length})
${summary.commonPatterns.actions
	.slice(0, 10)
	.map((a) => `- ${a}`)
	.join('\n')}
${summary.commonPatterns.actions.length > 10 ? `\n...and ${summary.commonPatterns.actions.length - 10} more` : ''}

### Transformations (${summary.commonPatterns.transformations.length})
${summary.commonPatterns.transformations.map((t) => `- ${t}`).join('\n')}

### Helpers (${summary.commonPatterns.helpers.length})
${summary.commonPatterns.helpers.map((h) => `- ${h}`).join('\n')}

## Top Node Types

${summary.topNodeTypes.map((item, index) => `${index + 1}. **${item.type}** (${item.count} instances)`).join('\n')}

## Workflow Generation Insights

Based on this analysis, the text-to-workflow system should:

1. **Recognize common patterns**: Most workflows follow trigger → action/transformation → output patterns
2. **Handle node connections**: Average of ${summary.averageConnectionsPerWorkflow} connections per workflow
3. **Support parameterization**: Most nodes have configurable parameters
4. **Consider workflow size**: Average workflow has ${summary.averageNodesPerWorkflow} nodes

## Next Steps for Knowledge Core

- [ ] Create workflow template library based on common patterns
- [ ] Build connection logic rules from data flow analysis
- [ ] Develop parameter mapping system
- [ ] Create workflow validation rules

`;
}

// Run the analysis
if (require.main === module) {
	analyzeWorkflows().catch(console.error);
}

module.exports = { analyzeWorkflows, analyzeWorkflowStructure };
