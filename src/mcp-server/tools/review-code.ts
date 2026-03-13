/**
 * MCP tool: review_code
 * Reviews code for security vulnerabilities using Security Analyst agent
 */

import { SecurityAnalystAgent } from '@/agents/security-analyst';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  ReviewCodeInputSchema,
  ReviewCodeOutputSchema,
  type ReviewCodeOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';

export async function executeReviewCode(input: unknown): Promise<ReviewCodeOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    const validatedInput = ReviewCodeInputSchema.parse(input);
    const agent = new SecurityAnalystAgent(correlationId);

    const review = await agent.reviewCode(validatedInput.issueKey, validatedInput.files);
    const cleaned = cleanExternalData(review);

    logInfo('review_code completed', {
      correlationId,
      issueKey: validatedInput.issueKey,
      fileCount: validatedInput.files.length,
      findingCount: review.findings.length,
      overallSeverity: review.overallSeverity,
      bytesRemoved: cleaned.bytesRemoved,
    });

    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'review_code',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = ReviewCodeOutputSchema.parse({ review: cleaned.data });
    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'review_code',
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
