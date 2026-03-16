import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Orchestrator, type PipelineResult as BackendPipelineResult } from '@/orchestrator';
import type { JiraIssue } from '@/types/index';

interface FrontendDeploymentDecision {
  selectedRegion: string;
  carbonIntensity: number;
  costPerHour: number;
  compositeScore: number;
}

interface FrontendPipelineStage {
  stage: 'plan' | 'develop' | 'security' | 'deploy';
  status: 'success' | 'failed';
  durationMs: number;
  output: string;
}

interface FrontendPipelineResult {
  issueKey: string;
  summary: string;
  priority: 'highest' | 'high' | 'medium' | 'low';
  status: 'success' | 'failed' | 'blocked';
  stages: FrontendPipelineStage[];
  totalDurationMs: number;
  totalTokens: number;
  deployment?: {
    status: 'deployed' | 'dry_run' | 'blocked';
    decision?: FrontendDeploymentDecision;
  };
}

const VALID_PRIORITIES = ['highest', 'high', 'medium', 'low'] as const;
type Priority = (typeof VALID_PRIORITIES)[number];

const RunPipelineSchema = z.object({
  issueKey: z.string().min(1).max(50),
  summary: z.string().min(1).max(500),
  priority: z.enum(VALID_PRIORITIES).optional().default('medium'),
  description: z.string().max(5000).optional(),
});

const pipelineStore: FrontendPipelineResult[] = [
  {
    issueKey: 'DEV-5',
    summary: 'Implement user authentication with JWT tokens and refresh flow',
    priority: 'highest',
    status: 'success',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 3200, output: 'Execution plan generated with 6 steps' },
      { stage: 'develop', status: 'success', durationMs: 28400, output: '6/6 steps completed via TDD' },
      { stage: 'security', status: 'success', durationMs: 5100, output: '0 critical findings' },
      { stage: 'deploy', status: 'success', durationMs: 7500, output: 'Deployed to europe-west1' },
    ],
    totalDurationMs: 44200,
    totalTokens: 18432,
    deployment: {
      status: 'deployed',
      decision: { selectedRegion: 'europe-west1', carbonIntensity: 28, costPerHour: 0.034, compositeScore: 29.8 },
    },
  },
  {
    issueKey: 'DEV-12',
    summary: 'Add rate limiting middleware for API endpoints',
    priority: 'high',
    status: 'success',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 2800, output: 'Execution plan generated with 4 steps' },
      { stage: 'develop', status: 'success', durationMs: 19200, output: '4/4 steps completed via TDD' },
      { stage: 'security', status: 'success', durationMs: 4300, output: '1 LOW finding' },
      { stage: 'deploy', status: 'success', durationMs: 6100, output: 'Deployed to us-central1' },
    ],
    totalDurationMs: 32400,
    totalTokens: 12890,
    deployment: {
      status: 'deployed',
      decision: { selectedRegion: 'us-central1', carbonIntensity: 42, costPerHour: 0.028, compositeScore: 37.8 },
    },
  },
  {
    issueKey: 'DEV-18',
    summary: 'Fix SQL injection vulnerability in search endpoint',
    priority: 'highest',
    status: 'blocked',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 2100, output: 'Execution plan generated with 3 steps' },
      { stage: 'develop', status: 'success', durationMs: 15800, output: '3/3 steps completed via TDD' },
      { stage: 'security', status: 'failed', durationMs: 6200, output: '2 CRITICAL findings — deployment blocked' },
      { stage: 'deploy', status: 'failed', durationMs: 0, output: 'Blocked by security review' },
    ],
    totalDurationMs: 24100,
    totalTokens: 9845,
    deployment: { status: 'blocked' },
  },
  {
    issueKey: 'DEV-21',
    summary: 'Implement webhook handler for Stripe payment events',
    priority: 'high',
    status: 'success',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 3500, output: 'Execution plan generated with 5 steps' },
      { stage: 'develop', status: 'success', durationMs: 24600, output: '5/5 steps completed via TDD' },
      { stage: 'security', status: 'success', durationMs: 4800, output: '1 MEDIUM finding, non-blocking' },
      { stage: 'deploy', status: 'success', durationMs: 8200, output: 'Deployed to europe-west1' },
    ],
    totalDurationMs: 41100,
    totalTokens: 21340,
    deployment: {
      status: 'deployed',
      decision: { selectedRegion: 'europe-west1', carbonIntensity: 28, costPerHour: 0.034, compositeScore: 29.8 },
    },
  },
  {
    issueKey: 'DEV-24',
    summary: 'Add GraphQL schema for user profile management',
    priority: 'medium',
    status: 'failed',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 2900, output: 'Execution plan generated with 7 steps' },
      { stage: 'develop', status: 'failed', durationMs: 31200, output: '4/7 steps completed — test failures' },
      { stage: 'security', status: 'failed', durationMs: 0, output: 'Skipped — development failed' },
      { stage: 'deploy', status: 'failed', durationMs: 0, output: 'Skipped — pipeline failed' },
    ],
    totalDurationMs: 34100,
    totalTokens: 15670,
  },
  {
    issueKey: 'DEV-27',
    summary: 'Create database migration for multi-tenancy support',
    priority: 'high',
    status: 'success',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 4100, output: 'Execution plan generated with 8 steps' },
      { stage: 'develop', status: 'success', durationMs: 35600, output: '8/8 steps completed via TDD' },
      { stage: 'security', status: 'success', durationMs: 5400, output: '0 findings' },
      { stage: 'deploy', status: 'success', durationMs: 9800, output: 'Dry run to asia-east1' },
    ],
    totalDurationMs: 54900,
    totalTokens: 27810,
    deployment: {
      status: 'dry_run',
      decision: { selectedRegion: 'asia-east1', carbonIntensity: 55, costPerHour: 0.025, compositeScore: 46.0 },
    },
  },
  {
    issueKey: 'DEV-31',
    summary: 'Implement real-time notification system via WebSockets',
    priority: 'medium',
    status: 'blocked',
    stages: [
      { stage: 'plan', status: 'success', durationMs: 3300, output: 'Execution plan generated with 5 steps' },
      { stage: 'develop', status: 'success', durationMs: 22100, output: '5/5 steps completed via TDD' },
      { stage: 'security', status: 'failed', durationMs: 7200, output: '1 HIGH finding — deployment blocked' },
      { stage: 'deploy', status: 'failed', durationMs: 0, output: 'Blocked by security review' },
    ],
    totalDurationMs: 32600,
    totalTokens: 14290,
    deployment: { status: 'blocked' },
  },
];

const PRIORITY_ORDER: Record<Priority, number> = { highest: 0, high: 1, medium: 2, low: 3 };

function transformBackendResult(
  backend: BackendPipelineResult,
  summary: string,
  priority: Priority,
): FrontendPipelineResult {
  const stages: FrontendPipelineStage[] = backend.stages.map((s) => ({
    stage: s.stage as FrontendPipelineStage['stage'],
    status: s.status === 'skipped' ? 'failed' : s.status,
    durationMs: s.durationMs,
    output: s.summary,
  }));

  const totalTokens =
    (backend.tokenMetrics?.totalInputTokens ?? 0) +
    (backend.tokenMetrics?.totalOutputTokens ?? 0);

  const deployment = backend.deployment
    ? {
        status: backend.deployment.status as 'deployed' | 'dry_run' | 'blocked',
        ...(backend.deployment.decision
          ? {
              decision: {
                selectedRegion: backend.deployment.decision.selectedRegion,
                carbonIntensity: backend.deployment.decision.carbonIntensity,
                costPerHour: backend.deployment.decision.estimatedCostPerHour,
                compositeScore:
                  backend.deployment.decision.carbonIntensity * 0.6 +
                  backend.deployment.decision.estimatedCostPerHour * 1000 * 0.4,
              },
            }
          : {}),
      }
    : undefined;

  return {
    issueKey: backend.issueKey,
    summary,
    priority,
    status: backend.status,
    stages,
    totalDurationMs: backend.totalDurationMs,
    totalTokens,
    deployment,
  };
}

export const pipelinesRouter = Router();

pipelinesRouter.get('/', (req: Request, res: Response) => {
  const {
    status,
    priority,
    sort = 'totalDurationMs',
    order = 'desc',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string | undefined>;

  let results = [...pipelineStore];

  if (status && ['success', 'failed', 'blocked'].includes(status)) {
    results = results.filter((r) => r.status === status);
  }

  if (priority && VALID_PRIORITIES.includes(priority as Priority)) {
    results = results.filter((r) => r.priority === priority);
  }

  const sortKey = sort as keyof FrontendPipelineResult;
  const sortDir = order === 'asc' ? 1 : -1;

  results.sort((a, b) => {
    if (sortKey === 'priority') {
      return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * sortDir;
    }
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * sortDir;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * sortDir;
    }
    return 0;
  });

  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
  const startIdx = (pageNum - 1) * limitNum;
  const paginated = results.slice(startIdx, startIdx + limitNum);

  res.json({
    data: paginated,
    meta: {
      total: results.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(results.length / limitNum),
    },
  });
});

pipelinesRouter.get('/:issueKey', (req: Request, res: Response) => {
  const pipeline = pipelineStore.find((p) => p.issueKey === req.params.issueKey);
  if (!pipeline) {
    res.status(404).json({ error: `Pipeline not found for issue ${req.params.issueKey}` });
    return;
  }
  res.json({ data: pipeline });
});

pipelinesRouter.post('/run', async (req: Request, res: Response) => {
  const parsed = RunPipelineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { issueKey, summary, priority, description } = parsed.data;

  const existing = pipelineStore.find((p) => p.issueKey === issueKey);
  if (existing) {
    res.status(409).json({ error: `Pipeline already exists for issue ${issueKey}` });
    return;
  }

  const issue: JiraIssue = {
    key: issueKey,
    summary,
    description: description ?? null,
    status: 'To Do',
    priority: priority ?? 'medium',
    assignee: null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    const orchestrator = new Orchestrator();
    const backendResult = await orchestrator.runPipeline(issue);
    const frontendResult = transformBackendResult(backendResult, summary, priority ?? 'medium');
    pipelineStore.push(frontendResult);
    res.status(201).json({ data: frontendResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline execution failed';
    res.status(500).json({ error: message });
  }
});
