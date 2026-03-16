import { Router } from 'express';
import type { PBOM } from '@security/pbom';

const MOCK_PBOMS: readonly PBOM[] = Object.freeze([
  {
    version: '1.0.0',
    pipelineId: 'pipeline-001',
    correlationId: 'corr-dev7-a1b2c3',
    generatedAt: '2026-03-14T10:30:00.000Z',
    trigger: { type: 'jira', issueKey: 'DEV-7' },
    agents: [
      { name: 'PlannerAgent', model: 'gemini-2.5-flash', provider: 'google' },
      { name: 'DeveloperAgent', model: 'gemini-2.5-flash', provider: 'google' },
      { name: 'SecurityAgent', model: 'gemini-2.5-flash', provider: 'google' },
      { name: 'DeployerAgent', model: 'gemini-2.5-flash', provider: 'google' },
    ],
    tools: [
      { name: 'jira-query', invocations: 3, totalTokens: 1850 },
      { name: 'gcp-deploy', invocations: 1, totalTokens: 920 },
      { name: 'security-scan', invocations: 2, totalTokens: 1340 },
    ],
    tokenMetrics: {
      totalInputTokens: 12400,
      totalOutputTokens: 8200,
      totalLatencyMs: 34500,
      efficiency: 0.661,
    },
    stages: [
      { name: 'planning', status: 'success', durationMs: 8200 },
      { name: 'development', status: 'success', durationMs: 12400 },
      { name: 'security-scan', status: 'success', durationMs: 6800 },
      { name: 'deployment', status: 'success', durationMs: 7100 },
    ],
    totalDurationMs: 34500,
    overallStatus: 'success',
    environment: {
      nodeVersion: 'v20.11.0',
      platform: 'linux',
      rivetVersion: '0.1.0',
    },
  },
  {
    version: '1.0.0',
    pipelineId: 'pipeline-002',
    correlationId: 'corr-dev11-d4e5f6',
    generatedAt: '2026-03-14T14:15:00.000Z',
    trigger: { type: 'jira', issueKey: 'DEV-11' },
    agents: [
      { name: 'PlannerAgent', model: 'gemini-2.5-flash', provider: 'google' },
      { name: 'DeveloperAgent', model: 'gemini-2.5-flash', provider: 'google' },
      { name: 'SecurityAgent', model: 'gemini-2.5-flash', provider: 'google' },
    ],
    tools: [
      { name: 'jira-query', invocations: 2, totalTokens: 1200 },
      { name: 'security-scan', invocations: 3, totalTokens: 2100 },
    ],
    tokenMetrics: {
      totalInputTokens: 9800,
      totalOutputTokens: 5400,
      totalLatencyMs: 28900,
      efficiency: 0.551,
    },
    stages: [
      { name: 'planning', status: 'success', durationMs: 7600 },
      { name: 'development', status: 'success', durationMs: 11200 },
      { name: 'security-scan', status: 'failed', durationMs: 10100 },
    ],
    totalDurationMs: 28900,
    overallStatus: 'failed',
    environment: {
      nodeVersion: 'v20.11.0',
      platform: 'linux',
      rivetVersion: '0.1.0',
    },
  },
]);

export const pbomRouter = Router();

pbomRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', data: MOCK_PBOMS });
});

pbomRouter.get('/:pipelineId', (req, res) => {
  const pbom = MOCK_PBOMS.find((p) => p.pipelineId === req.params.pipelineId);
  if (!pbom) {
    res
      .status(404)
      .json({ status: 'error', error: `No PBOM found for pipeline ${req.params.pipelineId}` });
    return;
  }
  res.json({ status: 'ok', data: pbom });
});

pbomRouter.get('/:pipelineId/export', (req, res) => {
  const pbom = MOCK_PBOMS.find((p) => p.pipelineId === req.params.pipelineId);
  if (!pbom) {
    res
      .status(404)
      .json({ status: 'error', error: `No PBOM found for pipeline ${req.params.pipelineId}` });
    return;
  }
  const filename = `pbom-${pbom.pipelineId}-${pbom.trigger.issueKey}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(pbom, null, 2));
});
