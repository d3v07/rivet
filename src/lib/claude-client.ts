/**
 * LLM client for agent AI calls
 * Supports Ollama (local), Gemini API (API key), and Vertex AI (GCP project)
 * Priority: Ollama → Gemini → Vertex AI
 */

import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import { logInfo, logError, type LogContext } from '@/lib/logger';

export type LLMProvider = 'ollama' | 'gemini' | 'vertex';

let geminiClient: GoogleGenAI | null = null;

export function getActiveProvider(): LLMProvider | null {
  if (process.env.OLLAMA_BASE_URL) return 'ollama';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GCP_PROJECT_ID) return 'vertex';
  return null;
}

function getGeminiClient(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;

  const geminiKey = process.env.GEMINI_API_KEY;
  const gcpProject = process.env.GCP_PROJECT_ID;
  const gcpLocation = process.env.GCP_LOCATION || 'us-central1';

  if (geminiKey) {
    geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    return geminiClient;
  }

  if (gcpProject) {
    geminiClient = new GoogleGenAI({
      vertexai: true,
      project: gcpProject,
      location: gcpLocation,
    });
    return geminiClient;
  }

  return null;
}

export function isClaudeAvailable(): boolean {
  return getActiveProvider() !== null;
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

async function callOllama(request: ClaudeRequest, context: LogContext): Promise<ClaudeResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  const startTime = Date.now();

  try {
    logInfo('Calling Ollama', {
      ...context,
      model,
      promptLength: request.prompt.length,
    });

    const response = await axios.post(
      `${baseUrl}/api/chat`,
      {
        model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
        stream: false,
        options: {
          num_predict: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.3,
        },
      },
      { timeout: 120000 }
    );

    const textContent = response.data.message?.content ?? '';
    const inputTokens = response.data.prompt_eval_count ?? estimateTokens(request.prompt);
    const outputTokens = response.data.eval_count ?? estimateTokens(textContent);
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: `ollama:${request.toolName}`,
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
      status: 'success',
    });

    logInfo('Ollama response received', {
      ...context,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
    });

    return { content: textContent, inputTokens, outputTokens, stopReason: null };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logError('Ollama call failed', context, error as Error);

    recordInvocation({
      toolName: `ollama:${request.toolName}`,
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

async function callGemini(request: ClaudeRequest, context: LogContext): Promise<ClaudeResponse> {
  const client = getGeminiClient()!;
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

    return { content: textContent, inputTokens, outputTokens, stopReason: null };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

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

export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const provider = getActiveProvider();
  const context: LogContext = {
    correlationId: request.correlationId,
    toolName: request.toolName,
  };

  if (!provider) {
    logInfo('No LLM provider available, using deterministic fallback', context);
    throw new ClaudeUnavailableError(
      'No LLM provider configured. Set OLLAMA_BASE_URL, GEMINI_API_KEY, or GCP_PROJECT_ID'
    );
  }

  if (provider === 'ollama') {
    return callOllama(request, context);
  }

  return callGemini(request, context);
}

export class ClaudeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeUnavailableError';
  }
}

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

export function resetClient(): void {
  geminiClient = null;
}
