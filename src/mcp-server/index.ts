/**
 * MCP Server entry point
 * Sets up the Model Context Protocol server with Jira and GCP tools
 * Supports both stdio and HTTP transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog';
import { executeFetchGcpCarbon } from '@/mcp-server/tools/fetch-gcp-carbon';
import { executeGetComputePricing } from '@/mcp-server/tools/get-compute-pricing';
import { logInfo, logError, createCorrelationId } from '@/lib/logger';

const server = new Server(
  {
    name: 'Rivet MCP Server',
    version: '0.1.0',
  },
  {
    capabilities: {},
  }
);

// Register tools
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
