const fs = require('fs');
const path = require('path');

console.log('🔍 Testing workflow parsing...');

const testFile = 'packages/nodes-base/nodes/Switch/V2/test/switch.rules.workflow.json';
console.log('📁 Testing file:', testFile);

try {
	const content = fs.readFileSync(testFile, 'utf8');
	const workflow = JSON.parse(content);

	console.log('✅ Valid JSON parsed');
	console.log('📊 Nodes:', workflow.nodes?.length || 0);
	console.log('🔗 Has connections:', !!workflow.connections);

	const switchNodes = workflow.nodes?.filter((n) => n.type === 'n8n-nodes-base.switch') || [];
	console.log('🔀 Switch nodes found:', switchNodes.length);

	if (switchNodes.length > 0) {
		const switchNode = switchNodes[0];
		console.log('📝 Switch details:');
		console.log('  - Name:', switchNode.name);
		console.log('  - Version:', switchNode.typeVersion);
		console.log('  - Rules:', switchNode.parameters?.rules?.rules?.length || 0);

		// Check connections
		const switchConnections = workflow.connections[switchNode.name];
		if (switchConnections && switchConnections.main) {
			console.log('🔗 Connection analysis:');
			console.log('  - Total outputs:', switchConnections.main.length);
			const filledOutputs = switchConnections.main.filter(
				(output) => output && output.length > 0,
			).length;
			console.log('  - Filled outputs:', filledOutputs);
			console.log(
				'  - All connected:',
				filledOutputs === switchConnections.main.length ? '✅' : '❌',
			);

			// Show each output
			switchConnections.main.forEach((output, index) => {
				if (output && output.length > 0) {
					console.log(`  - Output ${index}: → ${output[0].node}`);
				} else {
					console.log(`  - Output ${index}: ❌ EMPTY`);
				}
			});
		}
	}

	// Test our analysis function
	console.log('\n🧪 Testing analysis function...');

	function analyzeWorkflow(workflow, filePath) {
		try {
			if (!workflow.nodes || !Array.isArray(workflow.nodes)) return null;

			const nodes = workflow.nodes;
			const connections = workflow.connections || {};
			const nodeTypes = nodes.map((n) => n.type || 'unknown');
			const nodeCount = nodes.length;

			// Find Switch nodes and analyze their connections
			const switchNodes = nodes.filter((n) => n.type === 'n8n-nodes-base.switch');
			const switchCount = switchNodes.length;

			// Analyze connection patterns
			let connectionPattern = 'linear';
			if (switchCount > 0) {
				connectionPattern = 'switch_routing';

				// Analyze Switch connections
				for (const switchNode of switchNodes) {
					const switchConnections = connections[switchNode.name];
					if (switchConnections && switchConnections.main) {
						const outputCount = switchConnections.main.length;
						const filledOutputs = switchConnections.main.filter(
							(output) => output && output.length > 0,
						).length;

						if (filledOutputs === outputCount && outputCount > 1) {
							connectionPattern = 'switch_all_outputs_connected';
						} else if (filledOutputs < outputCount) {
							connectionPattern = 'switch_partial_outputs';
						}
					}
				}
			}

			// Create description
			const fileName = path.basename(filePath);
			const uniqueNodeTypes = [...new Set(nodeTypes.map((t) => t.replace('n8n-nodes-base.', '')))];

			let description = `Real n8n workflow from ${fileName}: `;
			description += `${nodeCount} nodes (${uniqueNodeTypes.slice(0, 5).join(', ')})`;

			if (switchCount > 0) {
				const switchDetails = switchNodes
					.map((s) => {
						const rules = s.parameters?.rules?.rules || [];
						const typeVersion = s.typeVersion || 1;
						return `Switch V${typeVersion} with ${rules.length} rules`;
					})
					.join(', ');
				description += `. Contains ${switchDetails}`;

				if (connectionPattern === 'switch_all_outputs_connected') {
					description += '. All Switch outputs properly connected to different nodes';
				} else if (connectionPattern === 'switch_partial_outputs') {
					description += '. Some Switch outputs missing connections (empty arrays)';
				}
			}

			description += `. Connection pattern: ${connectionPattern}`;

			return {
				description,
				nodeTypes: uniqueNodeTypes,
				connectionPattern,
				switchNodes: switchCount,
				nodeCount,
			};
		} catch (error) {
			return { error: error.message };
		}
	}

	const analysis = analyzeWorkflow(workflow, testFile);
	console.log('📋 Analysis result:');
	console.log(JSON.stringify(analysis, null, 2));
} catch (error) {
	console.log('❌ Error:', error.message);
}
