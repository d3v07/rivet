import { Router } from 'express';
import { getAggregatedMetrics } from '@/lib/token-tracker';

type GreenGrade = 'A' | 'B' | 'C' | 'D' | 'F';

interface GreenScoreEntry {
  issueKey: string;
  grade: GreenGrade;
  tokenEfficiency: number;
  carbonScore: number;
}

interface TokenOptimizationSuggestion {
  id: string;
  tool: string;
  currentTokens: number;
  optimizedTokens: number;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
}

function gradeFromEfficiency(efficiency: number): GreenGrade {
  if (efficiency > 1.5) return 'A';
  if (efficiency > 1.2) return 'B';
  if (efficiency > 0.8) return 'C';
  if (efficiency > 0.5) return 'D';
  return 'F';
}

const MOCK_TOKEN_METRICS = {
  totalInvocations: 47,
  totalInputTokens: 31200,
  totalOutputTokens: 18400,
  avgLatencyMs: 1240,
  byTool: {
    'query-jira-backlog': { count: 12, inputTokens: 8400, outputTokens: 4200, avgLatencyMs: 890 },
    'fetch-gcp-carbon': { count: 8, inputTokens: 5600, outputTokens: 3200, avgLatencyMs: 1100 },
    'sanitize-input': { count: 15, inputTokens: 10500, outputTokens: 6300, avgLatencyMs: 320 },
    'generate-plan': { count: 6, inputTokens: 4200, outputTokens: 3100, avgLatencyMs: 2800 },
    'run-security-scan': { count: 6, inputTokens: 2500, outputTokens: 1600, avgLatencyMs: 1950 },
  },
} as const;

const MOCK_GREEN_SCORES: GreenScoreEntry[] = [
  { issueKey: 'RIV-101', grade: 'A', tokenEfficiency: 1.72, carbonScore: 0.12 },
  { issueKey: 'RIV-102', grade: 'B', tokenEfficiency: 1.35, carbonScore: 0.28 },
  { issueKey: 'RIV-103', grade: 'A', tokenEfficiency: 1.61, carbonScore: 0.15 },
  { issueKey: 'RIV-104', grade: 'C', tokenEfficiency: 0.94, carbonScore: 0.52 },
  { issueKey: 'RIV-105', grade: 'D', tokenEfficiency: 0.63, carbonScore: 0.78 },
];

const MOCK_SUGGESTIONS: TokenOptimizationSuggestion[] = [
  {
    id: 'opt-001',
    tool: 'query-jira-backlog',
    currentTokens: 8400,
    optimizedTokens: 4800,
    suggestion: 'Request only key, summary, and status fields instead of full issue payloads',
    impact: 'high',
  },
  {
    id: 'opt-002',
    tool: 'generate-plan',
    currentTokens: 4200,
    optimizedTokens: 2600,
    suggestion: 'Cache repeated context blocks across sequential plan generations',
    impact: 'high',
  },
  {
    id: 'opt-003',
    tool: 'sanitize-input',
    currentTokens: 10500,
    optimizedTokens: 7800,
    suggestion: 'Batch sanitization calls for inputs under 500 tokens',
    impact: 'medium',
  },
  {
    id: 'opt-004',
    tool: 'fetch-gcp-carbon',
    currentTokens: 5600,
    optimizedTokens: 4100,
    suggestion: 'Cache region carbon intensity data with 1-hour TTL',
    impact: 'medium',
  },
  {
    id: 'opt-005',
    tool: 'run-security-scan',
    currentTokens: 2500,
    optimizedTokens: 1900,
    suggestion: 'Strip code comments and whitespace before sending to scan agent',
    impact: 'low',
  },
];

export const analyticsRouter = Router();

analyticsRouter.get('/tokens', (_req, res) => {
  try {
    const metrics = getAggregatedMetrics();
    const hasData = metrics.totalInvocations > 0;
    res.json(hasData ? metrics : MOCK_TOKEN_METRICS);
  } catch {
    res.json(MOCK_TOKEN_METRICS);
  }
});

analyticsRouter.get('/green-score', (_req, res) => {
  try {
    const metrics = getAggregatedMetrics();
    const hasData = metrics.totalInvocations > 0;

    if (!hasData) {
      const overallEfficiency =
        MOCK_GREEN_SCORES.reduce((sum, s) => sum + s.tokenEfficiency, 0) / MOCK_GREEN_SCORES.length;
      res.json({ grade: gradeFromEfficiency(overallEfficiency), scores: MOCK_GREEN_SCORES });
      return;
    }

    const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens;
    const scores: GreenScoreEntry[] = Object.entries(metrics.byTool).map(([_tool, data], i) => {
      const toolTokens = data.inputTokens + data.outputTokens;
      const efficiency = totalTokens > 0 ? (data.count / toolTokens) * 1000 : 0;
      const carbonScore = Math.min(toolTokens / totalTokens, 1);
      return {
        issueKey: `RIV-${101 + i}`,
        grade: gradeFromEfficiency(efficiency),
        tokenEfficiency: Math.round(efficiency * 100) / 100,
        carbonScore: Math.round(carbonScore * 100) / 100,
      };
    });

    const avgEfficiency =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s.tokenEfficiency, 0) / scores.length : 0;

    res.json({ grade: gradeFromEfficiency(avgEfficiency), scores });
  } catch {
    res.status(500).json({ error: 'Failed to compute green score' });
  }
});

analyticsRouter.get('/suggestions', (_req, res) => {
  res.json(MOCK_SUGGESTIONS);
});
