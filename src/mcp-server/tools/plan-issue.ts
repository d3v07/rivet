/**
 * MCP tool: plan_issue
 * Generates structured execution plans from Jira issues using the Planner agent
 */

import { PlannerAgent } from '@/agents/planner';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  PlanIssueInputSchema,
  PlanIssueOutputSchema,
  type PlanIssueOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';
import type { JiraIssue } from '@/types/index';

export async function executePlanIssue(input: unknown): Promise<PlanIssueOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    // Validate input
    const validatedInput = PlanIssueInputSchema.parse(input);

    // Create planner agent instance
    const planner = new PlannerAgent(correlationId);

    // Parse issue data
    const issue: JiraIssue = {
      key: validatedInput.issueKey,
      summary: validatedInput.summary,
      description: validatedInput.description || null,
      status: validatedInput.status || 'Unknown',
      priority: validatedInput.priority || 'Medium',
      assignee: validatedInput.assignee || null,
      created: validatedInput.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    // Generate execution plan
    const plan = await planner.planIssue(issue);

    // Sanitize and clean the response
    const cleaned = cleanExternalData(plan);

    logInfo('plan_issue executed', {
      correlationId,
      issueKey: validatedInput.issueKey,
      stepCount: plan.steps.length,
      riskLevel: plan.riskSummary,
      bytesRemoved: cleaned.bytesRemoved,
    });

    // Record token usage
    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'plan_issue',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = PlanIssueOutputSchema.parse({
      plan: cleaned.data,
    });

    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'plan_issue',
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
