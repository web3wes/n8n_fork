#!/usr/bin/env node

/**
 * Test script to check AI service initialization status
 */

const axios = require('axios');

async function testAIServiceStatus() {
	console.log('🔍 Testing AI Service Status');
	console.log('=============================');

	try {
		// Login first
		await axios.post(
			'http://localhost:5678/rest/login',
			{
				email: 'jonesclarence37@gmail.com',
				password: 'TRanspac12!@',
			},
			{
				headers: { 'Content-Type': 'application/json' },
			},
		);

		console.log('✅ Authenticated successfully');

		// Test basic AI endpoint (generateCurl)
		console.log('\n🧪 Testing basic AI functionality...');
		try {
			const curlResponse = await axios.post(
				'http://localhost:5678/rest/ai/generate-curl',
				{
					service: 'GitHub',
					request: 'Get user repositories',
				},
				{
					headers: { 'Content-Type': 'application/json' },
					withCredentials: true,
				},
			);

			console.log('✅ Basic AI service is working');
		} catch (curlError) {
			console.log(
				'❌ Basic AI service failed:',
				curlError.response?.data?.message || curlError.message,
			);
		}

		// Test text-to-workflow status
		console.log('\n📊 Checking text-to-workflow status...');
		const statusResponse = await axios.get(
			'http://localhost:5678/rest/ai/text-to-workflow/status',
			{
				withCredentials: true,
			},
		);

		console.log('📋 Status Response:', JSON.stringify(statusResponse.data, null, 2));

		// Test knowledge core sync
		console.log('\n🔄 Testing Knowledge Core sync...');
		try {
			const syncResponse = await axios.post(
				'http://localhost:5678/rest/ai/knowledge-core/sync',
				{},
				{
					headers: { 'Content-Type': 'application/json' },
					withCredentials: true,
				},
			);

			console.log('✅ Knowledge Core sync successful:', JSON.stringify(syncResponse.data, null, 2));
		} catch (syncError) {
			console.log('❌ Knowledge Core sync failed:');
			console.log('   Status:', syncError.response?.status);
			console.log('   Message:', syncError.response?.data?.message);
			console.log('   Full response:', JSON.stringify(syncError.response?.data, null, 2));
		}
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	}
}

testAIServiceStatus().catch(console.error);
