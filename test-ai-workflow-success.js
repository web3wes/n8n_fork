#!/usr/bin/env node

/**
 * AI Workflow Generation Test Script
 * Tests the fully working n8n AI workflow generation feature
 */

const axios = require('axios');
const fs = require('fs');

const N8N_URL = 'http://localhost:5678';
const EMAIL = 'jonesclarence37@gmail.com';
const PASSWORD = 'TRanspac12!@';

console.log('🚀 n8n AI Workflow Generation Test');
console.log('===================================\n');

// Test prompts
const testPrompts = [
	'Create a simple workflow that receives webhook data and sends it to Slack',
	'Build a workflow that monitors Google Drive for new files and processes them with OpenAI',
	'Create a customer support workflow that gets tickets from email and routes them based on priority',
	'Build an e-commerce workflow that processes orders and sends confirmation emails',
	'Create a data pipeline that extracts data from an API, transforms it, and saves to Airtable',
];

async function login() {
	console.log('🔐 Logging into n8n...');
	try {
		const response = await axios.post(`${N8N_URL}/rest/login`, {
			email: EMAIL,
			password: PASSWORD,
		});

		const cookies = response.headers['set-cookie'];
		console.log('✅ Login successful\n');
		return cookies;
	} catch (error) {
		console.error('❌ Login failed:', error.message);
		process.exit(1);
	}
}

async function checkAIStatus(cookies) {
	console.log('📊 Checking AI service status...');
	try {
		const response = await axios.get(`${N8N_URL}/rest/ai/text-to-workflow/status`, {
			headers: { Cookie: cookies.join('; ') },
		});

		const status = response.data.data;
		console.log(`✅ AI Service Available: ${status.available}`);
		console.log(`✅ AI Service Ready: ${status.isReady}`);
		console.log(`✅ Knowledge Core Nodes: ${status.knowledgeCoreStatus.nodeCount}`);
		console.log(`✅ Supported Features: ${status.supportedFeatures.join(', ')}\n`);

		return status.available && status.isReady;
	} catch (error) {
		console.error('❌ Failed to check AI status:', error.message);
		return false;
	}
}

async function generateWorkflow(prompt, cookies, index) {
	console.log(`🧠 Generating workflow ${index + 1}...`);
	console.log(`📝 Prompt: "${prompt}"`);

	try {
		const response = await axios.post(
			`${N8N_URL}/rest/ai/generate-workflow`,
			{
				prompt: prompt,
			},
			{
				headers: {
					Cookie: cookies.join('; '),
					'Content-Type': 'application/json',
				},
				timeout: 60000, // 60 second timeout
			},
		);

		const workflow = response.data.data || response.data;

		if (workflow.nodes && workflow.nodes.length > 0) {
			console.log(`✅ Generated "${workflow.name}"`);
			console.log(`🔗 Nodes: ${workflow.nodes.length}`);
			console.log(
				`📋 Node types: ${workflow.nodes.map((n) => n.type.split('.').pop()).join(', ')}`,
			);

			// Save workflow
			const filename = `ai-generated-workflow-${index + 1}-${Date.now()}.json`;
			fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));
			console.log(`💾 Saved to: ${filename}\n`);

			return { success: true, workflow, filename };
		} else {
			console.log('❌ No nodes generated\n');
			return { success: false, error: 'No nodes in response' };
		}
	} catch (error) {
		console.error(`❌ Generation failed: ${error.response?.data?.message || error.message}\n`);
		return { success: false, error: error.message };
	}
}

async function testWorkflowImport(workflowFile, cookies) {
	console.log(`🔍 Testing import of ${workflowFile}...`);

	try {
		const workflowData = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));

		const response = await axios.post(`${N8N_URL}/rest/workflows`, workflowData, {
			headers: {
				Cookie: cookies.join('; '),
				'Content-Type': 'application/json',
			},
		});

		console.log(`✅ Successfully imported workflow with ID: ${response.data.id}\n`);
		return response.data.id;
	} catch (error) {
		console.error(`❌ Import failed: ${error.response?.data?.message || error.message}\n`);
		return null;
	}
}

async function main() {
	try {
		// Login
		const cookies = await login();

		// Check AI status
		const aiReady = await checkAIStatus(cookies);
		if (!aiReady) {
			console.error('❌ AI service not ready. Please ensure n8n is running with AI configuration.');
			process.exit(1);
		}

		// Generate workflows
		console.log('🚀 Starting workflow generation tests...\n');
		const results = [];

		for (let i = 0; i < testPrompts.length; i++) {
			const result = await generateWorkflow(testPrompts[i], cookies, i);
			results.push(result);

			// Small delay between requests
			if (i < testPrompts.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		// Test import of first successful workflow
		const successfulWorkflow = results.find((r) => r.success);
		if (successfulWorkflow) {
			await testWorkflowImport(successfulWorkflow.filename, cookies);
		}

		// Summary
		console.log('📊 Generation Summary:');
		console.log('=====================');
		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		console.log(`✅ Successful: ${successful}`);
		console.log(`❌ Failed: ${failed}`);
		console.log(
			`📁 Generated files: ${results
				.filter((r) => r.success)
				.map((r) => r.filename)
				.join(', ')}`,
		);

		console.log('\n🎉 AI Workflow Generation Test Complete!');
		console.log('\n💡 Next steps:');
		console.log('   • Import generated workflows into n8n UI');
		console.log('   • Configure credentials for nodes that require them');
		console.log('   • Test workflow execution');
		console.log('   • Customize workflows as needed');
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		process.exit(1);
	}
}

main();
