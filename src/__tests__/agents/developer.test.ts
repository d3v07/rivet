/**
 * Tests for Developer agent
 */

import { describe, it, expect } from 'vitest';
import { DeveloperAgent } from '@/agents/developer';
import type { ExecutionPlan, ExecutionStep } from '@/types/index';

const createMockExecutionStep = (overrides?: Partial<ExecutionStep>): ExecutionStep => ({
  stepNumber: 1,
  action: 'Review requirements',
  effort: 'small',
  risk: 'low',
  successCriteria: ['Task understood'],
  estimatedTime: '15 minutes',
  ...overrides,
});

const createMockExecutionPlan = (overrides?: Partial<ExecutionPlan>): ExecutionPlan => ({
  planId: 'plan-123',
  issueKey: 'PROJ-1',
  title: 'Implement feature',
  steps: [
    createMockExecutionStep({ stepNumber: 1, action: 'Review requirements' }),
    createMockExecutionStep({ stepNumber: 2, action: 'Write tests (RED phase)' }),
    createMockExecutionStep({ stepNumber: 3, action: 'Implement code (GREEN phase)' }),
    createMockExecutionStep({ stepNumber: 4, action: 'Refactor code' }),
    createMockExecutionStep({ stepNumber: 5, action: 'Verify with tests' }),
    createMockExecutionStep({ stepNumber: 6, action: 'Commit changes' }),
  ],
  totalEstimatedTime: '4 hours',
  riskSummary: 'Low risk feature',
  ...overrides,
});

describe('DeveloperAgent', () => {
  describe('executePlan', () => {
    it('should execute a complete plan successfully', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress).toBeDefined();
      expect(progress.planId).toBe(plan.planId);
      expect(progress.issueKey).toBe(plan.issueKey);
      expect(progress.status).toBe('completed');
      expect(progress.completedSteps).toBeGreaterThan(0);
      expect(progress.results.length).toBeGreaterThan(0);
    });

    it('should track progress through execution', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress.completedSteps).toBe(plan.steps.length);
      expect(progress.results.length).toBe(plan.steps.length);
    });

    it('should execute test generation step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Write tests first (RED phase) - test must fail',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      const testStep = progress.results.find((r) => r.stepNumber === 1);
      expect(testStep).toBeDefined();
      expect(testStep?.status).toBe('success');
      expect(testStep?.result).toContain('test');
    });

    it('should execute implementation step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Implement minimal code to pass tests (GREEN phase)',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      const implStep = progress.results.find((r) => r.stepNumber === 1);
      expect(implStep).toBeDefined();
      expect(implStep?.status).toBe('success');
      expect(implStep?.result).toContain('Implementation');
    });

    it('should execute refactoring step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Refactor code while maintaining test coverage',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      const refactorStep = progress.results.find((r) => r.stepNumber === 1);
      expect(refactorStep).toBeDefined();
      expect(refactorStep?.status).toBe('success');
    });

    it('should execute verification step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Run full test suite, lint, and typecheck',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      const verifyStep = progress.results.find((r) => r.stepNumber === 1);
      expect(verifyStep).toBeDefined();
      expect(verifyStep?.status).toBe('success');
      expect(verifyStep?.result).toContain('Verification');
    });

    it('should execute commit step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Commit changes and prepare for code review',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      const commitStep = progress.results.find((r) => r.stepNumber === 1);
      expect(commitStep).toBeDefined();
      expect(commitStep?.status).toBe('success');
      expect(commitStep?.result).toContain('Commit');
    });

    it('should track timing for each step', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      progress.results.forEach((result) => {
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.duration).toBeLessThan(10000); // Should be less than 10 seconds for mock
      });
    });

    it('should set overall status correctly', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress.overallStatus).toBeTruthy();
      expect(progress.overallStatus.length).toBeGreaterThan(0);
    });

    it('should track start and completion times', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress.startedAt).toBeTruthy();
      expect(progress.completedAt).toBeTruthy();
      expect(progress.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should mark all steps successful when completed', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      const allSuccessful = progress.results.every((r) => r.status === 'success');
      expect(allSuccessful).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('should return current progress', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      await agent.executePlan(plan);
      const progress = agent.getProgress();

      expect(progress.completedSteps).toBeGreaterThan(0);
      expect(progress.totalSteps).toBeGreaterThan(0);
      expect(progress.results).toBeInstanceOf(Array);
    });
  });

  describe('step routing', () => {
    it('should route to test generation for test steps', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Write tests first (RED phase)',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.results[0].result).toContain('test');
    });

    it('should route to implementation for code steps', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Implement code (GREEN phase)',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.results[0].result).toContain('Implementation');
    });

    it('should handle unknown step types gracefully', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [
          createMockExecutionStep({
            stepNumber: 1,
            action: 'Some unknown action',
          }),
        ],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.results[0].status).toBe('success');
      expect(progress.status).not.toBe('failed');
    });
  });

  describe('plan variations', () => {
    it('should handle small effort tasks', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [createMockExecutionStep({ effort: 'small' })],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.completedSteps).toBe(1);
    });

    it('should handle medium effort tasks', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [createMockExecutionStep({ effort: 'medium' })],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.completedSteps).toBe(1);
    });

    it('should handle large effort tasks', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [createMockExecutionStep({ effort: 'large' })],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.completedSteps).toBe(1);
    });

    it('should handle high-risk tasks', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan({
        steps: [createMockExecutionStep({ risk: 'high' })],
      });

      const progress = await agent.executePlan(plan);

      expect(progress.status).toBe('completed');
    });
  });

  describe('correlation ID tracking', () => {
    it('should preserve correlation ID', async () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const agent = new DeveloperAgent(correlationId);
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress).toBeDefined();
    });

    it('should generate correlation ID if not provided', async () => {
      const agent = new DeveloperAgent();
      const plan = createMockExecutionPlan();

      const progress = await agent.executePlan(plan);

      expect(progress).toBeDefined();
    });
  });
});
