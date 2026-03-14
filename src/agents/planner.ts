/**
 * Planner Agent: Analyzes Jira issues and generates structured execution plans
 * Runs as part of the multi-agent orchestration pipeline
 */

import { createCorrelationId, logInfo, logError } from '@/lib/logger';
import { callClaudeJson, ClaudeUnavailableError, isClaudeAvailable } from '@/lib/claude-client';
import type { JiraIssue, ExecutionPlan, ExecutionStep } from '@/types/index';
import { z } from 'zod';

const ExecutionStepSchema = z.object({
  stepNumber: z.number().min(1),
  action: z.string().min(10),
  effort: z.enum(['small', 'medium', 'large']),
  risk: z.enum(['low', 'medium', 'high']),
  successCriteria: z.array(z.string()).min(1),
  blockedBy: z.array(z.string()).optional(),
  estimatedTime: z.string(),
});

const ExecutionPlanSchema = z.object({
  planId: z.string(),
  issueKey: z.string(),
  title: z.string(),
  description: z.string().optional(),
  steps: z.array(ExecutionStepSchema),
  totalEstimatedTime: z.string(),
  riskSummary: z.string(),
  blockersSummary: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Planner agent: Converts issues into execution plans
 */
export class PlannerAgent {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || createCorrelationId();
  }

  /**
   * Analyze a single Jira issue and generate an execution plan
   */
  async planIssue(issue: JiraIssue): Promise<ExecutionPlan> {
    logInfo('Planner: analyzing issue', {
      correlationId: this.correlationId,
      issueKey: issue.key,
      summary: issue.summary,
      priority: issue.priority,
    });

    try {
      // Try Claude-powered planning first, fall back to deterministic
      if (isClaudeAvailable()) {
        try {
          const aiPlan = await this.planWithClaude(issue);
          logInfo('Planner: used Claude API for planning', {
            correlationId: this.correlationId,
            issueKey: issue.key,
            stepCount: aiPlan.steps.length,
          });
          return aiPlan;
        } catch (error) {
          if (!(error instanceof ClaudeUnavailableError)) {
            logError(
              'Planner: Claude API failed, using deterministic fallback',
              {
                correlationId: this.correlationId,
              },
              error as Error
            );
          }
        }
      }

      // Deterministic fallback
      const complexity = this.assessComplexity(issue);
      const riskLevel = this.assessRisk(issue);
      const dependencies = this.identifyDependencies(issue);

      const steps = this.generateSteps(issue, complexity);
      const totalTime = this.estimateTotalTime(steps);

      const plan: ExecutionPlan = {
        planId: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        issueKey: issue.key,
        title: issue.summary,
        description: issue.description || undefined,
        steps,
        totalEstimatedTime: totalTime,
        riskSummary: `Overall risk is ${riskLevel.level} due to: ${riskLevel.reasons.join(', ')}`,
        blockersSummary:
          dependencies.blockers.length > 0 ? dependencies.blockers.join(', ') : undefined,
        dependencies: dependencies.requires.length > 0 ? dependencies.requires : undefined,
      };

      const validatedPlan = ExecutionPlanSchema.parse(plan);

      logInfo('Planner: plan generated', {
        correlationId: this.correlationId,
        issueKey: issue.key,
        stepCount: steps.length,
        totalTime,
        riskLevel: riskLevel.level,
      });

      return validatedPlan;
    } catch (error) {
      logError(
        'Planner: failed to plan issue',
        { correlationId: this.correlationId },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Generate plan using Claude API
   */
  private async planWithClaude(issue: JiraIssue): Promise<ExecutionPlan> {
    const system = `You are a senior software architect planning implementation tasks.
Given a Jira issue, produce a structured execution plan following TDD methodology.
Each plan must include: requirements review, test writing (RED), implementation (GREEN),
refactoring, verification, and commit steps. Add design and deployment steps for complex issues.`;

    const prompt = `Plan this Jira issue:

Key: ${issue.key}
Summary: ${issue.summary}
Description: ${issue.description || 'No description'}
Priority: ${issue.priority || 'Medium'}
Status: ${issue.status}

Return a JSON object with this exact structure:
{
  "steps": [
    {
      "stepNumber": 1,
      "action": "descriptive action (10+ chars)",
      "effort": "small|medium|large",
      "risk": "low|medium|high",
      "successCriteria": ["criterion 1", "criterion 2"],
      "estimatedTime": "N minutes"
    }
  ],
  "totalEstimatedTime": "N hours M minutes",
  "riskSummary": "Overall risk assessment",
  "blockersSummary": "Any blockers or null"
}`;

    const result = await callClaudeJson(
      {
        system,
        prompt,
        maxTokens: 2048,
        temperature: 0.3,
        correlationId: this.correlationId,
        toolName: 'planner',
      },
      (raw) => JSON.parse(raw)
    );

    const steps: ExecutionStep[] = result.steps.map((s: Record<string, unknown>, i: number) => ({
      stepNumber: i + 1,
      action: String(s.action),
      effort: String(s.effort) as 'small' | 'medium' | 'large',
      risk: String(s.risk) as 'low' | 'medium' | 'high',
      successCriteria: Array.isArray(s.successCriteria)
        ? s.successCriteria.map(String)
        : ['Completed successfully'],
      estimatedTime: String(s.estimatedTime),
    }));

    const plan: ExecutionPlan = {
      planId: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      issueKey: issue.key,
      title: issue.summary,
      description: issue.description || undefined,
      steps,
      totalEstimatedTime: String(result.totalEstimatedTime),
      riskSummary: String(result.riskSummary),
      blockersSummary: result.blockersSummary ? String(result.blockersSummary) : undefined,
    };

    return ExecutionPlanSchema.parse(plan);
  }

  /**
   * Assess issue complexity from description and priority
   */
  private assessComplexity(issue: JiraIssue): 'small' | 'medium' | 'large' {
    let score = 0;

    // Priority-based scoring
    if (issue.priority === 'Critical') score += 2;
    if (issue.priority === 'High') score += 1;

    // Description length heuristic
    const descLength = (issue.description || '').length;
    if (descLength > 500) score += 2;
    if (descLength > 200) score += 1;

    // Keyword indicators
    const keywords = ['refactor', 'redesign', 'migration', 'complex', 'integrat'];
    const description = (issue.description || '').toLowerCase();
    keywords.forEach((kw) => {
      if (description.includes(kw)) score += 1;
    });

    if (score >= 5) return 'large';
    if (score >= 2) return 'medium';
    return 'small';
  }

  /**
   * Assess risk factors
   */
  private assessRisk(issue: JiraIssue): { level: 'low' | 'medium' | 'high'; reasons: string[] } {
    const reasons: string[] = [];

    if (issue.priority === 'Critical') {
      reasons.push('Critical priority task');
    }

    const description = (issue.description || '').toLowerCase();
    if (description.includes('security') || description.includes('auth')) {
      reasons.push('Security-sensitive changes');
    }
    if (description.includes('database') || description.includes('migration')) {
      reasons.push('Data integrity risk');
    }
    if (description.includes('breaking') || description.includes('deprecat')) {
      reasons.push('Breaking changes');
    }

    const level = reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'low';

    return { level, reasons: reasons.length > 0 ? reasons : ['Low complexity task'] };
  }

  /**
   * Identify dependencies and blockers
   */
  private identifyDependencies(issue: JiraIssue): {
    requires: string[];
    blockers: string[];
  } {
    const requires: string[] = [];
    const blockers: string[] = [];

    const description = (issue.description || '').toLowerCase();

    // Common dependency patterns
    if (description.includes('after') || description.includes('depends on')) {
      blockers.push('Issue has external dependencies');
    }
    if (description.includes('credential') || description.includes('api key')) {
      blockers.push('Requires API credentials/configuration');
    }
    if (description.includes('database') && description.includes('migration')) {
      blockers.push('Database migration needed');
    }

    return { requires, blockers };
  }

  /**
   * Generate execution steps based on issue analysis
   */
  private generateSteps(
    issue: JiraIssue,
    complexity: 'small' | 'medium' | 'large'
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const description = (issue.description || '').toLowerCase();

    // Step 1: Understand requirements
    steps.push({
      stepNumber: 1,
      action: 'Review requirements and acceptance criteria for the issue',
      effort: 'small',
      risk: 'low',
      successCriteria: [
        'Requirements understood',
        'Acceptance criteria clear',
        'No blockers identified',
      ],
      estimatedTime: '15 minutes',
    });

    // Step 2: Design/Plan (for medium/large)
    if (complexity === 'medium' || complexity === 'large') {
      steps.push({
        stepNumber: 2,
        action: 'Create detailed design or implementation plan',
        effort: complexity === 'large' ? 'large' : 'medium',
        risk: 'low',
        successCriteria: ['Design documented', 'Architecture reviewed', 'Test strategy defined'],
        estimatedTime: complexity === 'large' ? '90 minutes' : '45 minutes',
      });
    }

    // Step 3: Test-First (TDD)
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Write tests first (RED phase) - test must fail',
      effort: 'medium',
      risk: 'low',
      successCriteria: [
        'Test file created',
        'Tests fail for right reasons',
        'Coverage includes edge cases',
      ],
      estimatedTime: complexity === 'small' ? '30 minutes' : '60 minutes',
    });

    // Step 4: Implementation
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Implement minimal code to pass tests (GREEN phase)',
      effort: complexity,
      risk: 'medium',
      successCriteria: ['All tests pass', 'No lint errors', 'TypeScript strict mode satisfied'],
      estimatedTime:
        complexity === 'small'
          ? '45 minutes'
          : complexity === 'medium'
            ? '120 minutes'
            : '240 minutes',
    });

    // Step 5: Refactor
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Refactor code while maintaining test coverage',
      effort: 'medium',
      risk: 'low',
      successCriteria: ['Tests still pass', 'Code complexity reduced', 'No new warnings'],
      estimatedTime: '30 minutes',
    });

    // Step 6: Verification
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Run full test suite, lint, and typecheck',
      effort: 'small',
      risk: 'low',
      successCriteria: [
        'All tests passing',
        'Lint clean',
        'TypeScript strict mode OK',
        'Coverage >= 80%',
      ],
      estimatedTime: '15 minutes',
    });

    // Step 7: Code Review prep
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Commit changes and prepare for code review',
      effort: 'small',
      risk: 'low',
      successCriteria: [
        'Commit message references issue',
        'Branch ready for PR',
        'All checks green',
      ],
      estimatedTime: '10 minutes',
    });

    // Step 8: Deployment prep (for features)
    if (description.includes('feature') || description.includes('integrat')) {
      steps.push({
        stepNumber: steps.length + 1,
        action: 'Prepare deployment checklist and monitoring',
        effort: 'medium',
        risk: 'medium',
        successCriteria: ['Monitoring configured', 'Rollback plan documented', 'Staging verified'],
        estimatedTime: '45 minutes',
      });
    }

    return steps;
  }

  /**
   * Estimate total time for all steps
   */
  private estimateTotalTime(steps: ExecutionStep[]): string {
    const timeMap: Record<string, number> = {
      '10 minutes': 10,
      '15 minutes': 15,
      '30 minutes': 30,
      '45 minutes': 45,
      '60 minutes': 60,
      '90 minutes': 90,
      '120 minutes': 120,
      '240 minutes': 240,
    };

    let totalMinutes = 0;
    steps.forEach((step) => {
      const minutes = timeMap[step.estimatedTime] || 30;
      totalMinutes += minutes;
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }

  /**
   * Plan multiple issues (batch operation)
   */
  async planIssues(issues: JiraIssue[]): Promise<ExecutionPlan[]> {
    logInfo('Planner: planning batch of issues', {
      correlationId: this.correlationId,
      issueCount: issues.length,
    });

    const plans = await Promise.all(issues.map((issue) => this.planIssue(issue)));

    logInfo('Planner: batch planning complete', {
      correlationId: this.correlationId,
      planCount: plans.length,
    });

    return plans;
  }
}
