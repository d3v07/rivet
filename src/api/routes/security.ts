import { Router, Request, Response } from 'express';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
type Category = 'SECRETS' | 'XSS' | 'SQL_INJECTION' | 'AUTH' | 'PROMPT_INJECTION';

interface SecurityFinding {
  readonly severity: Severity;
  readonly category: Category;
  readonly location: string;
  readonly issue: string;
  readonly recommendation: string;
  readonly issueKey: string;
}

interface VulnerabilityTrendPoint {
  readonly date: string;
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

const MOCK_FINDINGS: readonly SecurityFinding[] = [
  {
    severity: 'CRITICAL',
    category: 'SECRETS',
    location: 'src/config/database.ts:14',
    issue: 'Hardcoded database connection string with embedded credentials',
    recommendation: 'Move credentials to environment variables or GCP Secret Manager',
    issueKey: 'RIV-101',
  },
  {
    severity: 'HIGH',
    category: 'SQL_INJECTION',
    location: 'src/api/routes/backlog.ts:42',
    issue: 'User-supplied filter concatenated into SQL query without parameterization',
    recommendation: 'Use parameterized queries or an ORM with proper escaping',
    issueKey: 'RIV-101',
  },
  {
    severity: 'HIGH',
    category: 'XSS',
    location: 'src/agents/developer.ts:88',
    issue: 'Agent output rendered via innerHTML without sanitization',
    recommendation: 'Sanitize all LLM-generated content before DOM insertion',
    issueKey: 'RIV-102',
  },
  {
    severity: 'MEDIUM',
    category: 'AUTH',
    location: 'src/api/routes/pipelines.ts:15',
    issue: 'Pipeline trigger endpoint missing authentication middleware',
    recommendation: 'Add JWT or session verification middleware to protected routes',
    issueKey: 'RIV-103',
  },
  {
    severity: 'MEDIUM',
    category: 'PROMPT_INJECTION',
    location: 'src/agents/planner.ts:62',
    issue: 'Jira description passed to LLM prompt without sanitization',
    recommendation: 'Run all external text through prompt injection sanitizer before agent consumption',
    issueKey: 'RIV-103',
  },
  {
    severity: 'LOW',
    category: 'AUTH',
    location: 'src/api/server.ts:22',
    issue: 'CORS origin set to wildcard in non-development environment check',
    recommendation: 'Restrict CORS origins to known frontend domains in production',
    issueKey: 'RIV-104',
  },
  {
    severity: 'PASS',
    category: 'SECRETS',
    location: 'src/lib/logger.ts:30',
    issue: 'Secret masking correctly applied to all log outputs',
    recommendation: 'No action needed',
    issueKey: 'RIV-104',
  },
] as const;

function buildTrendData(): readonly VulnerabilityTrendPoint[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayOffset = 6 - i;
    return {
      date: date.toISOString().split('T')[0],
      critical: Math.max(0, 3 - Math.floor(i / 2)),
      high: Math.max(1, 5 - i),
      medium: Math.max(2, 4 - Math.floor(dayOffset / 3)),
      low: 2 + (i % 2),
    };
  });
}

const VALID_SEVERITIES = new Set<string>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASS']);
const VALID_CATEGORIES = new Set<string>([
  'SECRETS',
  'XSS',
  'SQL_INJECTION',
  'AUTH',
  'PROMPT_INJECTION',
]);

export const securityRouter = Router();

securityRouter.get('/findings', (req: Request, res: Response) => {
  const { severity, category } = req.query;

  if (severity && !VALID_SEVERITIES.has(String(severity))) {
    res.status(400).json({ error: `Invalid severity: ${severity}` });
    return;
  }
  if (category && !VALID_CATEGORIES.has(String(category))) {
    res.status(400).json({ error: `Invalid category: ${category}` });
    return;
  }

  const filtered = MOCK_FINDINGS.filter((f) => {
    if (severity && f.severity !== severity) return false;
    if (category && f.category !== category) return false;
    return true;
  });

  res.json(filtered);
});

securityRouter.get('/trend', (_req: Request, res: Response) => {
  res.json(buildTrendData());
});

securityRouter.get('/findings/:issueKey', (req: Request, res: Response) => {
  const { issueKey } = req.params;
  const findings = MOCK_FINDINGS.filter((f) => f.issueKey === issueKey);
  res.json(findings);
});
