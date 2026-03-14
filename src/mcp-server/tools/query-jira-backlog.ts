/**
 * MCP tool: query_jira_backlog
 * Fetches Jira issues tagged with "Ready for Engineering" status
 * Returns sanitized payloads to prevent prompt injection
 */

import { JiraClient } from '@/mcp-server/clients/jira';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  QueryJiraBacklogInputSchema,
  QueryJiraBacklogOutputSchema,
  type QueryJiraBacklogOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';

export async function executeQueryJiraBacklog(input: unknown): Promise<QueryJiraBacklogOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    // Validate input
    const validatedInput = QueryJiraBacklogInputSchema.parse(input);

    // Initialize Jira client
    const jiraBaseUrl = process.env.JIRA_BASE_URL;
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraToken = process.env.JIRA_API_TOKEN;

    if (!jiraBaseUrl || !jiraEmail || !jiraToken) {
      logInfo('Using mock Jira data (credentials not configured)', { correlationId });
      const mockResult = createMockResponse();
      const latencyMs = Date.now() - startTime;
      recordInvocation({
        toolName: 'query_jira_backlog',
        inputTokens: estimateTokens(JSON.stringify(validatedInput)),
        outputTokens: estimateTokens(JSON.stringify(mockResult)),
        latencyMs,
        timestamp: new Date().toISOString(),
        correlationId,
        status: 'success',
      });
      return mockResult;
    }

    const jiraClient = new JiraClient(jiraBaseUrl, jiraEmail, jiraToken);

    // Fetch issues
    const issues = await jiraClient.fetchIssuesByProject(
      validatedInput.projectKey,
      validatedInput.statusFilter,
      validatedInput.maxResults,
      correlationId
    );

    // Sanitize and clean the response
    const cleaned = cleanExternalData({ issues, total: issues.length });

    logInfo('query_jira_backlog executed', {
      correlationId,
      issueCount: issues.length,
      bytesRemoved: cleaned.bytesRemoved,
      patternsFound: cleaned.sanitizationReport?.patternsFound.length || 0,
    });

    // Record token usage
    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'query_jira_backlog',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = QueryJiraBacklogOutputSchema.parse({
      issues: cleaned.data,
      total: issues.length,
      sanitizationApplied: true,
    });

    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'query_jira_backlog',
      inputTokens: estimateTokens(JSON.stringify(input)),
      outputTokens: 0,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Mock response for development (when Jira credentials not configured)
 */
function createMockResponse(): QueryJiraBacklogOutput {
  return {
    issues: [
      {
        key: 'PROJ-1',
        summary: 'Implement authentication system',
        description: 'Add OAuth 2.0 authentication for the application',
        status: 'Ready for Engineering',
        priority: 'High',
        assignee: 'dev@example.com',
        created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        key: 'PROJ-2',
        summary: 'Add database migrations',
        description: 'Create migration framework and initial schema',
        status: 'Ready for Engineering',
        priority: 'High',
        assignee: null,
        created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updated: new Date().toISOString(),
      },
    ],
    total: 2,
    sanitizationApplied: false,
  };
}
