import { Router } from 'express';

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  target: string;
  details: string;
  category: 'pipeline' | 'security' | 'deployment' | 'config' | 'user';
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'deploy' | 'security' | 'failed' | 'info';
  time: string;
  read: boolean;
}

const AUDIT_EVENTS: readonly AuditEvent[] = [
  {
    id: 'ae-001',
    timestamp: '2026-03-15T09:12:00Z',
    action: 'pipeline.triggered',
    actor: 'PlannerAgent',
    target: 'DEV-7',
    details: 'MCP server implementation queued for execution',
    category: 'pipeline',
  },
  {
    id: 'ae-002',
    timestamp: '2026-03-15T09:14:22Z',
    action: 'security.scan.started',
    actor: 'SecurityAgent',
    target: 'DEV-11',
    details: 'SAST scan initiated on sanitization middleware — 14 files',
    category: 'security',
  },
  {
    id: 'ae-003',
    timestamp: '2026-03-15T09:15:10Z',
    action: 'security.vulnerability.found',
    actor: 'SecurityAgent',
    target: 'DEV-11',
    details: 'CRITICAL: base64-encoded prompt injection bypass in sanitizer.ts:28',
    category: 'security',
  },
  {
    id: 'ae-004',
    timestamp: '2026-03-15T09:18:45Z',
    action: 'pipeline.stage.completed',
    actor: 'DeveloperAgent',
    target: 'DEV-9',
    details: 'Security scanning agent code generation completed in 41s',
    category: 'pipeline',
  },
  {
    id: 'ae-005',
    timestamp: '2026-03-15T09:22:00Z',
    action: 'config.updated',
    actor: 'd3v07',
    target: '.gitlab-ci.yml',
    details: 'Added SAST stage to CI pipeline for DEV-9',
    category: 'config',
  },
  {
    id: 'ae-006',
    timestamp: '2026-03-15T09:30:15Z',
    action: 'deployment.approved',
    actor: 'd3v07',
    target: 'DEV-10',
    details: 'Manual approval for deployment orchestrator to europe-west1',
    category: 'deployment',
  },
  {
    id: 'ae-007',
    timestamp: '2026-03-15T09:32:00Z',
    action: 'deployment.started',
    actor: 'DeployerAgent',
    target: 'DEV-8',
    details: 'Carbon metrics API deployed to europe-north1 (12 gCO2/kWh)',
    category: 'deployment',
  },
  {
    id: 'ae-008',
    timestamp: '2026-03-15T09:35:44Z',
    action: 'deployment.completed',
    actor: 'DeployerAgent',
    target: 'DEV-8',
    details: 'Health checks passed on europe-north1',
    category: 'deployment',
  },
  {
    id: 'ae-009',
    timestamp: '2026-03-15T09:40:00Z',
    action: 'pipeline.blocked',
    actor: 'SecurityAgent',
    target: 'DEV-11',
    details: '2 CRITICAL findings — deployment blocked automatically',
    category: 'security',
  },
  {
    id: 'ae-010',
    timestamp: '2026-03-15T09:45:30Z',
    action: 'pipeline.failed',
    actor: 'DeveloperAgent',
    target: 'DEV-13',
    details: 'PBOM generation failed at development stage — 4/7 test steps passing',
    category: 'pipeline',
  },
];

const notifications: Notification[] = [
  {
    id: 'n-001',
    title: 'Deployment Succeeded',
    message: 'DEV-8 carbon metrics API deployed to europe-north1 (12 gCO2/kWh)',
    type: 'deploy',
    time: '2026-03-15T09:35:44Z',
    read: false,
  },
  {
    id: 'n-002',
    title: 'Critical Vulnerability',
    message: 'DEV-11: base64-encoded prompt injection bypass found in sanitizer.ts:28',
    type: 'security',
    time: '2026-03-15T09:15:10Z',
    read: false,
  },
  {
    id: 'n-003',
    title: 'Pipeline Failed',
    message: 'DEV-13 PBOM generation failed at development stage — 4/7 test steps passing',
    type: 'failed',
    time: '2026-03-15T09:45:30Z',
    read: false,
  },
  {
    id: 'n-004',
    title: 'PBOM Generated',
    message: 'DEV-7 Pipeline Bill of Materials: 4 agents, 3 tools, 18,432 tokens',
    type: 'info',
    time: '2026-03-15T09:20:00Z',
    read: true,
  },
  {
    id: 'n-005',
    title: 'Carbon Report Ready',
    message: 'DEV-8 deployed to greenest region: europe-north1 at 12 gCO2/kWh — 78% below default',
    type: 'info',
    time: '2026-03-15T09:38:00Z',
    read: true,
  },
  {
    id: 'n-006',
    title: 'Pipeline Blocked',
    message: 'DEV-11 blocked: 2 CRITICAL prompt injection findings — deployment halted',
    type: 'security',
    time: '2026-03-15T09:16:00Z',
    read: false,
  },
  {
    id: 'n-007',
    title: 'Deploy Awaiting Approval',
    message: 'DEV-10 deployment orchestrator ready for europe-west1 — awaiting manual approval',
    type: 'deploy',
    time: '2026-03-15T09:50:00Z',
    read: false,
  },
];

export const auditRouter = Router();

auditRouter.get('/', (req, res) => {
  const { category } = req.query;

  if (category && typeof category === 'string') {
    const validCategories = ['pipeline', 'security', 'deployment', 'config', 'user'] as const;
    if (!validCategories.includes(category as (typeof validCategories)[number])) {
      res
        .status(400)
        .json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      return;
    }
    const filtered = AUDIT_EVENTS.filter((e) => e.category === category);
    res.json(filtered);
    return;
  }

  res.json(AUDIT_EVENTS);
});

auditRouter.get('/notifications', (_req, res) => {
  res.json(notifications);
});

auditRouter.patch('/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const idx = notifications.findIndex((n) => n.id === id);

  if (idx === -1) {
    res.status(404).json({ error: `Notification ${id} not found` });
    return;
  }

  notifications[idx] = { ...notifications[idx], read: true };
  res.json(notifications[idx]);
});
