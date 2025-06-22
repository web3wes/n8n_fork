const fs = require('fs');
const glob = require('glob');

function isN8nWorkflow(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		const json = JSON.parse(content);
		return (
			json.nodes &&
			json.connections &&
			Array.isArray(json.nodes) &&
			json.nodes.length > 0 &&
			json.nodes.some((node) => node.type && node.type.startsWith('n8n-nodes-base.'))
		);
	} catch {
		return false;
	}
}

console.log('🔍 Checking if files are actual n8n workflows...');

// Check .workflow.json files
console.log('\n📋 Checking .workflow.json files...');
const workflowFiles = glob.sync('packages/nodes-base/**/*.workflow.json', {
	cwd: process.cwd(),
	ignore: ['node_modules/**', 'dist/**', '.git/**'],
});

const validWorkflows = workflowFiles.filter(isN8nWorkflow);
console.log(`   Total: ${workflowFiles.length}`);
console.log(`   Valid workflows: ${validWorkflows.length}`);
console.log(`   Invalid: ${workflowFiles.length - validWorkflows.length}`);

// Check test JSON files
console.log('\n🧪 Checking test JSON files...');
const testFiles = glob.sync('packages/nodes-base/**/test/**/*.json', {
	cwd: process.cwd(),
	ignore: ['node_modules/**', 'dist/**', '.git/**'],
});

const validTestWorkflows = testFiles.filter(isN8nWorkflow);
console.log(`   Total: ${testFiles.length}`);
console.log(`   Valid workflows: ${validTestWorkflows.length}`);
console.log(`   Invalid: ${testFiles.length - validTestWorkflows.length}`);

console.log(`\n✅ SUMMARY:`);
console.log(`   Total files scanned: ${workflowFiles.length + testFiles.length}`);
console.log(`   Valid n8n workflows: ${validWorkflows.length + validTestWorkflows.length}`);
console.log(
	`   Non-workflow files: ${workflowFiles.length + testFiles.length - (validWorkflows.length + validTestWorkflows.length)}`,
);

// Sample some invalid files to see what they are
const invalidTestFiles = testFiles.filter((f) => !isN8nWorkflow(f)).slice(0, 3);
console.log(`\n❌ Sample non-workflow files:`);
invalidTestFiles.forEach((file) => {
	console.log(`   - ${file}`);
	try {
		const content = fs.readFileSync(file, 'utf8');
		const json = JSON.parse(content);
		const keys = Object.keys(json).slice(0, 3);
		console.log(`     Keys: ${keys.join(', ')}`);
	} catch (e) {
		console.log(`     Error: ${e.message}`);
	}
});
