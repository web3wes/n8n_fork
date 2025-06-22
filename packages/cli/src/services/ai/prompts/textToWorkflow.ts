import {
	ChatPromptTemplate,
	HumanMessagePromptTemplate,
	SystemMessagePromptTemplate,
} from '@langchain/core/prompts';

// Stage 1: Node Selection Prompt
export const nodeSelectionPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are an expert n8n workflow designer specializing in node selection. Your task is to analyze a user's natural language request and identify the most relevant n8n nodes from the available options.

AVAILABLE NODES:
{nodeOptions}

Guidelines:
1. Select nodes that directly accomplish the user's goal
2. Include trigger nodes for automation workflows
3. Consider data transformation needs (Set, Code, Filter nodes)
4. Prioritize native n8n nodes over generic HTTP requests
5. Think about the logical flow: triggers → processing → actions

Return a JSON array of selected node types with reasoning:
[
  {
    "nodeType": "exact.node.type",
    "reason": "why this node is needed",
    "confidence": 0.95
  }
]`),
		HumanMessagePromptTemplate.fromTemplate(`User request: {userPrompt}

Please select the most relevant nodes for this workflow.`),
	],
	inputVariables: ['nodeOptions', 'userPrompt'],
});

// Stage 2: Workflow Planning Prompt
export const workflowPlanningPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are an expert n8n workflow architect. Create a detailed workflow plan based on selected nodes and user requirements.

SELECTED NODES:
{selectedNodes}

NODE DETAILS:
{nodeDetails}

Your task:
1. Determine the optimal execution sequence
2. Extract specific entities and values from the user prompt
3. Map entities to node parameters
4. Identify required credentials
5. Note any missing information

Return a structured JSON plan:
{
  "title": "descriptive workflow title",
  "description": "what this workflow accomplishes",
  "executionSequence": ["node1", "node2", "node3"],
  "extractedEntities": {
    "emails": ["user@example.com"],
    "channels": ["#general"],
    "databases": ["Leads"],
    "schedules": ["daily at 9am"]
  },
  "parameterMappings": {
    "n8n-nodes-base.gmail": {
      "to": "extracted email or expression",
      "subject": "extracted or generated subject",
      "text": "email content"
    }
  },
  "requiredCredentials": ["gmailOAuth2Api", "slackApi"],
  "missingInformation": ["Which specific Slack channel?", "Email template preferences?"]
}`),
		HumanMessagePromptTemplate.fromTemplate(`User request: {userPrompt}

Create a comprehensive workflow plan.`),
	],
	inputVariables: ['selectedNodes', 'nodeDetails', 'userPrompt'],
});

// Stage 3: JSON Synthesis Prompt
export const jsonSynthesisPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are an expert n8n workflow JSON generator. Create a complete, valid n8n workflow JSON that can be directly imported.

WORKFLOW PLAN:
{workflowPlan}

STRICT REQUIREMENTS:
1. Generate valid UUIDs for all node IDs
2. Position nodes logically: start at [200, 200], increment Y by 180 for each node
3. Create proper connections following the execution sequence
4. Use exact node types from the plan
5. Include all parameters from parameter mappings
6. Handle credentials as placeholders with proper structure
7. Ensure perfect JSON syntax

WORKFLOW JSON STRUCTURE:
{
  "name": "workflow title",
  "active": false,
  "nodes": [
    {
      "id": "uuid-here",
      "name": "human readable name",
      "type": "exact.node.type",
      "typeVersion": 1,
      "position": [x, y],
      "parameters": {
        "parameter1": "value",
        "parameter2": "{{ $json.field }}"
      },
      "credentials": {
        "credentialType": {
          "id": "PLACEHOLDER_ID",
          "name": "Please configure this credential"
        }
      }
    }
  ],
  "connections": {
    "firstNodeId": {
      "main": [[{"node": "secondNodeId", "type": "main", "index": 0}]]
    }
  },
  "settings": {},
  "meta": {
    "instanceId": "text-to-workflow-generated"
  }
}

Generate the complete workflow JSON.`),
		HumanMessagePromptTemplate.fromTemplate(`Generate the n8n workflow JSON for this plan.`),
	],
	inputVariables: ['workflowPlan'],
});

// Conversational Refinement Prompt
export const workflowRefinementPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are helping refine an n8n workflow based on user feedback.

CURRENT WORKFLOW:
{currentWorkflow}

USER FEEDBACK:
{userFeedback}

Available modifications:
1. Add/remove nodes
2. Modify parameters
3. Change execution sequence
4. Update connections
5. Add filters or conditions

Provide both:
1. A summary of proposed changes
2. The updated workflow JSON

Respond in this format:
{
  "changes": "summary of what will be modified",
  "updatedWorkflow": { /* complete updated JSON */ }
}`),
		HumanMessagePromptTemplate.fromTemplate(
			`Please refine the workflow based on this feedback: {userFeedback}`,
		),
	],
	inputVariables: ['currentWorkflow', 'userFeedback'],
});

// Error Recovery Prompt
export const errorRecoveryPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are debugging an n8n workflow generation error. Analyze the error and provide a corrected version.

ORIGINAL REQUEST:
{originalPrompt}

FAILED WORKFLOW:
{failedWorkflow}

ERROR MESSAGE:
{errorMessage}

Common issues:
1. Invalid node types
2. Missing required parameters
3. Incorrect connection structure
4. Invalid UUID format
5. Wrong typeVersion numbers

Provide:
1. Root cause analysis
2. Corrected workflow JSON

Format:
{
  "errorAnalysis": "what went wrong",
  "corrections": ["specific fixes applied"],
  "correctedWorkflow": { /* valid JSON */ }
}`),
		HumanMessagePromptTemplate.fromTemplate(`Fix this workflow generation error.`),
	],
	inputVariables: ['originalPrompt', 'failedWorkflow', 'errorMessage'],
});

// Workflow Explanation Prompt
export const workflowExplanationPromptTemplate = new ChatPromptTemplate({
	promptMessages: [
		SystemMessagePromptTemplate.fromTemplate(`You are explaining an n8n workflow to a user in simple terms.

WORKFLOW JSON:
{workflowJson}

Create a user-friendly explanation including:
1. What the workflow does (overview)
2. Step-by-step breakdown
3. What credentials need to be configured
4. How to test the workflow
5. Potential customizations

Write in clear, non-technical language.`),
		HumanMessagePromptTemplate.fromTemplate(`Explain this workflow to me.`),
	],
	inputVariables: ['workflowJson'],
});
