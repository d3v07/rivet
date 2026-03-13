/**
 * MCP tool: execute_plan
 * Executes an execution plan using the Developer agent
 */

import { DeveloperAgent } from '@/agents/developer';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  ExecutePlanInputSchema,
  ExecutePlanOutputSchema,
  type ExecutePlanOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';
import type { ExecutionPlan } from '@/types/index';

export async function executeExecutePlan(input: unknown): Promise<ExecutePlanOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    // Validate input
    const validatedInput = ExecutePlanInputSchema.parse(input);

    // Parse plan data
    const plan: ExecutionPlan = validatedInput.plan;

    // Create developer agent instance
    const developer = new DeveloperAgent(correlationId);

    // Execute plan
    const progress = await developer.executePlan(plan);

    // Sanitize and clean the response
    const cleaned = cleanExternalData(progress);

    logInfo('execute_plan completed', {
      correlationId,
      planId: plan.planId,
      issueKey: plan.issueKey,
      completedSteps: progress.completedSteps,
      totalSteps: progress.totalSteps,
      status: progress.status,
      bytesRemoved: cleaned.bytesRemoved,
    });

    // Record token usage
    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'execute_plan',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = ExecutePlanOutputSchema.parse({
      progress: cleaned.data,
    });

    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'execute_plan',
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
