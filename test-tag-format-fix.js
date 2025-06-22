#!/usr/bin/env node

/**
 * Test script to verify tag format fix
 */

const axios = require('axios');
const fs = require('fs');

const N8N_URL = 'http://localhost:5678';
const EMAIL = 'jonesclarence37@gmail.com';
const PASSWORD = 'TRanspac12!@';

async function testTagFormatFix() {
	console.log('🔧 Testing Tag Format Fix');
	console.log('=========================\n');

	// Login
	console.log('🔐 Logging in...');
	const loginResponse = await axios.post(`${N8N_URL}/rest/login`, {
		email: EMAIL,
		password: PASSWORD,
	});
	const cookies = loginResponse.headers['set-cookie'];
	console.log('✅ Login successful\n');

	// Generate a simple workflow
	console.log('🧠 Generating test workflow...');
	const response = await axios.post(
		`${N8N_URL}/rest/ai/generate-workflow`,
		{
			prompt: 'Create a simple workflow that receives a webhook and logs the data',
		},
		{
			headers: {
				Cookie: cookies.join('; '),
			},
		},
	);

	const workflow = response.data.data || response.data;

	// Save and check tag format
	const filename = `tag-format-test-${Date.now()}.json`;
	fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));

	console.log(`✅ Generated workflow: "${workflow.name}"`);
	console.log(`💾 Saved as: ${filename}`);
	console.log('\n🏷️  Tag Analysis:');
	console.log(`Tags: ${JSON.stringify(workflow.tags)}`);

	// Check if tags are in correct format
	if (Array.isArray(workflow.tags) && workflow.tags.length > 0) {
		const firstTag = workflow.tags[0];
		if (typeof firstTag === 'object' && firstTag.name) {
			console.log('✅ Tags are in correct object format: [{ name: "..." }]');

			// Test import
			console.log('\n📥 Testing workflow import...');
			try {
				const importResponse = await axios.post(`${N8N_URL}/rest/workflows`, workflow, {
					headers: {
						Cookie: cookies.join('; '),
						'Content-Type': 'application/json',
					},
				});

				console.log(`✅ Import successful! Workflow ID: ${importResponse.data.id}`);
				console.log('🎉 Tag format fix is working correctly!');

				return true;
			} catch (error) {
				console.error('❌ Import failed:', error.response?.data?.message || error.message);
				return false;
			}
		} else {
			console.log('❌ Tags are still in string format');
			console.log('Expected: [{ name: "tag-name" }]');
			console.log(`Got: ${JSON.stringify(workflow.tags)}`);
			return false;
		}
	} else {
		console.log('❌ No tags found in workflow');
		return false;
	}
}

testTagFormatFix().catch(console.error);
