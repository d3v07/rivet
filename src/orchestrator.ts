/**
 * Flow Orchestrator: Chains Jira → Planner → Developer → Security → Deploy
 * Each stage produces an audit trail with correlation IDs for traceability
 */

import { PlannerAgent } from '@/agents/planner';
import { DeveloperAgent, type DeveloperProgress } from '@/agents/developer';
import { SecurityAnalystAgent, type SecurityReview } from '@/agents/security-analyst';
import { DeployerAgent, type DeploymentResult } from '@/agents/deployer';
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog';
import { createCorrelationId, logInfo, logError } from '@/lib/logger';
import { getAggregatedMetrics } from '@/lib/token-tracker';
import type { JiraIssue, ExecutionPlan } from '@/types/index';
import { z } from 'zod';

const PipelineStageSchema = z.object({
  stage: z.string(),
  status: z.enum(['success', 'failed', 'skipped']),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  summary: z.string(),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

const PipelineResultSchema = z.object({
  pipelineId: z.string(),
  correlationId: z.string(),
  issueKey: z.string(),
  status: z.enum(['success', 'failed', 'blocked']),
  stages: z.array(PipelineStageSchema),
  plan: z.any().optional(),
  devProgress: z.any().optional(),
  securityReview: z.any().optional(),
  deployment: z.any().optional(),
  totalDurationMs: z.number(),
  tokenMetrics: z.any(),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export class Orchestrator {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || createCorrelationId();
  }

  /**
   * Run the full pipeline for a single Jira issue
   */
  async runPipeline(issue: JiraIssue): Promise<PipelineResult> {
    const pipelineStart = Date.now();
    const stages: PipelineStage[] = [];

    logInfo('Orchestrator: pipeline started', {
      correlationId: this.correlationId,
      issueKey: issue.key,
      summary: issue.summary,
    });

    let plan: ExecutionPlan | null = null;
    let devProgress: DeveloperProgress | null = null;
    let securityReview: SecurityReview | null = null;
    let deployment: DeploymentResult | null = null;
    let pipelineStatus: 'success' | 'failed' | 'blocked' = 'success';

    // Stage 1: Plan
    const planResult = await this.runStage('plan', async () => {
      const planner = new PlannerAgent(this.correlationId);
      plan = await planner.planIssue(issue);
      return `Generated ${plan.steps.length}-step plan (${plan.totalEstimatedTime}, risk: ${plan.riskSummary})`;
    });
    stages.push(planResult);

    if (planResult.status === 'failed' || !plan) {
      pipelineStatus = 'failed';
      return this.buildResult(issue.key, pipelineStatus, stages, pipelineStart, {});
    }

    // Stage 2: Develop
    const devResult = await this.runStage('develop', async () => {
      const developer = new DeveloperAgent(this.correlationId);
      devProgress = await developer.executePlan(plan!);
      return `${devProgress.completedSteps}/${devProgress.totalSteps} steps completed (${devProgress.status})`;
    });
    stages.push(devResult);

    if (devResult.status === 'failed' || !devProgress) {
      pipelineStatus = 'failed';
      return this.buildResult(issue.key, pipelineStatus, stages, pipelineStart, {
        plan,
      });
    }

    // Stage 3: Security Review
    const secResult = await this.runStage('security', async () => {
      const analyst = new SecurityAnalystAgent(this.correlationId);
      const mockFiles = this.extractFilesFromProgress(devProgress!);
      securityReview = await analyst.reviewCode(issue.key, mockFiles);
      return `${securityReview.overallSeverity}: ${securityReview.findings.length} findings. ${securityReview.blocksDeployment ? 'BLOCKS DEPLOYMENT' : 'Clear to deploy'}`;
    });
    stages.push(secResult);

    if (secResult.status === 'failed' || !securityReview) {
      pipelineStatus = 'failed';
      return this.buildResult(issue.key, pipelineStatus, stages, pipelineStart, {
        plan,
        devProgress,
      });
    }

    // Stage 4: Deploy
    const deployResult = await this.runStage('deploy', async () => {
      const deployer = new DeployerAgent(this.correlationId);
      deployment = await deployer.deploy(issue.key, securityReview!);
      return `${deployment.status}: ${deployment.decision.selectedRegion} (${deployment.decision.carbonIntensity} gCO2eq/kWh, $${deployment.decision.estimatedCostPerHour}/hr)`;
    });
    stages.push(deployResult);

    if (deployment && (deployment as DeploymentResult).status === 'blocked') {
      pipelineStatus = 'blocked';
    } else if (deployResult.status === 'failed') {
      pipelineStatus = 'failed';
    }

    return this.buildResult(issue.key, pipelineStatus, stages, pipelineStart, {
      plan,
      devProgress,
      securityReview,
      deployment,
    });
  }

  /**
   * Run pipeline for all issues from a Jira project backlog
   */
  async runBacklog(projectKey: string, maxIssues: number = 5): Promise<PipelineResult[]> {
    logInfo('Orchestrator: fetching backlog', {
      correlationId: this.correlationId,
      projectKey,
      maxIssues,
    });

    const backlog = await executeQueryJiraBacklog({
      projectKey,
      statusFilter: 'Ready for Engineering',
      maxResults: maxIssues,
      correlationId: this.correlationId,
    });

    const results: PipelineResult[] = [];
    for (const issue of backlog.issues) {
      const result = await this.runPipeline(issue);
      results.push(result);

      if (result.status === 'failed') {
        logInfo('Orchestrator: stopping backlog processing due to failure', {
          correlationId: this.correlationId,
          failedIssue: issue.key,
        });
        break;
      }
    }

    logInfo('Orchestrator: backlog processing complete', {
      correlationId: this.correlationId,
      totalIssues: backlog.issues.length,
      processed: results.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      blocked: results.filter((r) => r.status === 'blocked').length,
    });

    return results;
  }

  /**
   * Run a single pipeline stage with timing and error handling
   */
  private async runStage(
    stageName: string,
    fn: () => Promise<string>
  ): Promise<PipelineStage> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
      logInfo(`Orchestrator: stage ${stageName} started`, {
        correlationId: this.correlationId,
      });

      const summary = await fn();
      const durationMs = Date.now() - startMs;

      logInfo(`Orchestrator: stage ${stageName} completed`, {
        correlationId: this.correlationId,
        durationMs,
        summary,
      });

      return {
        stage: stageName,
        status: 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        summary,
      };
    } catch (error) {
      const durationMs = Date.now() - startMs;

      logError(
        `Orchestrator: stage ${stageName} failed`,
        { correlationId: this.correlationId },
        error as Error
      );

      return {
        stage: stageName,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        summary: `Failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract file references from developer progress for security review
   */
  private extractFilesFromProgress(
    progress: DeveloperProgress
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    for (const result of progress.results) {
      if (result.result && result.result.length > 0) {
        files.push({
          path: `generated/${result.action.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.ts`,
          content: result.result,
        });
      }
    }

    return files.length > 0
      ? files
      : [{ path: 'src/placeholder.ts', content: '// No files generated' }];
  }

  /**
   * Build the final pipeline result
   */
  private buildResult(
    issueKey: string,
    status: 'success' | 'failed' | 'blocked',
    stages: PipelineStage[],
    startTime: number,
    artifacts: {
      plan?: ExecutionPlan | null;
      devProgress?: DeveloperProgress | null;
      securityReview?: SecurityReview | null;
      deployment?: DeploymentResult | null;
    }
  ): PipelineResult {
    const totalDurationMs = Date.now() - startTime;
    const tokenMetrics = getAggregatedMetrics();

    logInfo('Orchestrator: pipeline result', {
      correlationId: this.correlationId,
      issueKey,
      status,
      stageCount: stages.length,
      totalDurationMs,
      totalTokens: tokenMetrics.totalInputTokens + tokenMetrics.totalOutputTokens,
    });

    return {
      pipelineId: `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      correlationId: this.correlationId,
      issueKey,
      status,
      stages,
      plan: artifacts.plan ?? undefined,
      devProgress: artifacts.devProgress ?? undefined,
      securityReview: artifacts.securityReview ?? undefined,
      deployment: artifacts.deployment ?? undefined,
      totalDurationMs,
      tokenMetrics,
    };
  }
}
