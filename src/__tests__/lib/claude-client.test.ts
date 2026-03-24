import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isClaudeAvailable,
  ClaudeUnavailableError,
  callClaude,
  resetClient,
  type LLMProvider,
  getActiveProvider,
} from '@/lib/claude-client';

vi.mock('axios');

describe('llm-client', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGcpProject = process.env.GCP_PROJECT_ID;
  const originalOllamaUrl = process.env.OLLAMA_BASE_URL;
  const originalOllamaModel = process.env.OLLAMA_MODEL;

  beforeEach(() => {
    resetClient();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (originalGcpProject) process.env.GCP_PROJECT_ID = originalGcpProject;
    else delete process.env.GCP_PROJECT_ID;
    if (originalOllamaUrl) process.env.OLLAMA_BASE_URL = originalOllamaUrl;
    else delete process.env.OLLAMA_BASE_URL;
    if (originalOllamaModel) process.env.OLLAMA_MODEL = originalOllamaModel;
    else delete process.env.OLLAMA_MODEL;
    resetClient();
    vi.restoreAllMocks();
  });

  describe('isClaudeAvailable', () => {
    it('should return false when no provider configured', () => {
      expect(isClaudeAvailable()).toBe(false);
    });

    it('should return true when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      expect(isClaudeAvailable()).toBe(true);
    });

    it('should return true when GCP_PROJECT_ID is set', () => {
      process.env.GCP_PROJECT_ID = 'test-project';
      expect(isClaudeAvailable()).toBe(true);
    });

    it('should return true when OLLAMA_BASE_URL is set', () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      expect(isClaudeAvailable()).toBe(true);
    });
  });

  describe('getActiveProvider', () => {
    it('should return null when nothing configured', () => {
      expect(getActiveProvider()).toBeNull();
    });

    it('should return ollama when OLLAMA_BASE_URL is set', () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      expect(getActiveProvider()).toBe('ollama' satisfies LLMProvider);
    });

    it('should return gemini when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      expect(getActiveProvider()).toBe('gemini' satisfies LLMProvider);
    });

    it('should return vertex when GCP_PROJECT_ID is set', () => {
      process.env.GCP_PROJECT_ID = 'test-project';
      expect(getActiveProvider()).toBe('vertex' satisfies LLMProvider);
    });

    it('should prefer ollama over gemini when both set', () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      process.env.GEMINI_API_KEY = 'test-key';
      expect(getActiveProvider()).toBe('ollama' satisfies LLMProvider);
    });
  });

  describe('callClaude with Ollama', () => {
    it('should call Ollama API when OLLAMA_BASE_URL is set', async () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      process.env.OLLAMA_MODEL = 'qwen2.5:7b';

      const axios = await import('axios');
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          message: { content: 'test response' },
          prompt_eval_count: 10,
          eval_count: 5,
        },
      });
      vi.mocked(axios.default.post).mockImplementation(mockPost);

      const result = await callClaude({
        system: 'test system',
        prompt: 'test prompt',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        toolName: 'test',
      });

      expect(result.content).toBe('test response');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
      expect(mockPost).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          model: 'qwen2.5:7b',
          stream: false,
        }),
        expect.any(Object)
      );
    });

    it('should default to qwen2.5:7b model', async () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';

      const axios = await import('axios');
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          message: { content: 'ok' },
          prompt_eval_count: 5,
          eval_count: 3,
        },
      });
      vi.mocked(axios.default.post).mockImplementation(mockPost);

      await callClaude({
        system: 'sys',
        prompt: 'prompt',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        toolName: 'test',
      });

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'qwen2.5:7b' }),
        expect.any(Object)
      );
    });

    it('should handle Ollama errors and record failure', async () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';

      const axios = await import('axios');
      vi.mocked(axios.default.post).mockRejectedValue(new Error('connection refused'));

      await expect(
        callClaude({
          system: 'test',
          prompt: 'test',
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          toolName: 'test',
        })
      ).rejects.toThrow('connection refused');
    });
  });

  describe('callClaude without any provider', () => {
    it('should throw ClaudeUnavailableError when no credentials', async () => {
      await expect(
        callClaude({
          system: 'test',
          prompt: 'test',
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          toolName: 'test',
        })
      ).rejects.toThrow(ClaudeUnavailableError);
    });

    it('should throw ClaudeUnavailableError with correct message', async () => {
      try {
        await callClaude({
          system: 'test',
          prompt: 'test',
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          toolName: 'test',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeUnavailableError);
        expect((error as Error).message).toContain('No LLM provider configured');
      }
    });
  });

  describe('ClaudeUnavailableError', () => {
    it('should have correct name', () => {
      const error = new ClaudeUnavailableError('test');
      expect(error.name).toBe('ClaudeUnavailableError');
      expect(error.message).toBe('test');
    });

    it('should be instanceof Error', () => {
      const error = new ClaudeUnavailableError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
