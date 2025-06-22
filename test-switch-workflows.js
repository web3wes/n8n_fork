#!/usr/bin/env node

/**
 * Switch Node Workflow Test Script
 * Tests workflows with Switch nodes to ensure proper routing connections
 */

const axios = require('axios');
const fs = require('fs');

const N8N_URL = 'http://localhost:5678';
const EMAIL = 'jonesclarence37@gmail.com';
const PASSWORD = 'TRanspac12!@';

console.log('🔀 Switch Node Workflow Test');
console.log('=============================\n');

// Test prompts specifically for Switch node workflows
const switchPrompts = [
	'Create a customer support workflow that routes emails based on priority: high, medium, low',
	'Build a workflow that processes orders and routes them to fulfillment, billing, or returns based on order type',
	'Create an approval workflow that routes requests to different managers based on department: sales, marketing, engineering',
	'Build a content moderation workflow that routes posts to auto-approve, manual review, or reject based on content score',
];

async function login() {
	try {
		const response = await axios.post(`${N8N_URL}/rest/login`, {
			email: EMAIL,
			password: PASSWORD,
		});

		return response.headers['set-cookie'];
	} catch (error) {
		console.error('❌ Login failed:', error.response?.data || error.message);
		process.exit(1);
	}
}

async function generateWorkflow(prompt, cookies) {
	try {
		console.log(`🤖 Generating: "${prompt}"`);

		const response = await axios.post(
			`${N8N_URL}/rest/ai/generate-workflow`,
			{
				prompt: prompt,
			},
			{
				headers: {
					Cookie: cookies.join('; '),
				},
			},
		);

		return response.data.data || response.data;
	} catch (error) {
		console.error('❌ Generation failed:', error.response?.data || error.message);
		return null;
	}
}

function analyzeSwitchConnections(workflow) {
	const switchNodes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.switch');

	if (switchNodes.length === 0) {
		return { hasSwitchNode: false };
	}

	const analysis = {
		hasSwitchNode: true,
		switchNodes: switchNodes.length,
		details: [],
	};

	switchNodes.forEach((node) => {
		const connections = workflow.connections[node.name];
		const rules = node.parameters?.rules?.rules || [];

		const nodeAnalysis = {
			name: node.name,
			rules: rules.length,
			connections: connections?.main?.length || 0,
			rulesDetails: rules.map((rule, index) => ({
				index,
				operation: rule.operation,
				value2: rule.value2,
				hasConnection: connections?.main?.[index] ? true : false,
			})),
		};

		analysis.details.push(nodeAnalysis);
	});

	return analysis;
}

async function testSwitchWorkflows() {
	console.log('🔐 Logging in...');
	const cookies = await login();
	console.log('✅ Login successful\n');

	let totalGenerated = 0;
	let switchWorkflows = 0;
	let properlyConnected = 0;

	for (const [index, prompt] of switchPrompts.entries()) {
		console.log(`\n📝 Test ${index + 1}/${switchPrompts.length}`);
		console.log(`Prompt: "${prompt}"`);

		const workflow = await generateWorkflow(prompt, cookies);

		if (!workflow) {
			console.log('❌ Failed to generate workflow');
			continue;
		}

		totalGenerated++;

		// Save workflow
		const filename = `switch-test-workflow-${index + 1}-${Date.now()}.json`;
		fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));

		// Analyze Switch connections
		const analysis = analyzeSwitchConnections(workflow);

		if (!analysis.hasSwitchNode) {
			console.log('⚠️  No Switch node found in workflow');
			continue;
		}

		switchWorkflows++;
		console.log(`✅ Generated workflow with ${analysis.switchNodes} Switch node(s)`);

		let allProperlyConnected = true;

		analysis.details.forEach((switchNode) => {
			console.log(`\n🔀 Switch Node: "${switchNode.name}"`);
			console.log(`   Rules: ${switchNode.rules}`);
			console.log(`   Connections: ${switchNode.connections}`);

			switchNode.rulesDetails.forEach((rule) => {
				const status = rule.hasConnection ? '✅' : '❌';
				console.log(
					`   ${status} Rule ${rule.index}: ${rule.operation} "${rule.value2}" ${rule.hasConnection ? '(connected)' : '(NOT connected)'}`,
				);

				if (!rule.hasConnection) {
					allProperlyConnected = false;
				}
			});
		});

		if (allProperlyConnected) {
			properlyConnected++;
			console.log('🎉 All Switch rules properly connected!');
		} else {
			console.log('⚠️  Some Switch rules are missing connections');
		}

		console.log(`💾 Saved as: ${filename}`);
	}

	console.log('\n📊 Final Results:');
	console.log('================');
	console.log(`Total workflows generated: ${totalGenerated}/${switchPrompts.length}`);
	console.log(`Workflows with Switch nodes: ${switchWorkflows}`);
	console.log(`Switch nodes properly connected: ${properlyConnected}/${switchWorkflows}`);
	console.log(
		`Success rate: ${switchWorkflows > 0 ? Math.round((properlyConnected / switchWorkflows) * 100) : 0}%`,
	);

	if (properlyConnected === switchWorkflows && switchWorkflows > 0) {
		console.log('\n🎉 All Switch node workflows are properly connected!');
	} else if (switchWorkflows > 0) {
		console.log('\n⚠️  Some Switch node workflows need connection fixes');
	} else {
		console.log('\n⚠️  No Switch node workflows were generated');
	}
}

// Run the test
testSwitchWorkflows().catch(console.error);
