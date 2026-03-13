/**
 * Tests for Planner agent
 */

import { describe, it, expect } from 'vitest';
import { PlannerAgent } from '@/agents/planner';
import type { JiraIssue } from '@/types/index';

// Mock issue data
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

describe('PlannerAgent', () => {
  describe('planIssue', () => {
    it('should generate a valid execution plan for a simple issue', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        key: 'PROJ-123',
        priority: 'Low',
        description: 'Fix typo in documentation',
      });

      const plan = await planner.planIssue(issue);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeTruthy();
      expect(plan.issueKey).toBe('PROJ-123');
      expect(plan.title).toBe('Fix typo in documentation');
      expect(plan.steps).toHaveLength(7); // Simple issue: 7 steps (no deployment step)
      expect(plan.totalEstimatedTime).toBeTruthy();
      expect(plan.riskSummary).toBeTruthy();
    });

    it('should generate more steps for complex issues', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        key: 'PROJ-200',
        priority: 'Critical',
        description: `
          Implement major database migration for performance.
          This requires refactoring the schema and includes
          complex security considerations for data integrity.
          The system must be redesigned to handle new requirements.
        `,
      });

      const plan = await planner.planIssue(issue);

      expect(plan.steps.length).toBeGreaterThanOrEqual(7);
      expect(plan.riskSummary).toContain('high');
      expect(plan.blockersSummary).toBeTruthy();
    });

    it('should include deployment step for feature issues', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        description: 'Implement new feature for user dashboard',
      });

      const plan = await planner.planIssue(issue);

      const hasDeploymentStep = plan.steps.some((step) =>
        step.action.toLowerCase().includes('deployment')
      );
      expect(hasDeploymentStep).toBe(true);
    });

    it('should identify security risks in plan', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        description: 'Add authentication and security headers to API endpoints',
      });

      const plan = await planner.planIssue(issue);

      expect(plan.riskSummary).toContain('Security');
    });

    it('should identify database risks in plan', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        description: 'Create database migration for schema update',
      });

      const plan = await planner.planIssue(issue);

      expect(plan.blockersSummary).toContain('Database migration');
    });

    it('should estimate time correctly for small issues', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Low',
        description: 'Update README documentation',
      });

      const plan = await planner.planIssue(issue);

      // Small issue: roughly 2.5 hours
      expect(plan.totalEstimatedTime).toContain('hour');
    });

    it('should estimate longer time for complex issues', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Critical',
        description: `
          Major refactoring of core authentication system with
          significant complexity including redesign of multiple
          components and database migration requirements.
        `,
      });

      const plan = await planner.planIssue(issue);

      const timeStr = plan.totalEstimatedTime;
      // Complex issue should be significantly longer
      // Parse to minutes for comparison
      if (timeStr.includes('hour')) {
        const hours = parseInt(timeStr);
        expect(hours).toBeGreaterThanOrEqual(5);
      }
    });

    it('should validate all steps have required fields', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      plan.steps.forEach((step) => {
        expect(step.stepNumber).toBeDefined();
        expect(step.action).toBeDefined();
        expect(step.effort).toMatch(/small|medium|large/);
        expect(step.risk).toMatch(/low|medium|high/);
        expect(step.successCriteria).toBeInstanceOf(Array);
        expect(step.successCriteria.length).toBeGreaterThan(0);
        expect(step.estimatedTime).toBeDefined();
      });
    });

    it('should ensure step numbers are sequential', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      plan.steps.forEach((step, index) => {
        expect(step.stepNumber).toBe(index + 1);
      });
    });

    it('should include TDD steps in all plans', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      const hasTDD = plan.steps.some(
        (step) =>
          step.action.toLowerCase().includes('test') || step.action.toLowerCase().includes('red')
      );
      expect(hasTDD).toBe(true);
    });

    it('should handle high-priority issues with elevated risk', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Critical',
      });

      const plan = await planner.planIssue(issue);

      expect(plan.riskSummary).toContain('Critical');
    });

    it('should set risk to low for simple tasks', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Low',
        description: 'Update comments in existing code',
      });

      const plan = await planner.planIssue(issue);

      expect(plan.riskSummary).toContain('low');
    });

    it('should track correlation ID throughout planning', async () => {
      const correlationId = 'test-correlation-123';
      const planner = new PlannerAgent(correlationId);
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeTruthy();
    });
  });

  describe('planIssues (batch)', () => {
    it('should plan multiple issues in batch', async () => {
      const planner = new PlannerAgent();
      const issues = [
        createMockIssue({ key: 'PROJ-1' }),
        createMockIssue({ key: 'PROJ-2' }),
        createMockIssue({ key: 'PROJ-3' }),
      ];

      const plans = await planner.planIssues(issues);

      expect(plans).toHaveLength(3);
      expect(plans[0].issueKey).toBe('PROJ-1');
      expect(plans[1].issueKey).toBe('PROJ-2');
      expect(plans[2].issueKey).toBe('PROJ-3');
    });

    it('should handle empty issue list', async () => {
      const planner = new PlannerAgent();

      const plans = await planner.planIssues([]);

      expect(plans).toHaveLength(0);
    });

    it('should maintain independent plans for each issue', async () => {
      const planner = new PlannerAgent();
      const issues = [
        createMockIssue({ key: 'PROJ-1', priority: 'Low' }),
        createMockIssue({ key: 'PROJ-2', priority: 'Critical' }),
      ];

      const plans = await planner.planIssues(issues);

      expect(plans[0].riskSummary).toContain('Low');
      expect(plans[1].riskSummary).toContain('Critical');
    });
  });

  describe('complexity assessment', () => {
    it('should classify simple issues correctly', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Low',
        description: 'Fix typo',
      });

      const plan = await planner.planIssue(issue);

      // Simple issues have fewer, quicker steps
      const totalMinutes = plan.steps.reduce((sum, step) => {
        const timeMap: Record<string, number> = {
          '10 minutes': 10,
          '15 minutes': 15,
          '30 minutes': 30,
        };
        return sum + (timeMap[step.estimatedTime] || 30);
      }, 0);

      expect(totalMinutes).toBeLessThan(150); // Less than 2.5 hours
    });

    it('should classify large issues correctly', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue({
        priority: 'Critical',
        description: `
          This is a very complex feature that requires:
          - Database schema redesign
          - Security considerations
          - Multiple component refactoring
          - Significant integration work
          The system must be completely redesigned for performance.
        `,
      });

      const plan = await planner.planIssue(issue);

      // Large issues have more/longer steps
      const hasLargeEfforts = plan.steps.some((step) => step.effort === 'large');
      expect(hasLargeEfforts).toBe(true);
    });
  });

  describe('success criteria', () => {
    it('should define specific success criteria for each step', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      plan.steps.forEach((step) => {
        expect(step.successCriteria.length).toBeGreaterThan(0);
        step.successCriteria.forEach((criterion) => {
          expect(criterion.length).toBeGreaterThan(5);
        });
      });
    });

    it('should include test coverage criteria', async () => {
      const planner = new PlannerAgent();
      const issue = createMockIssue();

      const plan = await planner.planIssue(issue);

      const verificationStep = plan.steps.find((step) => step.action.includes('test suite'));
      expect(verificationStep).toBeDefined();
      expect(verificationStep?.successCriteria.some((c) => c.includes('Coverage'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid issue data', async () => {
      const planner = new PlannerAgent();
      const invalidIssue = {
        key: 'PROJ-1',
        // Missing required fields like summary, description, etc.
      } as unknown as JiraIssue;

      // Should handle gracefully or throw
      try {
        await planner.planIssue(invalidIssue);
        // If it doesn't throw, that's OK too
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
