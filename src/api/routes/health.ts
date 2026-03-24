import { Router } from 'express';
import { getActiveProvider } from '@/lib/claude-client';
import { getAggregatedMetrics } from '@/lib/token-tracker';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const provider = getActiveProvider();
  const metrics = getAggregatedMetrics();

  res.json({
    status: 'ok',
    version: '0.4.2',
    uptime: process.uptime(),
    llmProvider: provider ?? 'none',
    llmAvailable: provider !== null,
    tokenMetrics: {
      totalInvocations: metrics.totalInvocations,
      totalInputTokens: metrics.totalInputTokens,
      totalOutputTokens: metrics.totalOutputTokens,
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});
