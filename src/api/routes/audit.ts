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
  { id: 'ae-001', timestamp: '2026-03-15T09:12:00Z', action: 'pipeline.triggered', actor: 'PlannerAgent', target: 'pipeline-auth-service-47', details: 'Sprint 2 backlog item RIV-31 queued for execution', category: 'pipeline' },
  { id: 'ae-002', timestamp: '2026-03-15T09:14:22Z', action: 'security.scan.started', actor: 'SecurityAgent', target: 'auth-service/src', details: 'SAST scan initiated on 14 files', category: 'security' },
  { id: 'ae-003', timestamp: '2026-03-15T09:15:10Z', action: 'security.vulnerability.found', actor: 'SecurityAgent', target: 'auth-service/src/token.ts', details: 'High severity: JWT secret loaded from env without validation', category: 'security' },
  { id: 'ae-004', timestamp: '2026-03-15T09:18:45Z', action: 'pipeline.stage.completed', actor: 'DeveloperAgent', target: 'pipeline-auth-service-47', details: 'Code generation stage completed in 42s', category: 'pipeline' },
  { id: 'ae-005', timestamp: '2026-03-15T09:22:00Z', action: 'config.updated', actor: 'd3v07', target: '.gitlab-ci.yml', details: 'Added DAST stage to deployment pipeline', category: 'config' },
  { id: 'ae-006', timestamp: '2026-03-15T09:30:15Z', action: 'deployment.approved', actor: 'd3v07', target: 'auth-service-v1.2.0', details: 'Manual approval for staging deployment', category: 'deployment' },
  { id: 'ae-007', timestamp: '2026-03-15T09:32:00Z', action: 'deployment.started', actor: 'DeployerAgent', target: 'us-central1/staging', details: 'Rolling deployment to 2 instances', category: 'deployment' },
  { id: 'ae-008', timestamp: '2026-03-15T09:35:44Z', action: 'deployment.completed', actor: 'DeployerAgent', target: 'us-central1/staging', details: 'Health checks passed, all instances healthy', category: 'deployment' },
  { id: 'ae-009', timestamp: '2026-03-15T09:40:00Z', action: 'user.permission.changed', actor: 'd3v07', target: 'SecurityAgent', details: 'Granted write access to PBOM registry', category: 'user' },
  { id: 'ae-010', timestamp: '2026-03-15T09:45:30Z', action: 'pipeline.failed', actor: 'DeveloperAgent', target: 'pipeline-payment-svc-12', details: 'Unit tests failed: 3 assertions in billing.test.ts', category: 'pipeline' },
];

const notifications: Notification[] = [
  { id: 'n-001', title: 'Deployment Succeeded', message: 'auth-service v1.2.0 deployed to staging (us-central1)', type: 'deploy', time: '2026-03-15T09:35:44Z', read: false },
  { id: 'n-002', title: 'Vulnerability Detected', message: 'High severity issue in auth-service/src/token.ts — JWT secret validation missing', type: 'security', time: '2026-03-15T09:15:10Z', read: false },
  { id: 'n-003', title: 'Pipeline Failed', message: 'pipeline-payment-svc-12 failed at unit test stage. 3 assertions in billing.test.ts', type: 'failed', time: '2026-03-15T09:45:30Z', read: false },
  { id: 'n-004', title: 'PBOM Updated', message: 'Pipeline Bill of Materials generated for auth-service with 23 dependencies', type: 'info', time: '2026-03-15T09:20:00Z', read: true },
  { id: 'n-005', title: 'Carbon Report Ready', message: 'Green Agents metrics: 12.4g CO2e saved by selecting us-central1 over us-east1', type: 'info', time: '2026-03-15T09:38:00Z', read: true },
  { id: 'n-006', title: 'Security Scan Complete', message: 'SAST scan finished on auth-service: 1 high, 0 medium, 2 low findings', type: 'security', time: '2026-03-15T09:16:00Z', read: false },
  { id: 'n-007', title: 'Staging Deploy Queued', message: 'payment-service v0.8.1 awaiting manual approval for staging', type: 'deploy', time: '2026-03-15T09:50:00Z', read: false },
];

export const auditRouter = Router();

auditRouter.get('/', (req, res) => {
  const { category } = req.query;

  if (category && typeof category === 'string') {
    const validCategories = ['pipeline', 'security', 'deployment', 'config', 'user'] as const;
    if (!validCategories.includes(category as (typeof validCategories)[number])) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      return;
    }
    const filtered = AUDIT_EVENTS.filter(e => e.category === category);
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
  const idx = notifications.findIndex(n => n.id === id);

  if (idx === -1) {
    res.status(404).json({ error: `Notification ${id} not found` });
    return;
  }

  notifications[idx] = { ...notifications[idx], read: true };
  res.json(notifications[idx]);
});
