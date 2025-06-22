import { Post, Get, RestController } from '@/decorators';
import { AIRequest } from '@/requests';
import { AIService } from '@/services/ai.service';
import { FailedDependencyError } from '@/errors/response-errors/failed-dependency.error';

import type { GeneratedWorkflow } from '@/services/ai/schemas/textToWorkflow';

@RestController('/ai')
export class AIController {
	constructor(private readonly aiService: AIService) {}

	/**
	 * Generate CURL request and additional HTTP Node metadata for given service and request
	 */
	@Post('/generate-curl')
	async generateCurl(req: AIRequest.GenerateCurl): Promise<{ curl: string; metadata?: object }> {
		const { service, request } = req.body;

		try {
			return await this.aiService.generateCurl(service, request);
		} catch (aiServiceError) {
			throw new FailedDependencyError(
				(aiServiceError as Error).message ||
					'Failed to generate HTTP Request Node parameters due to an issue with an external dependency. Please try again later.',
			);
		}
	}

	/**
	 * Generate n8n workflow from natural language description
	 */
	@Post('/generate-workflow')
	async generateWorkflow(req: AIRequest.GenerateWorkflow): Promise<GeneratedWorkflow> {
		try {
			return await this.aiService.generateWorkflow(req.body);
		} catch (aiServiceError) {
			throw new FailedDependencyError(
				(aiServiceError as Error).message ||
					'Failed to generate workflow due to an issue with an external dependency. Please try again later.',
			);
		}
	}

	/**
	 * Get the status of text-to-workflow services
	 */
	@Get('/text-to-workflow/status')
	async getTextToWorkflowStatus() {
		try {
			return this.aiService.getTextToWorkflowStatus();
		} catch (aiServiceError) {
			throw new FailedDependencyError(
				(aiServiceError as Error).message || 'Failed to get text-to-workflow status.',
			);
		}
	}

	/**
	 * Manually sync the knowledge core (admin endpoint)
	 */
	@Post('/knowledge-core/sync')
	async syncKnowledgeCore() {
		try {
			return await this.aiService.syncKnowledgeCore();
		} catch (aiServiceError) {
			throw new FailedDependencyError(
				(aiServiceError as Error).message || 'Failed to sync knowledge core.',
			);
		}
	}
}
