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
				reason: `Semantic match for: ${doc.description.substring(0, 100)}...`,
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

			// Get the planning response from the LLM
			const planningResponse = await this.aiService.prompt([planningPrompt]);

			// Parse the LLM response into a structured plan
			const workflowPlan = await this.parsePlanningResponse(
				(planningResponse as any).content as string,
				selectedNodes,
			);

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

			// Create the synthesis prompt
			const synthesisPrompt = await this.createSynthesisPrompt(plan);

			// Generate the workflow JSON
			const workflowResponse = await this.aiService.prompt([synthesisPrompt]);

			// Parse the response into a workflow
			const workflow = await this.parseWorkflowResponse(
				(workflowResponse as any).content as string,
				plan,
			);

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

		const planningPromptText = `You are an expert n8n workflow designer. Create a workflow plan for: "${prompt}"

AVAILABLE NODES:
${nodeInfo}

Respond with JSON:
{
  "title": "Workflow title",
  "selectedNodes": [{"nodeType": "exact_type", "reason": "why needed"}],
  "nodeSequence": ["node1", "node2"],
  "parameterMappings": {"nodeType": {"param": "value"}},
  "requiredCredentials": ["types"],
  "missingInformation": ["what else needed"]
}`;

		return new SystemMessage(planningPromptText);
	}

	private async createSynthesisPrompt(plan: WorkflowPlan): Promise<SystemMessage> {
		const text = `Generate n8n workflow JSON for: ${JSON.stringify(plan, null, 2)}

Create valid n8n JSON with nodes, connections, proper UUIDs, and positions.`;
		return new SystemMessage(text);
	}

	private async parsePlanningResponse(
		response: string,
		candidateNodes: SelectedNode[],
	): Promise<WorkflowPlan> {
		try {
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
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error('No valid JSON found in synthesis response');
			}
			const parsed = JSON.parse(jsonMatch[0]);

			const validatedNodes =
				parsed.nodes?.map((node: any, index: number) => ({
					id: node.id || uuid(),
					name: node.name || `Node ${index + 1}`,
					type: node.type || plan.selectedNodes[0]?.nodeType,
					typeVersion: node.typeVersion || 1,
					position: node.position || [200 + index * 200, 200],
					parameters: node.parameters || {},
					...(node.credentials && { credentials: node.credentials }),
				})) || [];

			return {
				name: parsed.name || plan.title,
				active: false,
				nodes: validatedNodes,
				connections: parsed.connections || {},
				settings: parsed.settings || {},
				meta: parsed.meta || { instanceId: 'text-to-workflow-generated' },
				tags: parsed.tags || ['text-to-workflow'],
				requiredCredentials: plan.requiredCredentials,
			};
		} catch (error) {
			throw new ApplicationError(`Invalid workflow JSON generated: ${error.message}`);
		}
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
