/**
 * MCP tool handler — routes tool calls to executors
 * Extracted from index.ts for testability
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog';
import { executeFetchGcpCarbon } from '@/mcp-server/tools/fetch-gcp-carbon';
import { executeGetComputePricing } from '@/mcp-server/tools/get-compute-pricing';
import { executePlanIssue } from '@/mcp-server/tools/plan-issue';
import { executeExecutePlan } from '@/mcp-server/tools/execute-plan';
import { executeReviewCode } from '@/mcp-server/tools/review-code';
import { logInfo, logError, createCorrelationId } from '@/lib/logger';

export const TOOL_DEFINITIONS = [
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
] as const;

type ToolArgs = Record<string, unknown>;

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const EXECUTORS: Record<string, (args: ToolArgs) => Promise<unknown>> = {
  query_jira_backlog: executeQueryJiraBacklog,
  fetch_gcp_carbon_metrics: executeFetchGcpCarbon,
  get_compute_pricing: executeGetComputePricing,
  plan_issue: executePlanIssue,
  execute_plan: executeExecutePlan,
  review_code: executeReviewCode,
};

export async function handleToolCall(toolName: string, args: ToolArgs = {}): Promise<ToolResult> {
  const correlationId = createCorrelationId();

  try {
    logInfo('Tool called', { correlationId, toolName });

    const executor = EXECUTORS[toolName];
    if (!executor) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    const result = await executor({ ...args, correlationId });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logError('Tool execution failed', { correlationId }, error as Error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error executing tool: ${errorMessage}` }],
      isError: true,
    };
  }
}
