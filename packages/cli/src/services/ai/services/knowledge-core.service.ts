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
	private syncInterval: number = 1000 * 60 * 60; // 1 hour
	private n8nBaseUrl: string;

	constructor(
		private pinecone: Pinecone,
		private aiProvider: AIProviderOpenAI,
	) {
		// Initialize configuration
		this.n8nBaseUrl = 'http://localhost:5678'; // Default n8n base URL

		// Initialize sync on startup
		void this.initializeKnowledgeCore();
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
			console.log('🔄 Syncing node definitions from n8n instance...');

			// Fetch latest node definitions
			const nodeDefinitions = await this.fetchNodeDefinitions();

			// Create rich documents for each node
			const nodeDocuments = await this.createNodeDocuments(nodeDefinitions);

			// Update vector database
			await this.updateVectorDatabase(nodeDocuments);

			this.lastSync = new Date();
			console.log(
				`✅ Knowledge Core synced successfully. ${nodeDefinitions.length} nodes indexed.`,
			);
		} catch (error) {
			console.error('❌ Failed to sync node definitions:', error);
			throw new ApplicationError('Failed to sync node definitions from n8n instance');
		}
	}

	/**
	 * Fetches node definitions from the n8n instance
	 */
	private async fetchNodeDefinitions(): Promise<N8nNodeDefinition[]> {
		try {
			const response = await axios.get(`${this.n8nBaseUrl}/types/nodes.json`, {
				timeout: 30000,
			});

			if (!response.data || typeof response.data !== 'object') {
				throw new Error('Invalid response format from /types/nodes.json');
			}

			// The response is an object where keys are node names and values are definitions
			const nodeDefinitions: N8nNodeDefinition[] = Object.values(response.data);

			console.log(`📊 Fetched ${nodeDefinitions.length} node definitions`);
			return nodeDefinitions;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				throw new Error(`Failed to fetch node definitions: ${error.message}`);
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
			const index = this.pinecone.Index('n8n-nodes');

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
				description: result.metadata.description,
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
	 * Gets detailed node information by node type
	 */
	async getNodeDetails(nodeType: string): Promise<N8nNodeDefinition | null> {
		try {
			const nodeDefinitions = await this.fetchNodeDefinitions();
			return nodeDefinitions.find((node) => node.name === nodeType) || null;
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
			nodeCount: 0, // Could be enhanced to track actual count
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
}
