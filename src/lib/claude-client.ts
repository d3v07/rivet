/**
 * LLM client for agent AI calls
 * Uses Google Gemini via @google/genai with token tracking and graceful fallback
 * Supports both Gemini API (API key) and Vertex AI (GCP project)
 */

import { GoogleGenAI } from '@google/genai';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import { logInfo, logError, type LogContext } from '@/lib/logger';

let clientInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (clientInstance) return clientInstance;

  const geminiKey = process.env.GEMINI_API_KEY;
  const gcpProject = process.env.GCP_PROJECT_ID;
  const gcpLocation = process.env.GCP_LOCATION || 'us-central1';

  if (geminiKey) {
    clientInstance = new GoogleGenAI({ apiKey: geminiKey });
    return clientInstance;
  }

  if (gcpProject) {
    clientInstance = new GoogleGenAI({
      vertexai: true,
      project: gcpProject,
      location: gcpLocation,
    });
    return clientInstance;
  }

  return null;
}

export function isClaudeAvailable(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GCP_PROJECT_ID);
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
 * Call Gemini API with structured prompt, token tracking, and error handling
 */
export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const client = getClient();
  const context: LogContext = {
    correlationId: request.correlationId,
    toolName: request.toolName,
  };

  if (!client) {
    logInfo('Gemini API not available, using deterministic fallback', context);
    throw new ClaudeUnavailableError('GEMINI_API_KEY or GCP_PROJECT_ID not configured');
  }

  const startTime = Date.now();

  try {
    logInfo('Calling Gemini API', {
      ...context,
      promptLength: request.prompt.length,
      maxTokens: request.maxTokens ?? 4096,
    });

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${request.system}\n\n${request.prompt}`,
      config: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.3,
      },
    });

    const textContent = response.text ?? '';
    const inputTokens = response.usageMetadata?.promptTokenCount ?? estimateTokens(request.prompt);
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? estimateTokens(textContent);

    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: `gemini_api:${request.toolName}`,
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
      status: 'success',
    });

    logInfo('Gemini API response received', {
      ...context,
      inputTokens,
      outputTokens,
      latencyMs,
    });

    return {
      content: textContent,
      inputTokens,
      outputTokens,
      stopReason: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof ClaudeUnavailableError) throw error;

    logError('Gemini API call failed', context, error as Error);

    recordInvocation({
      toolName: `gemini_api:${request.toolName}`,
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
 * Call Gemini with JSON output parsing
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
