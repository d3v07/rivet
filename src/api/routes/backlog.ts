import { Router, type Request, type Response } from 'express';
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog';
import { createCorrelationId, logInfo, logError } from '@/lib/logger';

export const backlogRouter = Router();

interface JiraBacklogItem {
  issueKey: string;
  summary: string;
  priority: 'highest' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  assignee: string;
  storyPoints: number;
  labels: string[];
  createdAt: string;
}

const PRIORITY_MAP: Record<string, JiraBacklogItem['priority']> = {
  highest: 'highest',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const STATUS_MAP: Record<string, JiraBacklogItem['status']> = {
  'to do': 'todo',
  backlog: 'todo',
  'ready for engineering': 'todo',
  'in progress': 'in_progress',
  done: 'done',
};

function normalizePriority(raw: string | null | undefined): JiraBacklogItem['priority'] {
  if (!raw) return 'medium';
  return PRIORITY_MAP[raw.toLowerCase()] ?? 'medium';
}

function normalizeStatus(raw: string): JiraBacklogItem['status'] {
  return STATUS_MAP[raw.toLowerCase()] ?? 'todo';
}

function hasJiraCredentials(): boolean {
  return Boolean(
    process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN
  );
}

const MOCK_BACKLOG: readonly JiraBacklogItem[] = [
  { issueKey: 'RVT-1', summary: 'Implement OAuth 2.0 authentication flow', priority: 'highest', status: 'in_progress', assignee: 'Ava Chen', storyPoints: 8, labels: ['security', 'auth'], createdAt: '2026-03-01T09:00:00Z' },
  { issueKey: 'RVT-2', summary: 'Set up PostgreSQL schema migrations', priority: 'high', status: 'done', assignee: 'Marcus Webb', storyPoints: 5, labels: ['database', 'infra'], createdAt: '2026-03-01T10:30:00Z' },
  { issueKey: 'RVT-3', summary: 'Create CI/CD pipeline with GitLab runners', priority: 'high', status: 'done', assignee: 'Ava Chen', storyPoints: 5, labels: ['devops', 'ci'], createdAt: '2026-03-02T08:15:00Z' },
  { issueKey: 'RVT-4', summary: 'Build Jira backlog sync endpoint', priority: 'high', status: 'in_progress', assignee: 'Lena Park', storyPoints: 5, labels: ['api', 'integration'], createdAt: '2026-03-02T14:00:00Z' },
  { issueKey: 'RVT-5', summary: 'Add GCP carbon metrics fetcher', priority: 'medium', status: 'in_progress', assignee: 'Marcus Webb', storyPoints: 3, labels: ['gcp', 'green-agents'], createdAt: '2026-03-03T11:00:00Z' },
  { issueKey: 'RVT-6', summary: 'Implement prompt injection sanitizer', priority: 'highest', status: 'done', assignee: 'Lena Park', storyPoints: 8, labels: ['security'], createdAt: '2026-03-03T13:45:00Z' },
  { issueKey: 'RVT-7', summary: 'Design PBOM generation pipeline', priority: 'medium', status: 'todo', assignee: 'Ava Chen', storyPoints: 5, labels: ['security', 'pbom'], createdAt: '2026-03-04T09:30:00Z' },
  { issueKey: 'RVT-8', summary: 'Wire up Planner agent with GitLab Duo', priority: 'high', status: 'in_progress', assignee: 'Marcus Webb', storyPoints: 8, labels: ['agents', 'gitlab'], createdAt: '2026-03-04T15:00:00Z' },
  { issueKey: 'RVT-9', summary: 'Add token usage tracking per agent', priority: 'medium', status: 'done', assignee: 'Lena Park', storyPoints: 3, labels: ['observability', 'green-agents'], createdAt: '2026-03-05T10:00:00Z' },
  { issueKey: 'RVT-10', summary: 'Build Developer agent code generation', priority: 'high', status: 'todo', assignee: 'Ava Chen', storyPoints: 13, labels: ['agents', 'core'], createdAt: '2026-03-05T14:30:00Z' },
  { issueKey: 'RVT-11', summary: 'Implement security scan agent', priority: 'highest', status: 'todo', assignee: 'Marcus Webb', storyPoints: 8, labels: ['agents', 'security'], createdAt: '2026-03-06T08:00:00Z' },
  { issueKey: 'RVT-12', summary: 'Create deployment approval gate', priority: 'medium', status: 'todo', assignee: 'Lena Park', storyPoints: 5, labels: ['devops', 'governance'], createdAt: '2026-03-06T11:15:00Z' },
  { issueKey: 'RVT-13', summary: 'Add structured audit logging', priority: 'low', status: 'todo', assignee: 'Marcus Webb', storyPoints: 3, labels: ['observability', 'audit'], createdAt: '2026-03-07T09:00:00Z' },
  { issueKey: 'RVT-14', summary: 'Integrate compute pricing API', priority: 'low', status: 'done', assignee: 'Ava Chen', storyPoints: 3, labels: ['gcp', 'pricing'], createdAt: '2026-03-07T13:00:00Z' },
  { issueKey: 'RVT-15', summary: 'Write E2E test for full agent flow', priority: 'medium', status: 'todo', assignee: 'Lena Park', storyPoints: 8, labels: ['testing', 'e2e'], createdAt: '2026-03-08T10:00:00Z' },
] as const;

function getMockBacklog(status?: string, maxResults?: number): readonly JiraBacklogItem[] {
  let items: readonly JiraBacklogItem[] = MOCK_BACKLOG;
  if (status) {
    items = items.filter((item) => item.status === status);
  }
  if (maxResults && maxResults > 0) {
    items = items.slice(0, maxResults);
  }
  return items;
}

backlogRouter.get('/', async (req: Request, res: Response) => {
  const correlationId = createCorrelationId();
  const projectKey = (req.query.projectKey as string) || process.env.JIRA_PROJECT_KEY || 'RVT';
  const status = req.query.status as string | undefined;
  const maxResults = req.query.maxResults ? Number(req.query.maxResults) : undefined;

  if (!hasJiraCredentials()) {
    logInfo('Serving mock backlog data', { correlationId });
    const items = getMockBacklog(status, maxResults);
    res.json({ data: items, total: items.length, mock: true });
    return;
  }

  try {
    const result = await executeQueryJiraBacklog({
      projectKey,
      statusFilter: status,
      maxResults: maxResults ?? 50,
      correlationId,
    });

    const items: JiraBacklogItem[] = result.issues.map((issue) => ({
      issueKey: issue.key,
      summary: issue.summary,
      priority: normalizePriority(issue.priority),
      status: normalizeStatus(issue.status),
      assignee: issue.assignee ?? 'Unassigned',
      storyPoints: 0,
      labels: [],
      createdAt: issue.created,
    }));

    logInfo('Backlog fetched from Jira', { correlationId, count: items.length });
    res.json({ data: items, total: result.total, mock: false });
  } catch (error) {
    logError('Failed to fetch backlog', { correlationId, projectKey }, error as Error);
    res.status(502).json({
      error: 'Failed to fetch backlog from Jira',
      correlationId,
    });
  }
});
