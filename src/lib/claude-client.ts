/**
 * Claude API client for agent LLM calls
 * Wraps @anthropic-ai/sdk with token tracking and graceful fallback
 */

import Anthropic from '@anthropic-ai/sdk';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import { logInfo, logError, type LogContext } from '@/lib/logger';

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  clientInstance = new Anthropic({ apiKey });
  return clientInstance;
}

export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ClaudeRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  correlationId: string;
  toolName: string;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

/**
 * Call Claude API with structured prompt, token tracking, and error handling
 */
export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const client = getClient();
  const context: LogContext = {
    correlationId: request.correlationId,
    toolName: request.toolName,
  };

  if (!client) {
    logInfo('Claude API not available, using deterministic fallback', context);
    throw new ClaudeUnavailableError('ANTHROPIC_API_KEY not configured');
  }

  const startTime = Date.now();

  try {
    logInfo('Calling Claude API', {
      ...context,
      promptLength: request.prompt.length,
      maxTokens: request.maxTokens ?? 4096,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.3,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: `claude_api:${request.toolName}`,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
      status: 'success',
    });

    logInfo('Claude API response received', {
      ...context,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
      latencyMs,
    });

    return {
      content: textContent,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof ClaudeUnavailableError) throw error;

    logError('Claude API call failed', context, error as Error);

    recordInvocation({
      toolName: `claude_api:${request.toolName}`,
      inputTokens: estimateTokens(request.prompt),
      outputTokens: 0,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

export class ClaudeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeUnavailableError';
  }
}

/**
 * Call Claude with JSON output parsing
 */
export async function callClaudeJson<T>(
  request: ClaudeRequest,
  parser: (raw: string) => T
): Promise<T> {
  const response = await callClaude({
    ...request,
    system: request.system + '\n\nRespond with valid JSON only. No markdown, no code fences.',
  });

  const cleaned = response.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return parser(cleaned);
}

/**
 * Reset the client instance (for testing)
 */
export function resetClient(): void {
  clientInstance = null;
}
