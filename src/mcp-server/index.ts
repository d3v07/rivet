/**
 * MCP Server entry point
 * Sets up the Model Context Protocol server with Jira and GCP tools
 * Supports both stdio and HTTP transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog';
import { executeFetchGcpCarbon } from '@/mcp-server/tools/fetch-gcp-carbon';
import { executeGetComputePricing } from '@/mcp-server/tools/get-compute-pricing';
import { executePlanIssue } from '@/mcp-server/tools/plan-issue';
import { executeExecutePlan } from '@/mcp-server/tools/execute-plan';
import { executeReviewCode } from '@/mcp-server/tools/review-code';
import { logInfo, logError, createCorrelationId } from '@/lib/logger';

const server = new Server(
  {
    name: 'Rivet MCP Server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_jira_backlog',
      description:
        'Fetch Jira issues tagged "Ready for Engineering". Returns sanitized payloads to prevent prompt injection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          projectKey: { type: 'string', description: 'Jira project key (e.g., PROJ)' },
          statusFilter: {
            type: 'string',
            enum: ['Ready for Engineering', 'In Progress', 'Done', 'Backlog'],
            description: 'Filter by issue status',
          },
          maxResults: { type: 'number', description: 'Maximum results (1-100, default 10)' },
        },
        required: ['projectKey'],
      },
    },
    {
      name: 'plan_issue',
      description: 'Generate a structured execution plan for a Jira issue using the Planner agent.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          issueKey: { type: 'string', description: 'Jira issue key (e.g., PROJ-123)' },
          summary: { type: 'string', description: 'Issue title' },
          description: { type: 'string', description: 'Issue description' },
          priority: { type: 'string', description: 'Priority (Critical, High, Medium, Low)' },
        },
        required: ['issueKey', 'summary'],
      },
    },
    {
      name: 'execute_plan',
      description: 'Execute an execution plan using the Developer agent with TDD workflow.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plan: { type: 'object', description: 'Execution plan from plan_issue' },
        },
        required: ['plan'],
      },
    },
    {
      name: 'review_code',
      description: 'Review code for security vulnerabilities (OWASP Top 10, secrets, auth issues).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          issueKey: { type: 'string', description: 'Jira issue key' },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            },
            description: 'Code files to review',
          },
        },
        required: ['issueKey', 'files'],
      },
    },
    {
      name: 'fetch_gcp_carbon_metrics',
      description: 'Fetch carbon intensity metrics for GCP regions to enable green deployments.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          projectId: { type: 'string', description: 'GCP project ID' },
          regions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific regions (omit for all)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_compute_pricing',
      description: 'Get GCP compute pricing for machine types across regions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          projectId: { type: 'string', description: 'GCP project ID' },
          machineTypes: { type: 'array', items: { type: 'string' } },
          regions: { type: 'array', items: { type: 'string' } },
        },
        required: ['projectId'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const correlationId = createCorrelationId();

  try {
    logInfo('Tool called', {
      correlationId,
      toolName: request.params.name,
    });

    switch (request.params.name) {
      case 'query_jira_backlog': {
        const result = await executeQueryJiraBacklog({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'fetch_gcp_carbon_metrics': {
        const result = await executeFetchGcpCarbon({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_compute_pricing': {
        const result = await executeGetComputePricing({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'plan_issue': {
        const result = await executePlanIssue({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'execute_plan': {
        const result = await executeExecutePlan({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'review_code': {
        const result = await executeReviewCode({
          ...request.params.arguments,
          correlationId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    logError('Tool execution failed', { correlationId }, error as Error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error executing tool: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo('MCP Server running', { correlationId: createCorrelationId() });
}

main().catch((error) => {
  logError('Server startup failed', { correlationId: createCorrelationId() }, error);
  process.exit(1);
});
