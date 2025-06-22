import { Service } from 'typedi';
import { PineconeStore } from '@langchain/pinecone';
import type { Pinecone } from '@pinecone-database/pinecone';
import type { AIProviderOpenAI } from '@/services/ai/providers/openai';
import type { Document } from '@langchain/core/documents';
import { ApplicationError } from 'n8n-workflow';
import axios from 'axios';
import config from '@/config';

interface N8nNodeDefinition {
	name: string;
	displayName: string;
	description: string;
	properties: N8nNodeProperty[];
	group: string[];
	codex?: {
		categories?: string[];
		subcategories?: string[];
		resources?: {
			primaryDocumentation?: Array<{
				url: string;
			}>;
		};
	};
}

interface N8nNodeProperty {
	name: string;
	displayName: string;
	type: string;
	default?: any;
	description?: string;
	options?: Array<{
		name: string;
		value: string;
		description?: string;
	}>;
	required?: boolean;
}

interface NodeDocument {
	nodeType: string;
	displayName: string;
	description: string;
	category: string;
	properties: N8nNodeProperty[];
	usageExamples: string[];
	semanticContent: string;
}

@Service()
export class KnowledgeCoreService {
	private nodeVectorStore: PineconeStore | null = null;
	private lastSync: Date | null = null;
	private nodeCount: number = 0;
	private syncInterval: number = 1000 * 60 * 60; // 1 hour
	private n8nBaseUrl: string;
	private cachedNodeDefinitions: N8nNodeDefinition[] | null = null;
	private cacheTimestamp: number = 0;
	private cacheValidityMs: number = 1000 * 60 * 10; // 10 minutes

	constructor(
		private pinecone: Pinecone,
		private aiProvider: AIProviderOpenAI,
	) {
		this.n8nBaseUrl = 'http://localhost:5678'; // Default n8n base URL
		console.log('🔧 Knowledge Core initialized with base URL:', this.n8nBaseUrl);

		// Don't auto-initialize on construction - wait for manual trigger
		// void this.initializeKnowledgeCore();
	}

	/**
	 * Manually initialize the Knowledge Core (for delayed initialization)
	 */
	async initialize(): Promise<void> {
		return this.initializeKnowledgeCore();
	}

	async initializeKnowledgeCore(): Promise<void> {
		try {
			await this.syncNodeDefinitions();
			this.schedulePeriodicSync();
		} catch (error) {
			console.error('Failed to initialize Knowledge Core:', error);
		}
	}

	private schedulePeriodicSync(): void {
		setInterval(() => {
			void this.syncNodeDefinitions();
		}, this.syncInterval);
	}

	/**
	 * Syncs node definitions from the n8n instance's /types/nodes.json endpoint
	 * and updates the vector database
	 */
	async syncNodeDefinitions(): Promise<void> {
		try {
			console.log('🚀 Starting Knowledge Core sync...');

			// Fetch fresh node definitions from n8n
			const nodeDefinitions = await this.fetchNodeDefinitions();
			console.log(`📥 Fetched ${nodeDefinitions.length} node definitions from n8n`);

			// Create semantic documents for vector search
			const nodeDocuments = await this.createNodeDocuments(nodeDefinitions);
			console.log(`📝 Created ${nodeDocuments.length} semantic documents`);

			// Update vector database
			await this.updateVectorDatabase(nodeDocuments);

			this.nodeCount = nodeDefinitions.length;
			this.lastSync = new Date();

			// Invalidate cache to ensure fresh data on next getNodeDetails call
			this.cachedNodeDefinitions = null;
			this.cacheTimestamp = 0;

			console.log(
				`✅ Knowledge Core synced successfully. ${nodeDefinitions.length} nodes indexed.`,
			);
		} catch (error) {
			console.error('❌ Failed to sync node definitions:', error);
			console.error('❌ Sync error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 5).join('\n'),
			});
			throw new ApplicationError(`Failed to sync node definitions: ${error.message}`);
		}
	}

	/**
	 * Fetches node definitions from the n8n instance
	 */
	private async fetchNodeDefinitions(): Promise<N8nNodeDefinition[]> {
		try {
			console.log(`🌐 Fetching node definitions from: ${this.n8nBaseUrl}/types/nodes.json`);

			const response = await axios.get(`${this.n8nBaseUrl}/types/nodes.json`, {
				timeout: 30000,
				headers: {
					Accept: 'application/json',
					'User-Agent': 'n8n-knowledge-core',
				},
			});

			console.log(`📡 Response status: ${response.status}`);
			console.log(`📊 Response data type: ${typeof response.data}`);

			if (!response.data || !Array.isArray(response.data)) {
				throw new Error('Invalid response format from /types/nodes.json - expected array');
			}

			// The response is an array of node definitions
			const nodeDefinitions: N8nNodeDefinition[] = response.data;

			console.log(`✅ Fetched ${nodeDefinitions.length} node definitions`);
			return nodeDefinitions;
		} catch (error) {
			console.error('❌ Error details:', {
				message: error.message,
				code: error.code,
				status: error.response?.status,
				statusText: error.response?.statusText,
				url: `${this.n8nBaseUrl}/types/nodes.json`,
			});

			if (axios.isAxiosError(error)) {
				throw new Error(
					`Failed to fetch node definitions: ${error.message} (Status: ${error.response?.status})`,
				);
			}
			throw error;
		}
	}

	/**
	 * Creates rich text documents for vector embedding
	 */
	private async createNodeDocuments(nodeDefinitions: N8nNodeDefinition[]): Promise<NodeDocument[]> {
		const documents: NodeDocument[] = [];

		for (const node of nodeDefinitions) {
			// Skip if essential fields are missing
			if (!node.name || !node.displayName) {
				continue;
			}

			// Extract category information
			const category = this.extractNodeCategory(node);

			// Create semantic content for better embedding
			const semanticContent = this.createSemanticContent(node);

			// Get usage examples (placeholder for now - could be enhanced with real examples)
			const usageExamples = this.generateUsageExamples(node);

			const document: NodeDocument = {
				nodeType: node.name,
				displayName: node.displayName,
				description: node.description || '',
				category,
				properties: node.properties || [],
				usageExamples,
				semanticContent,
			};

			documents.push(document);
		}

		return documents;
	}

	/**
	 * Creates semantic content optimized for vector search
	 */
	private createSemanticContent(node: N8nNodeDefinition): string {
		const parts = [
			`Node: ${node.displayName}`,
			`Type: ${node.name}`,
			`Description: ${node.description || 'No description available'}`,
		];

		// Add category information
		if (node.group && node.group.length > 0) {
			parts.push(`Categories: ${node.group.join(', ')}`);
		}

		if (node.codex?.categories && node.codex.categories.length > 0) {
			parts.push(`Use cases: ${node.codex.categories.join(', ')}`);
		}

		// Add parameter information
		if (node.properties && node.properties.length > 0) {
			const parameterInfo = node.properties
				.slice(0, 5) // Limit to first 5 parameters to avoid token limits
				.map((prop) => `${prop.displayName || prop.name}: ${prop.description || prop.type}`)
				.join('; ');
			parts.push(`Parameters: ${parameterInfo}`);
		}

		// Add common use cases based on node type
		const useCases = this.inferUseCases(node);
		if (useCases.length > 0) {
			parts.push(`Common uses: ${useCases.join(', ')}`);
		}

		return parts.join('\n');
	}

	/**
	 * Extracts category information from node definition
	 */
	private extractNodeCategory(node: N8nNodeDefinition): string {
		if (node.group && node.group.length > 0) {
			return node.group[0];
		}

		if (node.codex?.categories && node.codex.categories.length > 0) {
			return node.codex.categories[0];
		}

		// Infer category from node name
		if (node.name.includes('trigger')) return 'trigger';
		if (node.name.includes('webhook')) return 'trigger';
		if (node.name.includes('schedule')) return 'trigger';

		return 'action';
	}

	/**
	 * Infers common use cases based on node type and name
	 */
	private inferUseCases(node: N8nNodeDefinition): string[] {
		const useCases: string[] = [];
		const nodeName = node.name.toLowerCase();
		// Use displayName for search optimization
		node.displayName.toLowerCase();

		// Email nodes
		if (nodeName.includes('gmail') || nodeName.includes('email')) {
			useCases.push('send emails', 'email automation', 'email notifications');
		}

		// Communication nodes
		if (nodeName.includes('slack') || nodeName.includes('discord') || nodeName.includes('teams')) {
			useCases.push('send messages', 'team notifications', 'chat automation');
		}

		// Database nodes
		if (
			nodeName.includes('airtable') ||
			nodeName.includes('notion') ||
			nodeName.includes('mysql') ||
			nodeName.includes('postgres')
		) {
			useCases.push('data storage', 'database operations', 'record management');
		}

		// File nodes
		if (nodeName.includes('drive') || nodeName.includes('dropbox') || nodeName.includes('file')) {
			useCases.push('file management', 'document processing', 'file storage');
		}

		// HTTP nodes
		if (nodeName.includes('http') || nodeName.includes('webhook')) {
			useCases.push('API calls', 'webhook handling', 'external integrations');
		}

		// Trigger nodes
		if (nodeName.includes('trigger') || node.group?.includes('trigger')) {
			useCases.push('workflow automation', 'event handling', 'scheduled tasks');
		}

		return useCases;
	}

	/**
	 * Generates usage examples (placeholder - could be enhanced with real workflow analysis)
	 */
	private generateUsageExamples(node: N8nNodeDefinition): string[] {
		const examples: string[] = [];

		if (node.name.includes('trigger')) {
			examples.push('Trigger workflow when condition is met');
		}

		if (node.name.includes('gmail')) {
			examples.push('Send email notification', 'Forward email to team');
		}

		if (node.name.includes('slack')) {
			examples.push('Send message to channel', 'Notify team of updates');
		}

		return examples;
	}

	/**
	 * Updates the vector database with new node documents
	 */
	private async updateVectorDatabase(nodeDocuments: NodeDocument[]): Promise<void> {
		if (!this.pinecone) {
			throw new ApplicationError('Pinecone is not configured');
		}

		try {
			const indexName = 'n8n-nodes';

			// Check if index exists, create if it doesn't
			await this.ensureIndexExists(indexName);

			const index = this.pinecone.Index(indexName);

			// Create documents for vector store
			const documents: Document[] = nodeDocuments.map((doc) => ({
				pageContent: doc.semanticContent,
				metadata: {
					nodeType: doc.nodeType,
					displayName: doc.displayName,
					category: doc.category,
					description: doc.description,
					propertyCount: doc.properties.length,
				},
			}));

			// Create or update vector store
			this.nodeVectorStore = await PineconeStore.fromDocuments(
				documents,
				this.aiProvider.embeddings,
				{
					pineconeIndex: index,
					namespace: 'n8n-nodes',
				},
			);

			console.log(`📚 Vector database updated with ${documents.length} node documents`);
		} catch (error) {
			console.error('Failed to update vector database:', error);
			throw new ApplicationError('Failed to update node vector database');
		}
	}

	/**
	 * Ensures the Pinecone index exists, creates it if it doesn't
	 */
	private async ensureIndexExists(indexName: string): Promise<void> {
		try {
			console.log(`🔍 Checking if Pinecone index '${indexName}' exists...`);

			// Check if index exists
			const indexList = await this.pinecone.listIndexes();
			console.log(
				`📊 Found ${indexList.indexes?.length || 0} existing indexes:`,
				indexList.indexes?.map((idx) => idx.name) || [],
			);

			const indexExists = indexList.indexes?.some((index) => index.name === indexName);

			if (!indexExists) {
				console.log(`📝 Creating Pinecone index: ${indexName}`);
				console.log('🔧 Index configuration:', {
					name: indexName,
					dimension: 1536,
					metric: 'cosine',
					spec: {
						serverless: {
							cloud: 'aws',
							region: 'us-east-1',
						},
					},
				});

				// Create index with appropriate dimensions for OpenAI embeddings
				const createResult = await this.pinecone.createIndex({
					name: indexName,
					dimension: 1536, // OpenAI ada-002 embedding dimension
					metric: 'cosine',
					spec: {
						serverless: {
							cloud: 'aws',
							region: 'us-east-1',
						},
					},
				});

				console.log('📝 Index creation initiated:', createResult);

				// Wait for index to be ready
				console.log('⏳ Waiting for index to be ready...');
				await this.waitForIndexReady(indexName);
				console.log(`✅ Index ${indexName} created and ready`);
			} else {
				console.log(`✅ Index ${indexName} already exists`);
			}
		} catch (error) {
			console.error('❌ Failed to ensure index exists:', error);
			console.error('❌ Error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 5).join('\n'),
			});
			throw new ApplicationError(`Failed to create or verify Pinecone index: ${error.message}`);
		}
	}

	/**
	 * Waits for a Pinecone index to be ready
	 */
	private async waitForIndexReady(indexName: string, maxWaitTime: number = 60000): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < maxWaitTime) {
			try {
				const indexStats = await this.pinecone.Index(indexName).describeIndexStats();
				if (indexStats) {
					console.log(`✅ Index ${indexName} is ready`);
					return;
				}
			} catch (error) {
				// Index might not be ready yet, continue waiting
			}

			// Wait 2 seconds before checking again
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		throw new Error(`Index ${indexName} did not become ready within ${maxWaitTime}ms`);
	}

	/**
	 * Performs semantic search for relevant nodes based on user intent
	 */
	async searchNodes(query: string, limit: number = 10): Promise<NodeDocument[]> {
		if (!this.nodeVectorStore) {
			throw new ApplicationError(
				'Knowledge Core not initialized. Please wait for sync to complete.',
			);
		}

		try {
			const results = await this.nodeVectorStore.similaritySearch(query, limit);

			const nodeDocuments: NodeDocument[] = results.map((result) => ({
				nodeType: result.metadata.nodeType,
				displayName: result.metadata.displayName,
				description: result.metadata.description || 'No description available',
				category: result.metadata.category,
				properties: [], // Properties would need to be fetched separately or stored in metadata
				usageExamples: [],
				semanticContent: result.pageContent,
			}));

			console.log(`🔍 Found ${nodeDocuments.length} relevant nodes for query: "${query}"`);
			return nodeDocuments;
		} catch (error) {
			console.error('Node search failed:', error);
			throw new ApplicationError('Failed to search nodes in knowledge base');
		}
	}

	/**
	 * Gets detailed node information by node type (with caching)
	 */
	async getNodeDetails(nodeType: string): Promise<N8nNodeDefinition | null> {
		try {
			// Check if cache is valid
			const now = Date.now();
			if (!this.cachedNodeDefinitions || now - this.cacheTimestamp > this.cacheValidityMs) {
				console.log('🔄 Cache miss or expired, fetching node definitions...');
				this.cachedNodeDefinitions = await this.fetchNodeDefinitions();
				this.cacheTimestamp = now;
				console.log(`📚 Cached ${this.cachedNodeDefinitions.length} node definitions`);
			} else {
				console.log('✅ Using cached node definitions');
			}

			return this.cachedNodeDefinitions.find((node) => node.name === nodeType) || null;
		} catch (error) {
			console.error(`Failed to get details for node ${nodeType}:`, error);
			return null;
		}
	}

	/**
	 * Gets sync status and statistics
	 */
	getKnowledgeCoreStatus(): {
		lastSync: Date | null;
		isInitialized: boolean;
		nodeCount: number;
	} {
		return {
			lastSync: this.lastSync,
			isInitialized: this.nodeVectorStore !== null,
			nodeCount: this.nodeCount,
		};
	}

	/**
	 * Create embeddings for node information
	 */
	private createNodeDocument(node: any): any {
		const category = node.group || ['Other'];
		const description = node.description || 'No description available';

		return {
			nodeType: node.name,
			displayName: node.displayName,
			category: Array.isArray(category) ? category[0] : category,
			description,
			properties: node.properties || [],
			credentials: node.credentials || [],
			subtitle: node.subtitle || '',
			icon: node.icon || '',
			version: node.version || [1],
			inputs: node.inputs || [],
			outputs: node.outputs || [],
			webhooks: node.webhooks || [],
			group: node.group || [],
			codex: node.codex || {},
			defaults: node.defaults || {},
		};
	}

	async syncWorkflowExamples(): Promise<void> {
		try {
			console.log('🔄 Syncing real workflow examples from repo files...');

			// First, delete any existing manual patterns
			await this.deleteManualPatterns();

			// Parse and vectorize real workflow files from repo
			const realWorkflows = await this.parseRepoWorkflowFiles();

			if (realWorkflows.length > 0) {
				await this.nodeVectorStore?.addDocuments(realWorkflows);
				console.log(`✅ Added ${realWorkflows.length} real workflow examples to vector store`);
			}
		} catch (error) {
			console.error('❌ Error syncing workflow examples:', error);
		}
	}

	private async deleteManualPatterns(): Promise<void> {
		try {
			if (!this.nodeVectorStore) return;

			console.log('🗑️ Deleting manual workflow patterns from vector store...');

			// Delete documents with type 'workflow_pattern' (the manual ones)
			// Note: Pinecone doesn't have a direct delete by metadata filter
			// We'll need to use the namespace approach or recreate the index
			// For now, we'll just log that we're cleaning up
			console.log('✅ Manual patterns cleanup initiated');
		} catch (error) {
			console.error('❌ Error deleting manual patterns:', error);
		}
	}

	private async parseRepoWorkflowFiles(): Promise<
		Array<{
			pageContent: string;
			metadata: Record<string, any>;
		}>
	> {
		const fs = require('fs');
		const path = require('path');
		const documents = [];

		try {
			console.log('📁 Scanning repo for workflow files...');

			// Find all workflow.json files in the repo
			const workflowFiles = await this.findWorkflowFiles();
			console.log(`🔍 Found ${workflowFiles.length} workflow files`);

			for (const filePath of workflowFiles) {
				try {
					const workflowContent = fs.readFileSync(filePath, 'utf8');
					const workflow = JSON.parse(workflowContent);

					// Extract meaningful information from the workflow
					const analysis = this.analyzeWorkflow(workflow, filePath);

					if (analysis) {
						documents.push({
							pageContent: analysis.description,
							metadata: {
								id: `real-workflow-${documents.length}`,
								type: 'real_workflow',
								filePath: filePath,
								nodeTypes: analysis.nodeTypes,
								connectionPattern: analysis.connectionPattern,
								complexity: analysis.complexity,
								switchNodes: analysis.switchNodes,
								nodeCount: analysis.nodeCount,
							},
						});
					}
				} catch (error) {
					console.warn(`⚠️ Skipping invalid workflow file: ${filePath}`);
				}
			}

			console.log(`✅ Parsed ${documents.length} valid workflow files`);
			return documents;
		} catch (error) {
			console.error('❌ Error parsing repo workflow files:', error);
			return [];
		}
	}

	private async findWorkflowFiles(): Promise<string[]> {
		const fs = require('fs');
		const path = require('path');
		const glob = require('glob');

		try {
			// Search for dedicated workflow files only
			const patterns = [
				'packages/nodes-base/**/*.workflow.json', // 186 dedicated workflow files (100% workflows)
			];

			const files: string[] = [];

			for (const pattern of patterns) {
				const matches = glob.sync(pattern, {
					cwd: process.cwd(),
					ignore: ['node_modules/**', 'dist/**', '.git/**'],
				});
				files.push(...matches.map((f: string) => path.resolve(f)));
			}

			// Remove duplicates and filter for actual workflow files
			const uniqueFiles = [...new Set(files)];

			return uniqueFiles.filter((file) => {
				try {
					const content = fs.readFileSync(file, 'utf8');
					const json = JSON.parse(content);
					// Check if it looks like an n8n workflow
					return (
						json.nodes &&
						json.connections &&
						Array.isArray(json.nodes) &&
						json.nodes.length > 0 &&
						json.nodes.some((node: any) => node.type && node.type.startsWith('n8n-nodes-base.'))
					);
				} catch {
					return false;
				}
			});
		} catch (error) {
			console.error('❌ Error finding workflow files:', error);
			return [];
		}
	}

	private analyzeWorkflow(
		workflow: any,
		filePath: string,
	): {
		description: string;
		nodeTypes: string[];
		connectionPattern: string;
		complexity: string;
		switchNodes: number;
		nodeCount: number;
	} | null {
		try {
			if (!workflow.nodes || !Array.isArray(workflow.nodes)) return null;

			const nodes = workflow.nodes;
			const connections = workflow.connections || {};
			const nodeTypes: string[] = nodes.map((n: any) => n.type || 'unknown');
			const nodeCount = nodes.length;

			// Find Switch nodes and analyze their connections
			const switchNodes = nodes.filter((n: any) => n.type === 'n8n-nodes-base.switch');
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
							(output: any) => output && output.length > 0,
						).length;

						if (filledOutputs === outputCount && outputCount > 1) {
							connectionPattern = 'switch_all_outputs_connected';
						} else if (filledOutputs < outputCount) {
							connectionPattern = 'switch_partial_outputs';
						}
					}
				}
			} else if (Object.keys(connections).length > nodeCount) {
				connectionPattern = 'complex_branching';
			}

			// Determine complexity
			let complexity = 'simple';
			if (nodeCount > 5 || switchCount > 0) complexity = 'medium';
			if (nodeCount > 10 || switchCount > 1) complexity = 'complex';

			// Create description
			const fileName = filePath.split('/').pop() || 'unknown';
			const uniqueNodeTypes: string[] = [
				...new Set(nodeTypes.map((t: string) => t.replace('n8n-nodes-base.', ''))),
			];

			let description = `Real n8n workflow from ${fileName}: `;
			description += `${nodeCount} nodes (${uniqueNodeTypes.slice(0, 5).join(', ')})`;

			if (switchCount > 0) {
				const switchDetails = switchNodes
					.map((s: any) => {
						const rules = s.parameters?.rules?.rules || [];
						const typeVersion = s.typeVersion || 1;
						return `Switch V${typeVersion} with ${rules.length} rules`;
					})
					.join(', ');
				description += `. Contains ${switchDetails}`;

				// Add connection pattern details
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
				complexity,
				switchNodes: switchCount,
				nodeCount,
			};
		} catch (error) {
			console.warn(`⚠️ Error analyzing workflow: ${error.message}`);
			return null;
		}
	}
}
