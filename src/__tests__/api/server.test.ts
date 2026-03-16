import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

vi.mock('@/lib/claude-client', () => ({
  getActiveProvider: vi.fn(() => 'gemini'),
}));

vi.mock('@/lib/token-tracker', () => ({
  getAggregatedMetrics: vi.fn(() => ({
    totalInvocations: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    avgLatencyMs: 0,
    byTool: {},
  })),
}));

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  createCorrelationId: vi.fn(() => 'test-corr-id'),
}));

vi.mock('@/api/websocket', () => ({
  setupWebSocket: vi.fn(() => ({})),
}));

vi.mock('@/mcp-server/tools/query-jira-backlog', () => ({
  executeQueryJiraBacklog: vi.fn(),
}));

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('@/api/server');
  app = createApp();
});

describe('createApp', () => {
  it('returns a valid Express app with listen capability', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('responds to registered routes', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/health', () => {
  it('returns status ok with expected shape', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version: expect.any(String),
      uptime: expect.any(Number),
      llmProvider: expect.any(String),
      llmAvailable: expect.any(Boolean),
      tokenMetrics: {
        totalInvocations: expect.any(Number),
        totalInputTokens: expect.any(Number),
        totalOutputTokens: expect.any(Number),
      },
      environment: {
        nodeVersion: expect.any(String),
        platform: expect.any(String),
      },
    });
  });
});

describe('GET /api/pipelines', () => {
  it('returns paginated array of pipelines', async () => {
    const res = await request(app).get('/api/pipelines');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it('each pipeline has the expected shape', async () => {
    const res = await request(app).get('/api/pipelines');
    const pipeline = res.body.data[0];

    expect(pipeline).toMatchObject({
      issueKey: expect.any(String),
      summary: expect.any(String),
      priority: expect.stringMatching(/^(highest|high|medium|low)$/),
      status: expect.stringMatching(/^(success|failed|blocked)$/),
      stages: expect.any(Array),
      totalDurationMs: expect.any(Number),
      totalTokens: expect.any(Number),
    });
  });

  it('filters by status query param', async () => {
    const res = await request(app).get('/api/pipelines?status=blocked');

    expect(res.status).toBe(200);
    for (const p of res.body.data) {
      expect(p.status).toBe('blocked');
    }
  });

  it('filters by priority query param', async () => {
    const res = await request(app).get('/api/pipelines?priority=highest');

    expect(res.status).toBe(200);
    for (const p of res.body.data) {
      expect(p.priority).toBe('highest');
    }
  });

  it('respects pagination params', async () => {
    const res = await request(app).get('/api/pipelines?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.page).toBe(1);
  });
});

describe('GET /api/pipelines/:issueKey', () => {
  it('returns a pipeline for a known issue key', async () => {
    const res = await request(app).get('/api/pipelines/DEV-7');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      issueKey: 'DEV-7',
      summary: expect.any(String),
      stages: expect.any(Array),
    });
  });

  it('returns 404 for unknown issue key', async () => {
    const res = await request(app).get('/api/pipelines/NONEXISTENT-999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/backlog', () => {
  it('returns array of backlog items with mock flag', async () => {
    const res = await request(app).get('/api/backlog');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('each backlog item has JiraBacklogItem shape', async () => {
    const res = await request(app).get('/api/backlog');
    const item = res.body.data[0];

    expect(item).toMatchObject({
      issueKey: expect.any(String),
      summary: expect.any(String),
      priority: expect.stringMatching(/^(highest|high|medium|low)$/),
      status: expect.stringMatching(/^(todo|in_progress|done)$/),
      assignee: expect.any(String),
      storyPoints: expect.any(Number),
      labels: expect.any(Array),
      createdAt: expect.any(String),
    });
  });

  it('filters by status query param', async () => {
    const res = await request(app).get('/api/backlog?status=done');

    expect(res.status).toBe(200);
    for (const item of res.body.data) {
      expect(item.status).toBe('done');
    }
  });
});

describe('GET /api/security/findings', () => {
  it('returns array of security findings', async () => {
    const res = await request(app).get('/api/security/findings');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each finding has the expected shape', async () => {
    const res = await request(app).get('/api/security/findings');
    const finding = res.body[0];

    expect(finding).toMatchObject({
      severity: expect.stringMatching(/^(CRITICAL|HIGH|MEDIUM|LOW|PASS)$/),
      category: expect.stringMatching(/^(SECRETS|XSS|SQL_INJECTION|AUTH|PROMPT_INJECTION)$/),
      location: expect.any(String),
      issue: expect.any(String),
      recommendation: expect.any(String),
      issueKey: expect.any(String),
    });
  });

  it('filters by severity', async () => {
    const res = await request(app).get('/api/security/findings?severity=CRITICAL');

    expect(res.status).toBe(200);
    for (const f of res.body) {
      expect(f.severity).toBe('CRITICAL');
    }
  });

  it('rejects invalid severity', async () => {
    const res = await request(app).get('/api/security/findings?severity=INVALID');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/security/findings?category=XSS');

    expect(res.status).toBe(200);
    for (const f of res.body) {
      expect(f.category).toBe('XSS');
    }
  });
});

describe('GET /api/security/findings/:issueKey', () => {
  it('returns findings for a specific issue key', async () => {
    const res = await request(app).get('/api/security/findings/RIV-101');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const f of res.body) {
      expect(f.issueKey).toBe('RIV-101');
    }
  });

  it('returns empty array for unknown issue key', async () => {
    const res = await request(app).get('/api/security/findings/NONE-999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/pbom', () => {
  it('returns array of PBOMs', async () => {
    const res = await request(app).get('/api/pbom');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('each PBOM has the expected shape', async () => {
    const res = await request(app).get('/api/pbom');
    const pbom = res.body.data[0];

    expect(pbom).toMatchObject({
      version: expect.any(String),
      pipelineId: expect.any(String),
      correlationId: expect.any(String),
      generatedAt: expect.any(String),
      trigger: { type: expect.any(String), issueKey: expect.any(String) },
      agents: expect.any(Array),
      tools: expect.any(Array),
      tokenMetrics: expect.objectContaining({
        totalInputTokens: expect.any(Number),
        totalOutputTokens: expect.any(Number),
      }),
      stages: expect.any(Array),
      totalDurationMs: expect.any(Number),
      overallStatus: expect.any(String),
    });
  });
});

describe('GET /api/pbom/:pipelineId', () => {
  it('returns a specific PBOM by pipeline ID', async () => {
    const res = await request(app).get('/api/pbom/pipeline-001');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.pipelineId).toBe('pipeline-001');
  });

  it('returns 404 for unknown pipeline ID', async () => {
    const res = await request(app).get('/api/pbom/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/carbon/regions', () => {
  it('returns array of GCP regions', async () => {
    const res = await request(app).get('/api/carbon/regions');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each region has the expected shape', async () => {
    const res = await request(app).get('/api/carbon/regions');
    const region = res.body[0];

    expect(region).toMatchObject({
      region: expect.any(String),
      displayName: expect.any(String),
      lat: expect.any(Number),
      lng: expect.any(Number),
      carbonIntensity: expect.any(Number),
      costPerHour: expect.any(Number),
      available: expect.any(Boolean),
    });
  });
});

describe('GET /api/analytics/tokens', () => {
  it('returns token metrics shape', async () => {
    const res = await request(app).get('/api/analytics/tokens');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalInvocations: expect.any(Number),
      totalInputTokens: expect.any(Number),
      totalOutputTokens: expect.any(Number),
      avgLatencyMs: expect.any(Number),
      byTool: expect.any(Object),
    });
  });
});

describe('GET /api/pricing', () => {
  it('returns array of machine types', async () => {
    const res = await request(app).get('/api/pricing');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each machine type has the expected shape', async () => {
    const res = await request(app).get('/api/pricing');
    const machine = res.body[0];

    expect(machine).toMatchObject({
      name: expect.any(String),
      vcpus: expect.any(Number),
      memoryGb: expect.any(Number),
      costPerHour: expect.any(Object),
    });
  });

  it('costPerHour contains region-keyed prices', async () => {
    const res = await request(app).get('/api/pricing');
    const machine = res.body[0];
    const regions = Object.keys(machine.costPerHour);

    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect(typeof machine.costPerHour[region]).toBe('number');
    }
  });
});

describe('unknown routes', () => {
  it('returns 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
  });
});
