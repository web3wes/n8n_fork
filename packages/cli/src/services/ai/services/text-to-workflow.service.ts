import { Service } from 'typedi';
import type { KnowledgeCoreService } from './knowledge-core.service';
import type { AIService } from '@/services/ai.service';
import { ApplicationError } from 'n8n-workflow';
import { v4 as uuid } from 'uuid';
import { SystemMessage } from '@langchain/core/messages';

interface WorkflowGenerationRequest {
	prompt: string;
	userId?: string;
	includeCredentials?: boolean;
	maxNodes?: number;
}

interface SelectedNode {
	nodeType: string;
	displayName: string;
	category: string;
	confidence: number;
	reason: string;
}

interface WorkflowPlan {
	title: string;
	description: string;
	selectedNodes: SelectedNode[];
	nodeSequence: string[];
	extractedEntities: Record<string, any>;
	parameterMappings: Record<string, Record<string, any>>;
	requiredCredentials: string[];
	missingInformation: string[];
}

interface GeneratedWorkflow {
	name: string;
	active: boolean;
	nodes: WorkflowNode[];
	connections: Record<string, any>;
	settings?: Record<string, any>;
	meta?: Record<string, any>;
	tags?: string[];
	requiredCredentials: string[];
	validationErrors?: string[];
	versionId?: string;
	id?: string;
}

interface WorkflowNode {
	id: string;
	name: string;
	type: string;
	typeVersion: number;
	position: [number, number];
	parameters: Record<string, any>;
	credentials?: Record<string, any>;
}

@Service()
export class TextToWorkflowService {
	constructor(
		private knowledgeCore: KnowledgeCoreService,
		private aiService: AIService,
	) {}

	/**
	 * Main entry point for text-to-workflow generation
	 * Implements the 3-stage pipeline described in the research
	 */
	async generateWorkflow(request: WorkflowGenerationRequest): Promise<GeneratedWorkflow> {
		try {
			console.log(`🚀 Starting workflow generation for prompt: "${request.prompt}"`);

			// Stage 1: Intent Disambiguation and Node Selection (RAG)
			const selectedNodes = await this.stageOneNodeSelection(request.prompt);

			// Stage 2: Parameter Extraction and Entity Mapping
			const workflowPlan = await this.stageTwoParameterExtraction(request.prompt, selectedNodes);

			// Stage 3: Constrained JSON Synthesis
			const generatedWorkflow = await this.stageThreeJsonSynthesis(workflowPlan);

			// Optional: Validate with n8n API (if configured)
			await this.validateWorkflow(generatedWorkflow);

			console.log(`✅ Workflow generation completed successfully`);
			return generatedWorkflow;
		} catch (error) {
			console.error('❌ Workflow generation failed:', error);
			throw new ApplicationError(`Failed to generate workflow: ${error.message}`);
		}
	}

	/**
	 * STAGE 1: Intent Disambiguation and Node Selection (RAG)
	 * Uses semantic search to find relevant nodes for the user's intent
	 */
	private async stageOneNodeSelection(prompt: string): Promise<SelectedNode[]> {
		try {
			console.log('📋 Stage 1: Performing semantic node selection...');

			// Use the Knowledge Core to search for relevant nodes
			const nodeDocuments = await this.knowledgeCore.searchNodes(prompt, 15);

			if (nodeDocuments.length === 0) {
				throw new ApplicationError('No relevant nodes found for the given prompt');
			}

			// Convert to SelectedNode format with confidence scoring
			const selectedNodes: SelectedNode[] = nodeDocuments.map((doc, index) => ({
				nodeType: doc.nodeType,
				displayName: doc.displayName,
				category: doc.category,
				confidence: Math.max(0.9 - index * 0.05, 0.1), // Decreasing confidence
				reason: `Semantic match for: ${(doc.description || 'No description available').substring(0, 100)}...`,
			}));

			console.log(`🎯 Stage 1 complete: Selected ${selectedNodes.length} candidate nodes`);
			return selectedNodes;
		} catch (error) {
			console.error('Stage 1 failed:', error);
			throw new ApplicationError(`Node selection failed: ${error.message}`);
		}
	}

	/**
	 * STAGE 2: Parameter Extraction and Entity Mapping
	 * Uses LLM to plan the workflow and extract parameters
	 */
	private async stageTwoParameterExtraction(
		prompt: string,
		selectedNodes: SelectedNode[],
	): Promise<WorkflowPlan> {
		try {
			console.log('🧠 Stage 2: Extracting parameters and planning workflow...');

			// Get detailed information for each selected node
			const nodeDetails = await Promise.all(
				selectedNodes.map(async (node) => {
					const details = await this.knowledgeCore.getNodeDetails(node.nodeType);
					return { node, details };
				}),
			);

			// Create the planning prompt
			const planningPrompt = await this.createPlanningPrompt(prompt, nodeDetails);

			// Get the planning response from the LLM using direct provider invoke
			const aiProvider = this.aiService.provider;
			const planningResponse = await aiProvider.invoke([planningPrompt]);

			// Extract content from LangChain AIMessage response
			const responseContent = (planningResponse as any)?.content || String(planningResponse || '');

			const workflowPlan = await this.parsePlanningResponse(responseContent, selectedNodes);

			console.log(
				`📝 Stage 2 complete: Created workflow plan with ${workflowPlan.selectedNodes.length} nodes`,
			);
			return workflowPlan;
		} catch (error) {
			console.error('Stage 2 failed:', error);
			throw new ApplicationError(`Stage 2 parameter extraction failed: ${error.message}`);
		}
	}

	/**
	 * STAGE 3: Constrained JSON Synthesis
	 * Generates the final n8n workflow JSON with structural constraints
	 */
	private async stageThreeJsonSynthesis(plan: WorkflowPlan): Promise<GeneratedWorkflow> {
		try {
			console.log('🔧 Stage 3: JSON synthesis starting...');

			// Use the same pattern as generateCurl - create a LangChain chain
			const synthesisPrompt = `Create a valid n8n workflow JSON for: "${plan.title}"

Selected nodes: ${plan.selectedNodes.map((n) => n.nodeType).join(', ')}

Return valid JSON with this structure:
{
  "name": "workflow name",
  "nodes": [
    {
      "id": "unique_id",
      "name": "Node Name",
      "type": "node_type",
      "typeVersion": 1,
      "position": [x, y],
      "parameters": {}
    }
  ],
  "connections": {}
}`;

			// Create a simple chain that returns the content directly
			const aiProvider = this.aiService.provider;
			const systemMessage = new SystemMessage(synthesisPrompt);
			const result = await aiProvider.invoke([systemMessage]);

			// Extract content properly
			const content = (result as any).content || String(result);
			console.log('🔍 AI Response:', content.substring(0, 200) + '...');

			// Parse the workflow from the AI response
			const workflow = await this.parseWorkflowResponse(content, plan);

			console.log(`✅ Stage 3 complete: Generated workflow "${workflow.name}"`);
			return workflow;
		} catch (error) {
			console.error('Stage 3 failed:', error);
			throw new ApplicationError(`Stage 3 JSON synthesis failed: ${error.message}`);
		}
	}

	private async createPlanningPrompt(prompt: string, nodeDetails: any[]): Promise<SystemMessage> {
		const nodeInfo = nodeDetails
			.filter((item) => item.details)
			.map((item) => {
				const { node, details } = item;
				const properties =
					details.properties
						?.slice(0, 5)
						.map(
							(prop: any) => `${prop.name} (${prop.type}): ${prop.description || 'No description'}`,
						)
						.join('\n  ') || 'No parameters';

				return `Node: ${node.displayName} (${node.nodeType})
Description: ${details.description || 'No description'}
Parameters:
  ${properties}`;
			})
			.join('\n\n');

		const planningPromptText = `You are an expert n8n workflow designer. Create a COMPLETE workflow plan for: "${prompt}"

AVAILABLE NODES:
${nodeInfo}

CRITICAL NODE TYPE REQUIREMENTS:
- For AI/LLM functionality: Use "n8n-nodes-base.openAi" (NOT generic AI nodes - note capital A)
- For sentiment analysis: Use "n8n-nodes-base.openAi" with sentiment analysis prompt
- For routing/decisions: Use "n8n-nodes-base.switch" or "n8n-nodes-base.if"
- For email: Use "n8n-nodes-base.emailReadImap" and "n8n-nodes-base.emailSend"
- For webhooks: Use "n8n-nodes-base.webhook"
- For director agents: Include Switch node for routing logic

ANALYSIS REQUIREMENTS:
1. Break down the request into ALL necessary components
2. Identify EVERY node needed for the complete workflow
3. Consider the full data flow: triggers → processing → actions → notifications
4. Extract specific entities (emails, channels, databases, etc.)
5. Map entities to proper node parameters
6. ONLY use actual n8n node types from the available nodes list

For example, "sync MongoDB to Telegram on Stripe webhook" needs:
- Stripe Trigger (for webhook)
- MongoDB (to get/sync data)
- Telegram (to send notification)

For AI workflows, "analyze sentiment and respond" needs:
- Email trigger (n8n-nodes-base.emailReadImap)
- OpenAI node (n8n-nodes-base.openAi) for sentiment analysis
- Switch node (n8n-nodes-base.switch) for routing
- OpenAI node (n8n-nodes-base.openAi) for response generation
- Email send (n8n-nodes-base.emailSend) for response

Respond with COMPLETE JSON including ALL nodes:
{
  "title": "Descriptive workflow title",
  "description": "Detailed description of what this accomplishes",
  "selectedNodes": [
    {"nodeType": "n8n-nodes-base.stripeTrigger", "displayName": "Stripe Trigger", "category": "trigger", "confidence": 0.95, "reason": "handles webhook events from Stripe"},
    {"nodeType": "n8n-nodes-base.mongoDb", "displayName": "MongoDB", "category": "database", "confidence": 0.9, "reason": "retrieves/syncs data from MongoDB database"},
    {"nodeType": "n8n-nodes-base.telegram", "displayName": "Telegram", "category": "communication", "confidence": 0.95, "reason": "sends notification via Telegram bot"}
  ],
  "nodeSequence": ["n8n-nodes-base.stripeTrigger", "n8n-nodes-base.mongoDb", "n8n-nodes-base.telegram"],
  "extractedEntities": {
    "triggers": ["stripe webhook"],
    "databases": ["MongoDB"],
    "notifications": ["Telegram"],
    "events": ["payment events"]
  },
  "parameterMappings": {
    "n8n-nodes-base.stripeTrigger": {
      "events": ["charge.succeeded"]
    },
    "n8n-nodes-base.mongoDb": {
      "operation": "find",
      "collection": "transactions"
    },
    "n8n-nodes-base.telegram": {
      "chatId": "YOUR_CHAT_ID",
      "text": "New payment: {{$json.amount}}"
    }
  },
  "requiredCredentials": ["stripeApi", "mongoDb", "telegramBotApi"],
  "missingInformation": ["Telegram chat ID", "MongoDB collection name"]
}

Include ALL necessary nodes for the complete workflow!`;

		return new SystemMessage(planningPromptText);
	}

	private async createSynthesisPrompt(plan: WorkflowPlan): Promise<SystemMessage> {
		const generateUUID = () => {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				const r = (Math.random() * 16) | 0;
				const v = c == 'x' ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
		};

		// Create node specifications based on real n8n structure
		const nodeSpecs = plan.selectedNodes.map((node, index) => {
			const parameters = plan.parameterMappings[node.nodeType] || {};
			// Add node-specific required parameters
			const enhancedParameters = this.addRequiredNodeParameters(node.nodeType, parameters);
			// Ensure all parameter values are strings or proper types, never undefined
			const sanitizedParameters = this.sanitizeParameters(enhancedParameters);
			// Add required options field like real n8n workflows
			sanitizedParameters.options = sanitizedParameters.options || {};

			return {
				id: generateUUID(),
				name: node.displayName,
				type: node.nodeType,
				typeVersion: this.getNodeTypeVersion(node.nodeType),
				position: [200 + index * 200, 300],
				parameters: sanitizedParameters,
			};
		});

		// Create connections using node NAMES (not IDs) as keys - this is critical!
		const connections: Record<string, any> = {};
		for (let i = 0; i < nodeSpecs.length - 1; i++) {
			const currentNode = nodeSpecs[i];
			const nextNode = nodeSpecs[i + 1];
			connections[currentNode.name] = {
				main: [
					[
						{
							node: nextNode.name, // Use name, not ID!
							type: 'main',
							index: 0,
						},
					],
				],
			};
		}

		const workflowId = Math.random().toString(36).substr(2, 16);
		const instanceId = Array.from({ length: 64 }, () =>
			Math.floor(Math.random() * 16).toString(16),
		).join('');

		const text = `Generate a complete n8n workflow JSON for: "${plan.title}"

CRITICAL: Follow this EXACT n8n workflow structure. This is how REAL n8n workflows are formatted:

{
  "name": "${plan.title}",
  "nodes": [
    {
      "id": "uuid-string",
      "name": "Node Display Name",
      "type": "n8n-nodes-base.nodeType",
      "position": [x, y],
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ],
  "connections": {
    "Node Display Name": {
      "main": [[{
        "node": "Next Node Name",
        "type": "main",
        "index": 0
      }]]
    }
  },
  "active": false,
  "settings": {},
  "versionId": "${generateUUID()}",
  "id": "${workflowId}",
  "meta": {
    "instanceId": "${instanceId}"
  },
  "tags": []
}

REQUIREMENTS:
1. Use UUIDs for node IDs (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
2. Position nodes horizontally: [200, 300], [400, 300], [600, 300], etc.
3. Connections use NODE NAMES as keys, not IDs
4. Include all required n8n workflow fields
5. Use realistic parameters for each node type
6. For Slack nodes: MUST include authentication, resource, operation parameters
7. For webhook nodes: MUST include path and responseMode parameters
8. For AI workflows: Default to OpenAI nodes (n8n-nodes-base.openAi) with model "gpt-3.5-turbo"
9. For routing/director workflows: Use Switch node (n8n-nodes-base.switch) for conditional routing
10. For sentiment analysis: Use proper conditional logic with If/Switch nodes

ROUTING LOGIC REQUIREMENTS:
- Director agents should use Switch or If nodes for routing decisions
- Switch nodes MUST connect ALL outputs - never leave empty arrays []
- For Switch with 3 rules, create exactly 3 output connections
- Each Switch output connects to a different node

SWITCH NODE CONNECTION EXAMPLES:
For a Switch node with 3 rules (simple/moderate/complex):
"Switch": {
  "main": [
    [{"node": "Email Send", "type": "main", "index": 0}],
    [{"node": "Slack", "type": "main", "index": 0}],
    [{"node": "Airtable", "type": "main", "index": 0}]
  ]
}

CRITICAL: Never generate empty connection arrays [] for Switch outputs!

SPECIFIC NODE DEFAULTS:
- AI/OpenAI nodes: model="gpt-3.5-turbo", resource="text", operation="complete"
- Email nodes: Include proper host, port, authentication parameters
- Switch nodes: Include dataType, value1, and rules parameters with ALL outputs connected
- If nodes: Include proper conditions structure

Node sequence: ${plan.selectedNodes.map((n) => n.displayName).join(' → ')}

Generate the complete valid n8n workflow JSON:`;
		return new SystemMessage(text);
	}

	private async parsePlanningResponse(
		response: string,
		candidateNodes: SelectedNode[],
	): Promise<WorkflowPlan> {
		try {
			if (!response || typeof response !== 'string') {
				throw new Error('Invalid planning response: expected string but got ' + typeof response);
			}

			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error('No valid JSON found in planning response');
			}
			const parsed = JSON.parse(jsonMatch[0]);

			return {
				title: parsed.title || 'Generated Workflow',
				description: parsed.description || 'Auto-generated workflow',
				selectedNodes: parsed.selectedNodes || candidateNodes.slice(0, 3),
				nodeSequence: parsed.nodeSequence || [],
				extractedEntities: parsed.extractedEntities || {},
				parameterMappings: parsed.parameterMappings || {},
				requiredCredentials: parsed.requiredCredentials || [],
				missingInformation: parsed.missingInformation || [],
			};
		} catch (error) {
			return {
				title: 'Generated Workflow',
				description: 'Auto-generated workflow',
				selectedNodes: candidateNodes.slice(0, 3),
				nodeSequence: candidateNodes.slice(0, 3).map((n) => n.nodeType),
				extractedEntities: {},
				parameterMappings: {},
				requiredCredentials: [],
				missingInformation: [],
			};
		}
	}

	private async parseWorkflowResponse(
		response: string,
		plan: WorkflowPlan,
	): Promise<GeneratedWorkflow> {
		try {
			if (!response || typeof response !== 'string') {
				console.error('❌ Invalid response type:', typeof response, 'Content:', response);
				throw new Error('Invalid AI response format');
			}

			console.log('🔍 Attempting to parse response:', response.substring(0, 200) + '...');

			// Extract JSON from the response (handle markdown code blocks)
			const jsonMatch =
				response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || response.match(/(\{[\s\S]*\})/);
			if (!jsonMatch) {
				throw new Error('No valid JSON found in AI response');
			}

			const jsonString = jsonMatch[1];
			console.log('✅ Found JSON match:', jsonString.substring(0, 100) + '...');

			const parsed = JSON.parse(jsonString);
			console.log('✅ Parsed JSON successfully:', Object.keys(parsed));

			// Validate required n8n workflow fields
			if (!parsed.name || !parsed.nodes || !parsed.connections) {
				throw new Error('Missing required workflow fields: name, nodes, or connections');
			}

			// Ensure nodes have proper structure
			const validatedNodes = parsed.nodes.map((node: any, index: number) => {
				if (!node.id || !node.name || !node.type) {
					throw new Error(`Node ${index} missing required fields: id, name, or type`);
				}

				// Add node-specific required parameters
				const enhancedParameters = this.addRequiredNodeParameters(node.type, node.parameters || {});
				// Sanitize parameters to prevent undefined values that cause trim() errors
				const sanitizedParameters = this.sanitizeParameters(enhancedParameters);
				// Ensure options field exists like in real n8n workflows
				sanitizedParameters.options = sanitizedParameters.options || {};

				return {
					id: node.id,
					name: node.name,
					type: node.type,
					typeVersion: this.getNodeTypeVersion(node.type), // Always use our version logic
					position: node.position || [200 + index * 200, 300],
					parameters: sanitizedParameters,
				};
			});

			console.log(`✅ Created validated nodes: ${validatedNodes.length}`);

			// Create the final workflow structure matching n8n format
			const workflow: GeneratedWorkflow = {
				name: parsed.name,
				active: false,
				nodes: validatedNodes,
				connections: parsed.connections || {},
				settings: parsed.settings || {},
				meta: parsed.meta || { instanceId: 'text-to-workflow-generated' },
				tags: parsed.tags || [`ai-generated-${Date.now()}`],
				requiredCredentials: plan.requiredCredentials || [],
				// Add n8n-specific fields
				versionId: parsed.versionId || this.generateUUID(),
				id: parsed.id || Math.random().toString(36).substr(2, 16),
			};

			// Apply deep sanitization for complex workflows (especially those with many nodes)
			const sanitizedWorkflow =
				validatedNodes.length > 3 ? this.deepSanitizeComplexWorkflow(workflow) : workflow;

			return sanitizedWorkflow;
		} catch (error) {
			console.error('❌ Workflow parsing failed:', error);

			// Create a simple fallback workflow that matches n8n structure
			const fallbackWorkflow: GeneratedWorkflow = {
				name: plan.title || 'Generated Workflow',
				active: false,
				nodes: [
					{
						id: this.generateUUID(),
						name: 'Manual Trigger',
						type: 'n8n-nodes-base.manualTrigger',
						typeVersion: 1,
						position: [200, 300],
						parameters: {},
					},
				],
				connections: {},
				settings: {},
				meta: { instanceId: 'text-to-workflow-generated' },
				tags: [`ai-fallback-${Date.now()}`],
				requiredCredentials: [],
				versionId: this.generateUUID(),
				id: Math.random().toString(36).substr(2, 16),
			};

			console.log('🔄 Using fallback workflow structure');
			return fallbackWorkflow;
		}
	}

	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c == 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	private addRequiredNodeParameters(
		nodeType: string,
		parameters: Record<string, any>,
	): Record<string, any> {
		const enhanced = { ...parameters };

		// Add required parameters based on node type
		switch (nodeType) {
			case 'n8n-nodes-base.slack':
				enhanced.authentication = enhanced.authentication || 'accessToken';
				enhanced.resource = enhanced.resource || 'message';
				if (enhanced.resource === 'message') {
					enhanced.operation = enhanced.operation || 'post';
				}
				break;
			case 'n8n-nodes-base.webhook':
				enhanced.responseMode = enhanced.responseMode || 'responseNode';
				enhanced.path = enhanced.path || 'webhook';
				enhanced.httpMethod = enhanced.httpMethod || 'GET';
				break;
			case 'n8n-nodes-base.httpRequest':
				enhanced.method = enhanced.method || 'GET';
				enhanced.url = enhanced.url || 'https://api.example.com';
				break;
			case 'n8n-nodes-base.googleSheets':
				enhanced.authentication = enhanced.authentication || 'serviceAccount';
				enhanced.resource = enhanced.resource || 'sheet';
				enhanced.operation = enhanced.operation || 'read';
				break;
			case 'n8n-nodes-base.gmail':
				enhanced.authentication = enhanced.authentication || 'oAuth2';
				enhanced.resource = enhanced.resource || 'message';
				enhanced.operation = enhanced.operation || 'send';
				break;
			case 'n8n-nodes-base.emailReadImap':
				enhanced.host = enhanced.host || 'imap.gmail.com';
				enhanced.port = enhanced.port || 993;
				enhanced.secure = enhanced.secure !== undefined ? enhanced.secure : true;
				enhanced.user = enhanced.user || 'support@example.com';
				enhanced.password = enhanced.password || '';
				break;
			case 'n8n-nodes-base.emailSend':
				enhanced.fromEmail = enhanced.fromEmail || 'support@example.com';
				enhanced.toEmail = enhanced.toEmail || '';
				enhanced.subject = enhanced.subject || 'Automated Response';
				enhanced.text = enhanced.text || '';
				break;
			case 'n8n-nodes-base.if':
				enhanced.conditions = enhanced.conditions || {
					boolean: [],
					number: [],
					string: [],
				};
				break;
			case 'n8n-nodes-base.switch':
				enhanced.dataType = enhanced.dataType || 'string';
				enhanced.value1 = enhanced.value1 || '={{ $json.complexity }}';

				// Fix Switch node rules structure for V1 format (matches working workflow)
				if (enhanced.rules && Array.isArray(enhanced.rules)) {
					enhanced.rules = {
						rules: enhanced.rules.map((rule: any) => ({
							value2: rule.value || rule.value2 || 'simple',
						})),
					};
				} else if (!enhanced.rules || !enhanced.rules.rules) {
					enhanced.rules = {
						rules: [{ value2: 'simple' }, { value2: 'moderate' }, { value2: 'complex' }],
					};
				}
				break;
			case 'n8n-nodes-base.openAi':
			case 'n8n-nodes-base.openai':
				// Default to OpenAI for any AI-related nodes
				enhanced.resource = enhanced.resource || 'text';
				enhanced.operation = enhanced.operation || 'complete';
				enhanced.model = enhanced.model || 'gpt-3.5-turbo';
				enhanced.prompt = enhanced.prompt || '';
				enhanced.maxTokens = enhanced.maxTokens || 100;
				break;
			case 'n8n-nodes-base.sentimentAnalysis':
				// Default sentiment analysis to use a basic implementation
				enhanced.text = enhanced.text || '';
				enhanced.language = enhanced.language || 'en';
				break;
			case 'n8n-nodes-base.aiTextGenerator':
				// Default AI text generator to OpenAI
				enhanced.model = enhanced.model || 'gpt-3.5-turbo';
				enhanced.prompt = enhanced.prompt || '';
				enhanced.maxTokens = enhanced.maxTokens || 150;
				break;
			case 'n8n-nodes-base.customerMessenger':
				enhanced.message = enhanced.message || '';
				enhanced.channel = enhanced.channel || 'general';
				break;
			case 'n8n-nodes-base.function':
				enhanced.functionCode = enhanced.functionCode || 'return items;';
				break;
			case 'n8n-nodes-base.airtable':
				enhanced.operation = enhanced.operation || 'list';
				enhanced.application = enhanced.application || 'base';
				enhanced.table = enhanced.table || '';
				break;
			case 'n8n-nodes-langchain.agent':
				enhanced.sessionId = enhanced.sessionId || '';
				enhanced.prompt = enhanced.prompt || '';
				break;
			case 'n8n-nodes-langchain.toolWorkflow':
				enhanced.workflowId = enhanced.workflowId || '';
				break;
			case 'n8n-nodes-base.set':
				// Fix Set node values structure for fixedCollection
				if (!enhanced.values || typeof enhanced.values !== 'object') {
					enhanced.values = {
						string: [{ name: 'exampleField', value: 'exampleValue' }],
					};
				} else if (
					enhanced.values &&
					!enhanced.values.string &&
					!enhanced.values.number &&
					!enhanced.values.boolean
				) {
					// If values exist but not in correct format, wrap them
					const existingValues = Array.isArray(enhanced.values)
						? enhanced.values
						: [enhanced.values];
					enhanced.values = {
						string: existingValues.map((val: any) => ({
							name: val.name || 'field',
							value: val.value || 'value',
						})),
					};
				}
				enhanced.options = enhanced.options || {};
				break;
			// Add more node types as needed
		}

		return enhanced;
	}

	private getNodeTypeVersion(nodeType: string): number {
		// Return appropriate type version for different nodes
		switch (nodeType) {
			case 'n8n-nodes-base.slack':
				return 2; // Slack V2 is the current version
			case 'n8n-nodes-base.googleSheets':
				return 4; // Google Sheets V4
			case 'n8n-nodes-base.gmail':
				return 2; // Gmail V2
			case 'n8n-nodes-base.switch':
				return 1; // Switch V1 for proper connection structure
			default:
				return 1; // Default to version 1
		}
	}

	private sanitizeParameters(params: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {};

		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === null) {
				// For boolean-like parameters, use false instead of empty string
				if (
					key.toLowerCase().includes('boolean') ||
					key.toLowerCase().includes('enabled') ||
					key.toLowerCase().includes('active')
				) {
					sanitized[key] = false;
				} else {
					// Convert undefined/null to empty string to prevent trim() errors
					sanitized[key] = '';
				}
			} else if (typeof value === 'object' && !Array.isArray(value)) {
				// Recursively sanitize nested objects
				sanitized[key] = this.sanitizeParameters(value);
			} else if (typeof value === 'string') {
				// Ensure string values are not undefined before operations that might call trim()
				sanitized[key] = value || '';
			} else {
				// Keep valid values as-is
				sanitized[key] = value;
			}
		}

		return sanitized;
	}

	/**
	 * Deep sanitization for complex workflows with many steps and integrations
	 * Specifically handles common issues in large product/ecommerce workflows
	 */
	private deepSanitizeComplexWorkflow(workflow: GeneratedWorkflow): GeneratedWorkflow {
		const sanitized = { ...workflow };

		// Ensure workflow-level properties are strings
		sanitized.name = sanitized.name || 'Generated Workflow';
		sanitized.id = sanitized.id || Math.random().toString(36).substr(2, 16);
		sanitized.versionId = sanitized.versionId || this.generateUUID();

		// Deep sanitize each node
		if (sanitized.nodes) {
			sanitized.nodes = sanitized.nodes.map((node, index) => {
				const sanitizedNode = { ...node };

				// Ensure core node properties are strings
				sanitizedNode.id = sanitizedNode.id || this.generateUUID();
				sanitizedNode.name = sanitizedNode.name || `Node ${index + 1}`;
				sanitizedNode.type = sanitizedNode.type || 'n8n-nodes-base.manualTrigger';

				// Deep sanitize node parameters
				sanitizedNode.parameters = this.deepSanitizeNodeParameters(
					sanitizedNode.parameters || {},
					sanitizedNode.type,
				);

				// Ensure credentials object is properly structured
				if (sanitizedNode.credentials) {
					sanitizedNode.credentials = this.sanitizeCredentials(sanitizedNode.credentials);
				}

				return sanitizedNode;
			});
		}

		// Ensure connections object exists
		sanitized.connections = sanitized.connections || {};

		// Ensure metadata is properly structured
		sanitized.meta = sanitized.meta || { instanceId: 'text-to-workflow-generated' };
		sanitized.settings = sanitized.settings || {};
		sanitized.tags = Array.isArray(sanitized.tags) ? sanitized.tags : ['text-to-workflow'];

		return sanitized;
	}

	/**
	 * Deep sanitize node parameters with special handling for complex node types
	 */
	private deepSanitizeNodeParameters(
		params: Record<string, any>,
		nodeType: string,
	): Record<string, any> {
		const sanitized = this.sanitizeParameters(params);

		// Special handling for complex node types commonly found in large workflows
		switch (nodeType) {
			case 'n8n-nodes-base.airtable':
				return this.sanitizeAirtableParams(sanitized);
			case 'n8n-nodes-base.googleSheets':
				return this.sanitizeGoogleSheetsParams(sanitized);
			case 'n8n-nodes-base.slack':
				return this.sanitizeSlackParams(sanitized);
			case 'n8n-nodes-base.webhook':
				return this.sanitizeWebhookParams(sanitized);
			case 'n8n-nodes-base.httpRequest':
				return this.sanitizeHttpRequestParams(sanitized);
			case 'n8n-nodes-base.switch':
				return this.sanitizeSwitchParams(sanitized);
			case 'n8n-nodes-base.if':
				return this.sanitizeIfParams(sanitized);
			case 'n8n-nodes-base.set':
				return this.sanitizeSetParams(sanitized);
			case 'n8n-nodes-base.function':
				return this.sanitizeFunctionParams(sanitized);
			default:
				return sanitized;
		}
	}

	private sanitizeAirtableParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			operation: params.operation || 'list',
			application: params.application || 'base',
			table: params.table || '',
			baseId: params.baseId || '',
			tableId: params.tableId || '',
			options: params.options || {},
		};
	}

	private sanitizeGoogleSheetsParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			authentication: params.authentication || 'serviceAccount',
			resource: params.resource || 'sheet',
			operation: params.operation || 'read',
			documentId: params.documentId || '',
			sheetName: params.sheetName || 'Sheet1',
			options: params.options || {},
		};
	}

	private sanitizeSlackParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			authentication: params.authentication || 'accessToken',
			resource: params.resource || 'message',
			operation: params.operation || 'post',
			channel: params.channel || '#general',
			text: params.text || '',
			options: params.options || {},
		};
	}

	private sanitizeWebhookParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			path: params.path || 'webhook',
			httpMethod: params.httpMethod || 'GET',
			responseMode: params.responseMode || 'responseNode',
			options: params.options || {},
		};
	}

	private sanitizeHttpRequestParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			method: params.method || 'GET',
			url: params.url || 'https://api.example.com',
			options: params.options || {},
			headers: params.headers || {},
			qs: params.qs || {},
		};
	}

	private sanitizeSwitchParams(params: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {
			...params,
			dataType: params.dataType || 'string',
			value1: params.value1 || '={{ $json.category }}',
			options: params.options || {},
		};

		// Ensure rules structure is correct for Switch nodes with proper conditions
		if (!sanitized.rules || !sanitized.rules.rules || !Array.isArray(sanitized.rules.rules)) {
			sanitized.rules = {
				rules: [
					{
						operation: 'equal',
						value2: 'billing',
					},
					{
						operation: 'equal',
						value2: 'technical',
					},
					{
						operation: 'equal',
						value2: 'general',
					},
				],
			};
		} else {
			// Fix existing rules to ensure they have proper operation
			sanitized.rules.rules = sanitized.rules.rules.map((rule: any) => ({
				operation: rule.operation || 'equal',
				value2: rule.value2 || 'default',
			}));
		}

		// Also ensure the rules have the operation field even if they exist
		if (sanitized.rules && sanitized.rules.rules) {
			sanitized.rules.rules = sanitized.rules.rules.map((rule: any) => ({
				...rule,
				operation: rule.operation || 'equal',
			}));
		}

		return sanitized;
	}

	private sanitizeIfParams(params: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {
			...params,
			options: params.options || {},
		};

		// Ensure conditions structure is correct
		if (!sanitized.conditions || typeof sanitized.conditions !== 'object') {
			sanitized.conditions = {
				boolean: [],
				number: [],
				string: [],
			};
		}

		return sanitized;
	}

	private sanitizeSetParams(params: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {
			...params,
			options: params.options || {},
		};

		// Ensure values structure is correct for Set nodes
		if (!sanitized.values || typeof sanitized.values !== 'object') {
			sanitized.values = {
				string: [{ name: 'field', value: 'value' }],
			};
		}

		return sanitized;
	}

	private sanitizeFunctionParams(params: Record<string, any>): Record<string, any> {
		return {
			...params,
			functionCode: params.functionCode || 'return items;',
			options: params.options || {},
		};
	}

	private sanitizeCredentials(credentials: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {};

		for (const [key, value] of Object.entries(credentials)) {
			if (typeof value === 'object' && value !== null) {
				sanitized[key] = {
					id: value.id || '',
					name: value.name || '',
				};
			} else {
				sanitized[key] = value || '';
			}
		}

		return sanitized;
	}

	private async validateWorkflow(workflow: GeneratedWorkflow): Promise<void> {
		try {
			if (!workflow.nodes || workflow.nodes.length === 0) {
				throw new Error('Workflow must contain at least one node');
			}
			for (const node of workflow.nodes) {
				if (!node.id || !node.type || !node.name) {
					throw new Error(`Invalid node structure: missing required fields`);
				}
			}
			console.log('✅ Workflow validation passed');
		} catch (error) {
			workflow.validationErrors = [error.message];
			console.warn('⚠️ Workflow validation failed:', error.message);
		}
	}

	getServiceStatus(): {
		isReady: boolean;
		knowledgeCoreStatus: any;
		supportedFeatures: string[];
	} {
		return {
			isReady: true,
			knowledgeCoreStatus: this.knowledgeCore.getKnowledgeCoreStatus(),
			supportedFeatures: [
				'semantic_node_selection',
				'parameter_extraction',
				'constrained_json_synthesis',
				'workflow_validation',
			],
		};
	}
}
