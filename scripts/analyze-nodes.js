#!/usr/bin/env node

/**
 * n8n Node Architecture Analysis Script
 *
 * This script implements Step 1 of the Text-to-Workflow Knowledge Core:
 * - Fetches all available nodes from /types/nodes.json
 * - Analyzes node structure and categorization
 * - Generates comprehensive documentation for AI training
 *
 * Based on the theoretical framework in docs/text-to-workflow-research.md
 */

const fs = require('fs');
const path = require('path');

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchNodes() {
	try {
		console.log('🔍 Fetching nodes from n8n instance...');
		const response = await fetch(`${N8N_BASE_URL}/types/nodes.json`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const nodes = await response.json();
		console.log(`✅ Successfully fetched ${nodes.length} node definitions`);
		return nodes;
	} catch (error) {
		console.error('❌ Error fetching nodes:', error.message);
		process.exit(1);
	}
}

function categorizeNodes(nodes) {
	const categories = {
		triggers: [],
		actions: [],
		transformations: [],
		helpers: [],
	};

	const groupMapping = {
		trigger: 'triggers',
		input: 'actions',
		output: 'actions',
		transform: 'transformations',
	};

	nodes.forEach((node) => {
		const primaryGroup = node.group && node.group[0];
		const category = groupMapping[primaryGroup] || 'helpers';

		categories[category].push({
			name: node.name,
			displayName: node.displayName,
			description: node.description,
			group: node.group,
			properties: node.properties ? node.properties.length : 0,
			codex: node.codex,
		});
	});

	return categories;
}

function generateNodeDocuments(nodes) {
	console.log('📝 Generating rich node documents for vector embedding...');

	const documents = nodes.map((node) => {
		// Create rich text document as specified in the framework
		let document = `Node: ${node.displayName} (${node.name})\n\n`;
		document += `Description: ${node.description}\n\n`;

		if (node.codex && node.codex.categories) {
			document += `Categories: ${node.codex.categories.join(', ')}\n\n`;
		}

		if (node.properties && node.properties.length > 0) {
			document += `Parameters:\n`;
			node.properties.forEach((prop) => {
				if (prop.displayName && prop.description) {
					document += `- ${prop.displayName}: ${prop.description}\n`;
				}
			});
			document += '\n';
		}

		if (node.group) {
			document += `Node Type: ${node.group.join(', ')}\n\n`;
		}

		// Add use case context
		const useCases = generateUseCases(node);
		if (useCases.length > 0) {
			document += `Common Use Cases: ${useCases.join(', ')}\n\n`;
		}

		return {
			nodeId: node.name,
			displayName: node.displayName,
			document: document.trim(),
			metadata: {
				group: node.group,
				categories: node.codex ? node.codex.categories : [],
				parameterCount: node.properties ? node.properties.length : 0,
			},
		};
	});

	return documents;
}

function generateUseCases(node) {
	const useCases = [];
	const name = node.name.toLowerCase();
	const displayName = node.displayName.toLowerCase();

	// Pattern matching for common use cases based on node type
	if (name.includes('trigger') || name.includes('webhook')) {
		useCases.push('workflow automation triggers', 'event-driven processes');
	}

	if (name.includes('slack')) {
		useCases.push('team notifications', 'message posting', 'channel management');
	}

	if (name.includes('gmail') || name.includes('email')) {
		useCases.push('email automation', 'notifications', 'communication workflows');
	}

	if (name.includes('airtable') || name.includes('sheets') || name.includes('database')) {
		useCases.push('data management', 'record updates', 'spreadsheet automation');
	}

	if (name.includes('http') || name.includes('api')) {
		useCases.push('API integrations', 'web requests', 'data fetching');
	}

	if (name.includes('if') || name.includes('switch') || name.includes('condition')) {
		useCases.push('conditional logic', 'decision making', 'workflow branching');
	}

	return useCases;
}

function generateAnalysisReport(nodes, categories, documents) {
	const report = {
		meta: {
			timestamp: new Date().toISOString(),
			totalNodes: nodes.length,
			n8nInstance: N8N_BASE_URL,
		},
		summary: {
			nodeCategories: Object.keys(categories).map((key) => ({
				category: key,
				count: categories[key].length,
				examples: categories[key].slice(0, 5).map((n) => n.displayName),
			})),
			topServices: getTopServices(nodes),
			parameterDistribution: getParameterDistribution(nodes),
		},
		knowledgeBase: {
			totalDocuments: documents.length,
			avgDocumentLength: Math.round(
				documents.reduce((sum, doc) => sum + doc.document.length, 0) / documents.length,
			),
			readyForVectorization: true,
		},
	};

	return report;
}

function getTopServices(nodes) {
	const serviceCount = {};

	nodes.forEach((node) => {
		const serviceName = node.displayName.replace(/\s+(Trigger|Node)$/i, '');
		serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
	});

	return Object.entries(serviceCount)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 20)
		.map(([service, count]) => ({ service, count }));
}

function getParameterDistribution(nodes) {
	const distribution = {};

	nodes.forEach((node) => {
		const paramCount = node.properties ? node.properties.length : 0;
		const bucket =
			paramCount === 0
				? '0'
				: paramCount <= 10
					? '1-10'
					: paramCount <= 50
						? '11-50'
						: paramCount <= 100
							? '51-100'
							: '100+';

		distribution[bucket] = (distribution[bucket] || 0) + 1;
	});

	return distribution;
}

async function saveResults(categories, documents, report) {
	console.log('💾 Saving analysis results...');

	// Save categorized nodes
	fs.writeFileSync(
		path.join(OUTPUT_DIR, 'node-categories.json'),
		JSON.stringify(categories, null, 2),
	);

	// Save vector-ready documents
	fs.writeFileSync(
		path.join(OUTPUT_DIR, 'node-documents.json'),
		JSON.stringify(documents, null, 2),
	);

	// Save analysis report
	fs.writeFileSync(path.join(OUTPUT_DIR, 'analysis-report.json'), JSON.stringify(report, null, 2));

	// Save markdown summary
	const markdown = generateMarkdownSummary(report);
	fs.writeFileSync(path.join(OUTPUT_DIR, 'node-analysis-summary.md'), markdown);

	console.log(`✅ Analysis complete! Results saved to ${OUTPUT_DIR}`);
	console.log(`📊 Summary: ${report.meta.totalNodes} nodes analyzed`);
	console.log(`📝 Generated ${documents.length} documents ready for vector embedding`);
}

function generateMarkdownSummary(report) {
	let md = `# n8n Node Architecture Analysis\n\n`;
	md += `**Generated:** ${report.meta.timestamp}\n`;
	md += `**n8n Instance:** ${report.meta.n8nInstance}\n`;
	md += `**Total Nodes:** ${report.meta.totalNodes}\n\n`;

	md += `## Node Categories\n\n`;
	report.summary.nodeCategories.forEach((cat) => {
		md += `### ${cat.category.charAt(0).toUpperCase() + cat.category.slice(1)} (${cat.count})\n`;
		md += `Examples: ${cat.examples.join(', ')}\n\n`;
	});

	md += `## Top Services\n\n`;
	report.summary.topServices.slice(0, 10).forEach((service, i) => {
		md += `${i + 1}. **${service.service}** (${service.count} nodes)\n`;
	});

	md += `\n## Parameter Distribution\n\n`;
	Object.entries(report.summary.parameterDistribution).forEach(([bucket, count]) => {
		md += `- **${bucket} parameters:** ${count} nodes\n`;
	});

	md += `\n## Knowledge Base Status\n\n`;
	md += `- 📄 **Documents Generated:** ${report.knowledgeBase.totalDocuments}\n`;
	md += `- 📏 **Average Document Length:** ${report.knowledgeBase.avgDocumentLength} characters\n`;
	md += `- ✅ **Ready for Vector Embedding:** ${report.knowledgeBase.readyForVectorization}\n`;

	return md;
}

// Main execution
async function main() {
	console.log('🚀 Starting n8n Node Architecture Analysis\n');
	console.log('This analysis implements the Knowledge Core foundation');
	console.log('as described in the Text-to-Workflow framework.\n');

	try {
		const nodes = await fetchNodes();
		const categories = categorizeNodes(nodes);
		const documents = generateNodeDocuments(nodes);
		const report = generateAnalysisReport(nodes, categories, documents);

		await saveResults(categories, documents, report);

		console.log('\n🎯 Next Steps:');
		console.log('1. Review the generated analysis in docs/analysis/');
		console.log('2. Use node-documents.json for vector embedding');
		console.log('3. Integrate with the Knowledge Core Service');
		console.log('4. Begin implementing the multi-stage generation pipeline');
	} catch (error) {
		console.error('❌ Analysis failed:', error.message);
		process.exit(1);
	}
}

// Handle Node.js version compatibility for fetch
if (typeof fetch === 'undefined') {
	global.fetch = require('node-fetch');
}

main();
