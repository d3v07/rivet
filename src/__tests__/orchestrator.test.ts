import { describe, it, expect } from 'vitest';
import { Orchestrator } from '@/orchestrator';
import type { JiraIssue } from '@/types/index';

const createMockIssue = (overrides?: Partial<JiraIssue>): JiraIssue => ({
  key: 'PROJ-1',
  summary: 'Implement authentication system',
  description: 'Add OAuth 2.0 authentication for the application',
  status: 'Ready for Engineering',
  priority: 'High',
  assignee: 'dev@example.com',
  created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updated: new Date().toISOString(),
  ...overrides,
});

describe('Orchestrator', () => {
  describe('runPipeline', () => {
    it('should run full pipeline for an issue', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.issueKey).toBe('PROJ-1');
      expect(result.pipelineId).toBeTruthy();
      expect(result.correlationId).toBeTruthy();
      expect(result.stages.length).toBe(4);
    });

    it('should execute all four stages', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      const stageNames = result.stages.map((s) => s.stage);
      expect(stageNames).toEqual(['plan', 'develop', 'security', 'deploy']);
    });

    it('should have successful stages', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      result.stages.forEach((stage) => {
        expect(stage.status).toBe('success');
        expect(stage.durationMs).toBeGreaterThanOrEqual(0);
        expect(stage.summary.length).toBeGreaterThan(0);
      });
    });

    it('should include plan artifact', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.plan).toBeDefined();
      expect(result.plan.issueKey).toBe('PROJ-1');
      expect(result.plan.steps.length).toBeGreaterThan(0);
    });

    it('should include dev progress artifact', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.devProgress).toBeDefined();
      expect(result.devProgress.completedSteps).toBeGreaterThan(0);
    });

    it('should include security review artifact', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.securityReview).toBeDefined();
      expect(result.securityReview.overallSeverity).toBeTruthy();
    });

    it('should include deployment artifact', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.deployment).toBeDefined();
      expect(result.deployment.status).toMatch(/deployed|dry_run|blocked/);
    });

    it('should track total duration', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include token metrics', async () => {
      const orchestrator = new Orchestrator();
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.tokenMetrics).toBeDefined();
      expect(result.tokenMetrics.totalInvocations).toBeGreaterThanOrEqual(0);
    });

    it('should accept custom correlation ID', async () => {
      const orchestrator = new Orchestrator('test-pipeline-123');
      const issue = createMockIssue();

      const result = await orchestrator.runPipeline(issue);

      expect(result.correlationId).toBe('test-pipeline-123');
    });
  });

  describe('runBacklog', () => {
    it('should process backlog issues', async () => {
      const orchestrator = new Orchestrator();

      const results = await orchestrator.runBacklog('PROJ', 2);

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.stages.length).toBe(4);
        expect(result.pipelineId).toBeTruthy();
      });
    });

    it('should return results for each issue', async () => {
      const orchestrator = new Orchestrator();

      const results = await orchestrator.runBacklog('PROJ', 5);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
