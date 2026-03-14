/**
 * MCP Server entry point
 * Sets up the Model Context Protocol server with Jira and GCP tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, handleToolCall } from '@/mcp-server/handlers';
import { logInfo, logError, createCorrelationId } from '@/lib/logger';

const server = new Server(
  { name: 'Rivet MCP Server', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOL_DEFINITIONS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await handleToolCall(
    request.params.name,
    request.params.arguments as Record<string, unknown>
  );
  return result as { content: { type: 'text'; text: string }[]; isError?: boolean };
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
