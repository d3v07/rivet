import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isClaudeAvailable,
  ClaudeUnavailableError,
  callClaude,
  resetClient,
} from '@/lib/claude-client';

describe('llm-client', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGcpProject = process.env.GCP_PROJECT_ID;

  beforeEach(() => {
    resetClient();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GCP_PROJECT_ID;
  });

  afterEach(() => {
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (originalGcpProject) process.env.GCP_PROJECT_ID = originalGcpProject;
    else delete process.env.GCP_PROJECT_ID;
    resetClient();
  });

  describe('isClaudeAvailable', () => {
    it('should return false when no API key or GCP project', () => {
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
  });

  describe('callClaude', () => {
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
        expect((error as Error).message).toContain('GEMINI_API_KEY');
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
