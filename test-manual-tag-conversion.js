#!/usr/bin/env node

/**
 * Test manual tag conversion and import
 */

const axios = require('axios');
const fs = require('fs');

const N8N_URL = 'http://localhost:5678';
const EMAIL = 'jonesclarence37@gmail.com';
const PASSWORD = 'TRanspac12!@';

async function testManualTagConversion() {
	console.log('🔧 Testing Manual Tag Conversion');
	console.log('=================================\n');

	// Read the generated workflow
	const workflowFile = 'tag-format-test-1750605354287.json';
	const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));

	console.log('📄 Original workflow tags:', JSON.stringify(workflow.tags));

	// Convert tags to correct format
	if (Array.isArray(workflow.tags)) {
		workflow.tags = workflow.tags.map((tag) => (typeof tag === 'string' ? { name: tag } : tag));
	}

	console.log('🔄 Converted workflow tags:', JSON.stringify(workflow.tags));

	// Give it a unique name to avoid conflicts
	workflow.name = `${workflow.name} - Manual Test ${Date.now()}`;

	// Login
	console.log('\n🔐 Logging in...');
	const loginResponse = await axios.post(`${N8N_URL}/rest/login`, {
		email: EMAIL,
		password: PASSWORD,
	});
	const cookies = loginResponse.headers['set-cookie'];
	console.log('✅ Login successful');

	// Test import
	console.log('\n📥 Testing workflow import with corrected tags...');
	try {
		const importResponse = await axios.post(`${N8N_URL}/rest/workflows`, workflow, {
			headers: {
				Cookie: cookies.join('; '),
				'Content-Type': 'application/json',
			},
		});

		console.log(`✅ Import successful! Workflow ID: ${importResponse.data.id}`);
		console.log('🎉 Manual tag conversion works - the fix logic is correct!');
		console.log(
			'\n💡 The issue is that the AI service is returning string tags instead of object tags.',
		);
		console.log(
			'💡 The conversion logic works, but needs to be applied at the API response level.',
		);

		return true;
	} catch (error) {
		console.error('❌ Import failed:', error.response?.data?.message || error.message);
		return false;
	}
}

testManualTagConversion().catch(console.error);
