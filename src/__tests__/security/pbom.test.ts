import { describe, it, expect } from 'vitest';
import { generatePBOM, type PBOMInput } from '@/security/pbom';

describe('PBOM Generator', () => {
  const baseInput: PBOMInput = {
    pipelineId: 'pipeline-001',
    correlationId: '550e8400-e29b-41d4-a716-446655440000',
    trigger: { type: 'jira_webhook', issueKey: 'PROJ-42' },
    agents: [
      { name: 'PlannerAgent', model: 'qwen2.5:7b', provider: 'ollama' },
      { name: 'DeveloperAgent', model: 'qwen2.5:7b', provider: 'ollama' },
      { name: 'SecurityAnalystAgent', model: 'deterministic', provider: 'local' },
      { name: 'DeployerAgent', model: 'deterministic', provider: 'local' },
    ],
    tools: [
      { name: 'query_jira_backlog', invocations: 1, totalTokens: 250 },
      { name: 'plan_issue', invocations: 1, totalTokens: 500 },
    ],
    tokenMetrics: {
      totalInputTokens: 1200,
      totalOutputTokens: 800,
      totalLatencyMs: 15000,
    },
    stages: [
      { name: 'plan', status: 'success', durationMs: 5000 },
      { name: 'develop', status: 'success', durationMs: 6000 },
      { name: 'security', status: 'success', durationMs: 2000 },
      { name: 'deploy', status: 'success', durationMs: 2000 },
    ],
  };

  describe('generatePBOM', () => {
    it('should generate a valid PBOM with all required fields', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.version).toBe('1.0.0');
      expect(pbom.pipelineId).toBe('pipeline-001');
      expect(pbom.correlationId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(pbom.generatedAt).toBeDefined();
      expect(pbom.trigger).toEqual({ type: 'jira_webhook', issueKey: 'PROJ-42' });
    });

    it('should include all agents with metadata', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.agents).toHaveLength(4);
      expect(pbom.agents[0]).toEqual({
        name: 'PlannerAgent',
        model: 'qwen2.5:7b',
        provider: 'ollama',
      });
    });

    it('should include tool invocation summary', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.tools).toHaveLength(2);
      expect(pbom.tools[0].name).toBe('query_jira_backlog');
      expect(pbom.tools[0].invocations).toBe(1);
    });

    it('should include token metrics', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.tokenMetrics.totalInputTokens).toBe(1200);
      expect(pbom.tokenMetrics.totalOutputTokens).toBe(800);
      expect(pbom.tokenMetrics.totalLatencyMs).toBe(15000);
      expect(pbom.tokenMetrics.efficiency).toBeCloseTo(0.667, 2);
    });

    it('should calculate token efficiency (output/input ratio)', () => {
      const pbom = generatePBOM(baseInput);
      expect(pbom.tokenMetrics.efficiency).toBe(
        baseInput.tokenMetrics.totalOutputTokens / baseInput.tokenMetrics.totalInputTokens
      );
    });

    it('should include all pipeline stages', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.stages).toHaveLength(4);
      expect(pbom.stages[0]).toEqual({ name: 'plan', status: 'success', durationMs: 5000 });
    });

    it('should compute total pipeline duration', () => {
      const pbom = generatePBOM(baseInput);
      expect(pbom.totalDurationMs).toBe(15000);
    });

    it('should set overall status to success when all stages pass', () => {
      const pbom = generatePBOM(baseInput);
      expect(pbom.overallStatus).toBe('success');
    });

    it('should set overall status to failed if any stage fails', () => {
      const input: PBOMInput = {
        ...baseInput,
        stages: [
          { name: 'plan', status: 'success', durationMs: 5000 },
          { name: 'develop', status: 'failed', durationMs: 3000 },
        ],
      };
      const pbom = generatePBOM(input);
      expect(pbom.overallStatus).toBe('failed');
    });

    it('should return zero efficiency when input tokens are zero', () => {
      const input: PBOMInput = {
        ...baseInput,
        tokenMetrics: { totalInputTokens: 0, totalOutputTokens: 0, totalLatencyMs: 0 },
      };
      const pbom = generatePBOM(input);
      expect(pbom.tokenMetrics.efficiency).toBe(0);
    });

    it('should include runtime environment info', () => {
      const pbom = generatePBOM(baseInput);

      expect(pbom.environment.nodeVersion).toBeDefined();
      expect(pbom.environment.platform).toBeDefined();
      expect(pbom.environment.rivetVersion).toBe('0.1.0');
    });

    it('should produce immutable output (frozen object)', () => {
      const pbom = generatePBOM(baseInput);
      expect(Object.isFrozen(pbom)).toBe(true);
    });

    it('should generate valid ISO timestamp', () => {
      const pbom = generatePBOM(baseInput);
      const parsed = new Date(pbom.generatedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });
});
