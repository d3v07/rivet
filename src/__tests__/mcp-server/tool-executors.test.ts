import { describe, it, expect, vi } from 'vitest';
import { executePlanIssue } from '@/mcp-server/tools/plan-issue';
import { executeExecutePlan } from '@/mcp-server/tools/execute-plan';
import { executeReviewCode } from '@/mcp-server/tools/review-code';

vi.mock('@/agents/planner', () => ({
  PlannerAgent: vi.fn().mockImplementation(() => ({
    planIssue: vi.fn().mockResolvedValue({
      planId: 'plan-test-1',
      issueKey: 'PROJ-1',
      title: 'Test plan',
      steps: [
        {
          stepNumber: 1,
          action: 'Write tests',
          effort: 'small',
          risk: 'low',
          successCriteria: ['Tests pass'],
          blockedBy: ['none'],
          estimatedTime: '30 min',
        },
      ],
      totalEstimatedTime: '30 min',
      riskSummary: 'low',
      blockersSummary: 'none',
    }),
  })),
}));

vi.mock('@/agents/developer', () => ({
  DeveloperAgent: vi.fn().mockImplementation(() => ({
    executePlan: vi.fn().mockResolvedValue({
      planId: 'plan-test-1',
      issueKey: 'PROJ-1',
      status: 'completed',
      completedSteps: 1,
      totalSteps: 1,
      results: [
        {
          stepNumber: 1,
          status: 'success',
          action: 'Write tests',
          result: 'Tests written',
          filesModified: ['test.ts'],
          duration: 100,
        },
      ],
      overallStatus: 'All steps completed',
      startedAt: '2026-03-14T00:00:00Z',
      completedAt: '2026-03-14T00:01:00Z',
      totalDuration: 60000,
    }),
  })),
}));

vi.mock('@/agents/security-analyst', () => ({
  SecurityAnalystAgent: vi.fn().mockImplementation(() => ({
    reviewCode: vi.fn().mockResolvedValue({
      reviewId: 'rev-1',
      issueKey: 'PROJ-1',
      timestamp: '2026-03-14T00:00:00Z',
      overallSeverity: 'LOW',
      findings: [
        {
          severity: 'LOW',
          category: 'OTHER',
          location: 'test.ts:1',
          issue: 'Unused variable',
          recommendation: 'Remove unused variable',
          reference: 'eslint:no-unused-vars',
        },
      ],
      summary: 'Minor issues found',
      blocksDeployment: false,
    }),
  })),
}));

describe('MCP Tool Executors', () => {
  describe('executePlanIssue', () => {
    it('should generate plan for valid input', async () => {
      const result = await executePlanIssue({
        issueKey: 'PROJ-1',
        summary: 'Add login',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.plan).toBeDefined();
      expect(result.plan.planId).toBe('plan-test-1');
    });

    it('should throw on invalid input (missing issueKey)', async () => {
      await expect(executePlanIssue({ summary: 'test' })).rejects.toThrow();
    });

    it('should throw on invalid input (missing summary)', async () => {
      await expect(executePlanIssue({ issueKey: 'PROJ-1' })).rejects.toThrow();
    });
  });

  describe('executeExecutePlan', () => {
    it('should execute plan for valid input', async () => {
      const result = await executeExecutePlan({
        plan: {
          planId: 'plan-test-1',
          issueKey: 'PROJ-1',
          title: 'Test',
          steps: [
            {
              stepNumber: 1,
              action: 'Do thing',
              effort: 'small',
              risk: 'low',
              successCriteria: [],
              blockedBy: [],
              estimatedTime: '10 min',
            },
          ],
          totalEstimatedTime: '10 min',
          riskSummary: 'low',
          blockersSummary: 'none',
        },
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.progress).toBeDefined();
      expect(result.progress.status).toBe('completed');
    });

    it('should throw on invalid input (missing plan)', async () => {
      await expect(executeExecutePlan({})).rejects.toThrow();
    });
  });

  describe('executeReviewCode', () => {
    it('should review code for valid input', async () => {
      const result = await executeReviewCode({
        issueKey: 'PROJ-1',
        files: [{ path: 'test.ts', content: 'const x = 1;' }],
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.review).toBeDefined();
      expect(result.review.overallSeverity).toBe('LOW');
    });

    it('should throw on invalid input (missing files)', async () => {
      await expect(executeReviewCode({ issueKey: 'PROJ-1' })).rejects.toThrow();
    });

    it('should throw on invalid input (missing issueKey)', async () => {
      await expect(executeReviewCode({ files: [] })).rejects.toThrow();
    });
  });
});
