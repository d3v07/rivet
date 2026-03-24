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
    category: 'PROMPT_INJECTION',
    location: 'src/lib/sanitizer.ts:28',
    issue: 'Jira description bypass via base64-encoded prompt injection payload',
    recommendation: 'Decode and re-sanitize base64 segments before passing to agent prompts',
    issueKey: 'DEV-11',
  },
  {
    severity: 'CRITICAL',
    category: 'PROMPT_INJECTION',
    location: 'src/agents/planner.ts:62',
    issue: 'Unicode homoglyph characters bypass regex-based sanitization filter',
    recommendation: 'Normalize Unicode to ASCII before applying injection pattern matching',
    issueKey: 'DEV-11',
  },
  {
    severity: 'HIGH',
    category: 'XSS',
    location: 'src/agents/developer.ts:88',
    issue: 'Agent-generated code output rendered without sanitization in review UI',
    recommendation: 'Sanitize all LLM-generated content before DOM insertion',
    issueKey: 'DEV-9',
  },
  {
    severity: 'MEDIUM',
    category: 'AUTH',
    location: 'src/api/routes/pipelines.ts:276',
    issue: 'Pipeline trigger endpoint POST /run missing authentication middleware',
    recommendation: 'Add JWT or session verification middleware to protected routes',
    issueKey: 'DEV-9',
  },
  {
    severity: 'MEDIUM',
    category: 'SECRETS',
    location: 'src/lib/token-tracker.ts:45',
    issue: 'Correlation IDs logged alongside token counts could leak pipeline context',
    recommendation: 'Hash correlation IDs before writing to persistent logs',
    issueKey: 'DEV-12',
  },
  {
    severity: 'LOW',
    category: 'AUTH',
    location: 'src/api/server.ts:22',
    issue: 'CORS origin set to wildcard in non-development environment check',
    recommendation: 'Restrict CORS origins to known frontend domains in production',
    issueKey: 'DEV-7',
  },
  {
    severity: 'PASS',
    category: 'SECRETS',
    location: 'src/lib/logger.ts:30',
    issue: 'Secret masking correctly applied to all log outputs via Winston transport',
    recommendation: 'No action needed — verified by SecurityAnalystAgent',
    issueKey: 'DEV-7',
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
