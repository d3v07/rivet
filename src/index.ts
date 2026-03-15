/**
 * Rivet - Multi-Agent DevSecOps Flow
 * GitLab AI Hackathon 2026
 *
 * Entry point: runs the orchestrator pipeline against a Jira backlog
 */

import 'dotenv/config';
import { Orchestrator } from '@/orchestrator';
import { getAggregatedMetrics } from '@/lib/token-tracker';
import { logInfo, createCorrelationId } from '@/lib/logger';

export const VERSION = '0.1.0';

export async function main(): Promise<void> {
  const correlationId = createCorrelationId();

  logInfo('Rivet pipeline starting', {
    correlationId,
    version: VERSION,
    ollamaConfigured: !!process.env.OLLAMA_BASE_URL,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    jiraConfigured: !!process.env.JIRA_BASE_URL,
    gcpConfigured: !!process.env.GCP_PROJECT_ID,
  });

  const projectKey = process.env.JIRA_PROJECT_KEY || 'PROJ';
  const maxIssues = parseInt(process.env.MAX_ISSUES || '5', 10);

  const orchestrator = new Orchestrator(correlationId);
  const results = await orchestrator.runBacklog(projectKey, maxIssues);

  const metrics = getAggregatedMetrics();

  logInfo('Rivet pipeline complete', {
    correlationId,
    issuesProcessed: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    blocked: results.filter((r) => r.status === 'blocked').length,
    totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens,
    totalInvocations: metrics.totalInvocations,
    avgLatencyMs: Math.round(metrics.avgLatencyMs),
  });

  // Print summary table
  const summary = results.map((r) => ({
    issue: r.issueKey,
    status: r.status,
    stages: r.stages.map((s) => `${s.stage}:${s.status}`).join(' → '),
    duration: `${r.totalDurationMs}ms`,
    region: r.deployment?.decision?.selectedRegion || 'n/a',
    carbon: r.deployment?.decision?.carbonIntensity
      ? `${r.deployment.decision.carbonIntensity} gCO2eq/kWh`
      : 'n/a',
  }));

  logInfo('Pipeline results', {
    correlationId,
    summary: JSON.stringify(summary),
  });

  logInfo('Green Agents Metrics', {
    correlationId,
    totalInvocations: metrics.totalInvocations,
    totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens,
    inputTokens: metrics.totalInputTokens,
    outputTokens: metrics.totalOutputTokens,
    avgLatencyMs: Math.round(metrics.avgLatencyMs),
    byTool: metrics.byTool,
  });
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  main().catch((error) => {
    console.error('Pipeline failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
