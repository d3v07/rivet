import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isClaudeAvailable,
  ClaudeUnavailableError,
  callClaude,
  resetClient,
} from '@/lib/claude-client';

describe('claude-client', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    resetClient();
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv;
    resetClient();
  });

  describe('isClaudeAvailable', () => {
    it('should return false when no API key', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(isClaudeAvailable()).toBe(false);
    });

    it('should return true when API key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      expect(isClaudeAvailable()).toBe(true);
    });
  });

  describe('callClaude', () => {
    it('should throw ClaudeUnavailableError when no API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;

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
      delete process.env.ANTHROPIC_API_KEY;

      try {
        await callClaude({
          system: 'test',
          prompt: 'test',
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          toolName: 'test',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeUnavailableError);
        expect((error as Error).message).toContain('ANTHROPIC_API_KEY');
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
