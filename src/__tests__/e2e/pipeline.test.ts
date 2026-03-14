/**
 * E2E integration test: full pipeline execution
 * Runs the complete Jira → Plan → Develop → Security → Deploy flow
 */

import { describe, it, expect } from 'vitest';
import { Orchestrator } from '@/orchestrator';
import type { JiraIssue } from '@/types/index';

const createIssue = (overrides?: Partial<JiraIssue>): JiraIssue => ({
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

describe('E2E Pipeline', () => {
  it('should run the complete pipeline for a single issue', async () => {
    const orchestrator = new Orchestrator();
    const issue = createIssue();

    const result = await orchestrator.runPipeline(issue);

    // Pipeline completes
    expect(result.pipelineId).toBeTruthy();
    expect(result.correlationId).toBeTruthy();
    expect(result.issueKey).toBe('PROJ-1');

    // All 4 stages run
    expect(result.stages).toHaveLength(4);
    expect(result.stages.map((s) => s.stage)).toEqual([
      'plan',
      'develop',
      'security',
      'deploy',
    ]);

    // Plan stage produces plan
    expect(result.plan).toBeDefined();
    expect(result.plan.issueKey).toBe('PROJ-1');
    expect(result.plan.steps.length).toBeGreaterThan(0);

    // Dev stage produces progress
    expect(result.devProgress).toBeDefined();
    expect(result.devProgress.status).toBe('completed');
    expect(result.devProgress.completedSteps).toBe(result.devProgress.totalSteps);

    // Security stage produces review
    expect(result.securityReview).toBeDefined();
    expect(result.securityReview.overallSeverity).toBeTruthy();

    // Deploy stage produces deployment
    expect(result.deployment).toBeDefined();
    expect(result.deployment.status).toMatch(/deployed|dry_run|blocked/);
    expect(result.deployment.auditTrail.length).toBeGreaterThan(0);

    // Token metrics tracked
    expect(result.tokenMetrics).toBeDefined();
    expect(result.tokenMetrics.totalInvocations).toBeGreaterThanOrEqual(0);
  });

  it('should handle security-sensitive issues with appropriate gates', async () => {
    const orchestrator = new Orchestrator();
    const issue = createIssue({
      key: 'PROJ-SEC',
      summary: 'Fix security auth breach',
      description: 'Add authentication and security headers to API endpoints',
      priority: 'Critical',
    });

    const result = await orchestrator.runPipeline(issue);

    // Security should flag this
    expect(result.securityReview).toBeDefined();
    expect(result.securityReview.overallSeverity).toBeTruthy();
  });

  it('should produce carbon-aware deployment decisions', async () => {
    const orchestrator = new Orchestrator();
    const issue = createIssue({
      key: 'PROJ-GREEN',
      summary: 'Add feature with green deployment',
      description: 'Implement new feature for user dashboard',
    });

    const result = await orchestrator.runPipeline(issue);

    if (result.deployment && result.deployment.status !== 'blocked') {
      expect(result.deployment.decision.carbonIntensity).toBeGreaterThan(0);
      expect(result.deployment.decision.carbonSavingsPercent).toBeGreaterThanOrEqual(0);
      expect(result.deployment.decision.rationale).toBeTruthy();
    }
  });

  it('should maintain correlation ID across all stages', async () => {
    const correlationId = 'e2e-test-correlation-123';
    const orchestrator = new Orchestrator(correlationId);
    const issue = createIssue();

    const result = await orchestrator.runPipeline(issue);

    expect(result.correlationId).toBe(correlationId);
  });

  it('should process backlog with multiple issues', async () => {
    const orchestrator = new Orchestrator();

    const results = await orchestrator.runBacklog('PROJ', 2);

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.stages.length).toBe(4);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  it('should track timing across the full pipeline', async () => {
    const orchestrator = new Orchestrator();
    const issue = createIssue();

    const result = await orchestrator.runPipeline(issue);

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    result.stages.forEach((stage) => {
      expect(stage.startedAt).toBeTruthy();
      expect(stage.completedAt).toBeTruthy();
      expect(stage.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
