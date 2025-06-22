import { z } from 'zod';

// Schema for workflow generation request
export const workflowGenerationRequestSchema = z.object({
	prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
	userId: z.string().optional(),
	includeCredentials: z.boolean().default(false),
	maxNodes: z.number().min(1).max(20).default(10),
	conversational: z.boolean().default(false),
});

// Schema for selected nodes from Stage 1
export const selectedNodeSchema = z.object({
	nodeType: z.string(),
	displayName: z.string(),
	category: z.string(),
	confidence: z.number().min(0).max(1),
	reason: z.string(),
});

// Schema for workflow plan from Stage 2
export const workflowPlanSchema = z.object({
	title: z.string(),
	description: z.string(),
	selectedNodes: z.array(selectedNodeSchema),
	nodeSequence: z.array(z.string()),
	extractedEntities: z.record(z.any()),
	parameterMappings: z.record(z.record(z.any())),
	requiredCredentials: z.array(z.string()),
	missingInformation: z.array(z.string()),
});

// Schema for workflow node
export const workflowNodeSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	type: z.string(),
	typeVersion: z.number().positive(),
	position: z.tuple([z.number(), z.number()]),
	parameters: z.record(z.any()),
	credentials: z.record(z.any()).optional(),
});

// Schema for generated workflow from Stage 3
export const generatedWorkflowSchema = z.object({
	name: z.string(),
	active: z.boolean(),
	nodes: z.array(workflowNodeSchema),
	connections: z.record(z.any()),
	settings: z.record(z.any()).optional(),
	meta: z.record(z.any()).optional(),
	tags: z.array(z.string()).optional(),
	requiredCredentials: z.array(z.string()),
	validationErrors: z.array(z.string()).optional(),
});

// Schema for workflow refinement request
export const workflowRefinementSchema = z.object({
	currentWorkflow: generatedWorkflowSchema,
	userFeedback: z.string().min(5, 'Feedback must be at least 5 characters'),
	refinementType: z
		.enum(['modify', 'add_node', 'remove_node', 'change_parameters', 'fix_connections'])
		.optional(),
});

// Schema for error recovery
export const errorRecoverySchema = z.object({
	originalPrompt: z.string(),
	failedWorkflow: z.record(z.any()),
	errorMessage: z.string(),
	attemptNumber: z.number().min(1).max(3).default(1),
});

// Schema for workflow explanation request
export const workflowExplanationSchema = z.object({
	workflowJson: z.record(z.any()),
	explanationLevel: z.enum(['basic', 'detailed', 'technical']).default('basic'),
	includeSetupSteps: z.boolean().default(true),
});

// Schema for knowledge core status
export const knowledgeCoreStatusSchema = z.object({
	lastSync: z.date().nullable(),
	isInitialized: z.boolean(),
	nodeCount: z.number().nonnegative(),
	syncErrors: z.array(z.string()).optional(),
});

// Schema for service status
export const serviceStatusSchema = z.object({
	isReady: z.boolean(),
	knowledgeCoreStatus: knowledgeCoreStatusSchema,
	supportedFeatures: z.array(z.string()),
	version: z.string().optional(),
	lastActivity: z.date().optional(),
});

// Schema for conversation context (for iterative building)
export const conversationContextSchema = z.object({
	sessionId: z.string().uuid(),
	currentWorkflow: generatedWorkflowSchema.optional(),
	conversationHistory: z.array(
		z.object({
			role: z.enum(['user', 'assistant']),
			content: z.string(),
			timestamp: z.date(),
		}),
	),
	userPreferences: z
		.object({
			preferredNodes: z.array(z.string()).optional(),
			excludedNodes: z.array(z.string()).optional(),
			defaultCredentials: z.record(z.string()).optional(),
			complexity: z.enum(['simple', 'intermediate', 'advanced']).default('intermediate'),
		})
		.optional(),
});

// Type exports for TypeScript
export type WorkflowGenerationRequest = z.infer<typeof workflowGenerationRequestSchema>;
export type SelectedNode = z.infer<typeof selectedNodeSchema>;
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type GeneratedWorkflow = z.infer<typeof generatedWorkflowSchema>;
export type WorkflowRefinement = z.infer<typeof workflowRefinementSchema>;
export type ErrorRecovery = z.infer<typeof errorRecoverySchema>;
export type WorkflowExplanation = z.infer<typeof workflowExplanationSchema>;
export type KnowledgeCoreStatus = z.infer<typeof knowledgeCoreStatusSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ConversationContext = z.infer<typeof conversationContextSchema>;
