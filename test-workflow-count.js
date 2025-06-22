const fs = require('fs');
const glob = require('glob');

console.log('🔍 Testing workflow file discovery and filtering...');

// Use the same patterns as our service
const patterns = [
	'packages/nodes-base/**/*.workflow.json', // 186 dedicated workflow files
	'packages/nodes-base/**/test/**/*.json', // 369 test workflow files
];

const files = [];

for (const pattern of patterns) {
	const matches = glob.sync(pattern, {
		cwd: process.cwd(),
		ignore: ['node_modules/**', 'dist/**', '.git/**'],
	});
	files.push(...matches.map((f) => require('path').resolve(f)));
}

// Remove duplicates
const uniqueFiles = [...new Set(files)];
console.log(`📁 Found ${uniqueFiles.length} total files`);

// Filter for actual n8n workflows
let validWorkflows = 0;
let switchWorkflows = 0;
let processedCount = 0;

console.log('\n🔍 Analyzing files...');

for (const file of uniqueFiles.slice(0, 10)) {
	// Test first 10 files
	try {
		const content = fs.readFileSync(file, 'utf8');
		const json = JSON.parse(content);

		// Check if it looks like an n8n workflow
		const isValid =
			json.nodes &&
			json.connections &&
			Array.isArray(json.nodes) &&
			json.nodes.length > 0 &&
			json.nodes.some((node) => node.type && node.type.startsWith('n8n-nodes-base.'));

		if (isValid) {
			validWorkflows++;

			// Check for Switch nodes
			const hasSwitchNode = json.nodes.some((node) => node.type === 'n8n-nodes-base.switch');
			if (hasSwitchNode) {
				switchWorkflows++;
				console.log(`🔀 Switch workflow: ${file.split('/').pop()}`);
			}

			console.log(`✅ Valid: ${file.split('/').pop()} (${json.nodes.length} nodes)`);
		} else {
			console.log(`❌ Invalid: ${file.split('/').pop()}`);
		}

		processedCount++;
	} catch (error) {
		console.log(`💥 Error: ${file.split('/').pop()} - ${error.message}`);
	}
}

console.log(`\n📊 Results from ${processedCount} test files:`);
console.log(`✅ Valid workflows: ${validWorkflows}`);
console.log(`🔀 Switch workflows: ${switchWorkflows}`);
console.log(`📁 Total files to process: ${uniqueFiles.length}`);

// Estimate full results
const estimatedValid = Math.round((validWorkflows / processedCount) * uniqueFiles.length);
const estimatedSwitch = Math.round((switchWorkflows / processedCount) * uniqueFiles.length);

console.log(`\n🔮 Estimated full results:`);
console.log(`✅ Valid workflows: ~${estimatedValid}`);
console.log(`🔀 Switch workflows: ~${estimatedSwitch}`);
