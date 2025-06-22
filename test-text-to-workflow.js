#!/usr/bin/env node

/**
 * Test Script: Text-to-Workflow Feature
 *
 * This script tests the implemented text-to-workflow functionality
 * by making API calls to the running n8n instance.
 */

const axios = require('axios');

// Configuration
const N8N_BASE_URL = 'http://localhost:5678';
const TEST_PROMPTS = [
	'Send me an email when someone fills out a form on my website',
	'Post new RSS articles to Slack every hour',
	'Save Gmail attachments to Google Drive',
	'Create Airtable records from webhook data',
	'Send Slack notifications for new GitHub issues',
];

class TextToWorkflowTester {
	constructor() {
		this.baseUrl = N8N_BASE_URL;
		this.headers = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		};
		this.authCookie = null;
		this.credentials = {
			email: 'jonesclarence37@gmail.com',
			password: 'TRanspac12!@',
		};
	}

	async authenticate() {
		console.log('🔐 Authenticating with n8n...');
		try {
			const response = await axios.post(`${this.baseUrl}/rest/login`, this.credentials, {
				headers: this.headers,
			});

			// Extract cookies from response
			if (response.headers['set-cookie']) {
				this.authCookie = response.headers['set-cookie'][0].split(';')[0];
				this.headers['Cookie'] = this.authCookie;
			}

			console.log('✅ Authentication successful!');
			return true;
		} catch (error) {
			console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
			return false;
		}
	}

	async testConnection() {
		console.log('🔌 Testing connection to n8n...');
		try {
			// First authenticate
			const authOk = await this.authenticate();
			if (!authOk) return false;

			// Then test authenticated endpoint
			const response = await axios.get(`${this.baseUrl}/rest/workflows`, {
				headers: this.headers,
			});
			console.log('✅ Connection successful!');
			return true;
		} catch (error) {
			console.error('❌ Connection failed:', error.response?.data?.message || error.message);
			console.log('Make sure n8n is running on', this.baseUrl);
			return false;
		}
	}

	async testKnowledgeCoreSync() {
		console.log('\n📚 Testing Knowledge Core sync...');
		try {
			const response = await axios.post(
				`${this.baseUrl}/rest/ai/knowledge-core/sync`,
				{},
				{ headers: this.headers },
			);

			console.log('✅ Knowledge Core sync successful!');
			console.log('Response:', response.data);
			return true;
		} catch (error) {
			console.error('❌ Knowledge Core sync failed:', error.response?.data || error.message);
			return false;
		}
	}

	async testWorkflowGeneration(prompt) {
		console.log(`\n🎯 Testing workflow generation for: "${prompt}"`);

		try {
			const response = await axios.post(
				`${this.baseUrl}/rest/ai/generate-workflow`,
				{
					prompt: prompt,
					options: {
						includeAdvancedNodes: false,
						maxNodes: 5,
						generateTestData: true,
					},
				},
				{ headers: this.headers },
			);

			console.log('✅ Workflow generation successful!');
			console.log('Generated workflow:');
			console.log(JSON.stringify(response.data, null, 2));
			return response.data;
		} catch (error) {
			console.error('❌ Workflow generation failed:', error.response?.data || error.message);
			return null;
		}
	}

	async testTextToWorkflowStatus() {
		console.log('\n📊 Testing Text-to-Workflow status...');
		try {
			const response = await axios.get(`${this.baseUrl}/rest/ai/text-to-workflow/status`, {
				headers: this.headers,
			});

			console.log('✅ Status check successful!');
			console.log('Status:', response.data);
			return response.data;
		} catch (error) {
			console.error('❌ Status check failed:', error.response?.data || error.message);
			return null;
		}
	}

	async runAllTests() {
		console.log('🚀 Starting Text-to-Workflow Tests');
		console.log('===================================\n');

		// Test 1: Connection
		const connectionOk = await this.testConnection();
		if (!connectionOk) {
			console.log('\n❌ Cannot proceed without connection to n8n');
			return;
		}

		// Test 2: Status check
		await this.testTextToWorkflowStatus();

		// Test 3: Knowledge Core sync
		await this.testKnowledgeCoreSync();

		// Test 4: Workflow generation
		console.log('\n🎯 Testing Workflow Generation');
		console.log('==============================');

		for (let i = 0; i < Math.min(TEST_PROMPTS.length, 3); i++) {
			const prompt = TEST_PROMPTS[i];
			const workflow = await this.testWorkflowGeneration(prompt);

			if (workflow) {
				console.log(
					`\n📝 Generated workflow "${workflow.name || 'Unnamed'}" with ${workflow.nodes?.length || 0} nodes`,
				);
			}

			// Wait between tests to avoid rate limiting
			if (i < 2) {
				console.log('⏳ Waiting 2 seconds before next test...');
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		console.log('\n🎉 Test suite completed!');
	}

	async runSingleTest(prompt) {
		console.log('🚀 Single Workflow Generation Test');
		console.log('==================================\n');

		const connectionOk = await this.testConnection();
		if (!connectionOk) return;

		const workflow = await this.testWorkflowGeneration(prompt);
		if (workflow) {
			console.log("\n✨ Success! Here's your generated workflow:");
			console.log('==========================================');
			console.log(`Name: ${workflow.name || 'Unnamed'}`);
			console.log(`Nodes: ${workflow.nodes?.length || 0}`);
			console.log(`Active: ${workflow.active || false}`);

			if (workflow.nodes) {
				console.log('\nNodes in workflow:');
				workflow.nodes.forEach((node, i) => {
					console.log(`  ${i + 1}. ${node.name} (${node.type})`);
				});
			}
		}
	}
}

// Main execution
async function main() {
	const tester = new TextToWorkflowTester();

	// Check command line arguments
	const args = process.argv.slice(2);

	if (args.length > 0) {
		// Single test with custom prompt
		const prompt = args.join(' ');
		await tester.runSingleTest(prompt);
	} else {
		// Run all tests
		await tester.runAllTests();
	}
}

// Environment check
function checkEnvironment() {
	console.log('🔍 Environment Check');
	console.log('====================');

	const requiredVars = ['N8N_AI_ENABLED', 'N8N_AI_OPENAI_API_KEY', 'N8N_AI_PINECONE_API_KEY'];

	let allSet = true;
	requiredVars.forEach((varName) => {
		const value = process.env[varName];
		if (value && value !== 'your_openai_api_key_here' && value !== 'your_pinecone_api_key_here') {
			console.log(`✅ ${varName}: Set`);
		} else {
			console.log(`❌ ${varName}: Not set or placeholder`);
			allSet = false;
		}
	});

	if (!allSet) {
		console.log('\n⚠️  Please set the required environment variables:');
		console.log('export N8N_AI_ENABLED=true');
		console.log('export N8N_AI_OPENAI_API_KEY=your_actual_openai_key');
		console.log('export N8N_AI_PINECONE_API_KEY=your_actual_pinecone_key');
		console.log('\nThen restart n8n and run this script again.\n');
	} else {
		console.log('\n✅ All environment variables are set!\n');
	}

	return allSet;
}

// Usage information
function showUsage() {
	console.log('Usage:');
	console.log('  node test-text-to-workflow.js                    # Run all tests');
	console.log('  node test-text-to-workflow.js "your prompt here" # Test single prompt');
	console.log('');
	console.log('Examples:');
	console.log('  node test-text-to-workflow.js "Send email when form is submitted"');
	console.log('  node test-text-to-workflow.js "Post RSS to Slack every hour"');
	console.log('');
}

// Error handling
process.on('unhandledRejection', (error) => {
	console.error('❌ Unhandled error:', error.message);
	process.exit(1);
});

// Run the script
if (require.main === module) {
	// Show usage if help requested
	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		showUsage();
		process.exit(0);
	}

	// Check environment first
	checkEnvironment();

	// Run main function
	main().catch((error) => {
		console.error('❌ Script failed:', error.message);
		process.exit(1);
	});
}
