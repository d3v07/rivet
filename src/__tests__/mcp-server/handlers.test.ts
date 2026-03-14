import { describe, it, expect, vi } from 'vitest';
import { TOOL_DEFINITIONS, handleToolCall } from '@/mcp-server/handlers';

vi.mock('@/mcp-server/tools/query-jira-backlog', () => ({
  executeQueryJiraBacklog: vi.fn().mockResolvedValue({ issues: [], total: 0 }),
}));
vi.mock('@/mcp-server/tools/fetch-gcp-carbon', () => ({
  executeFetchGcpCarbon: vi.fn().mockResolvedValue({ regions: [] }),
}));
vi.mock('@/mcp-server/tools/get-compute-pricing', () => ({
  executeGetComputePricing: vi.fn().mockResolvedValue({ pricing: [] }),
}));
vi.mock('@/mcp-server/tools/plan-issue', () => ({
  executePlanIssue: vi.fn().mockResolvedValue({ planId: 'test', steps: [] }),
}));
vi.mock('@/mcp-server/tools/execute-plan', () => ({
  executeExecutePlan: vi.fn().mockResolvedValue({ status: 'complete' }),
}));
vi.mock('@/mcp-server/tools/review-code', () => ({
  executeReviewCode: vi.fn().mockResolvedValue({ findings: [] }),
}));

describe('MCP Handlers', () => {
  describe('TOOL_DEFINITIONS', () => {
    it('should define 6 tools', () => {
      expect(TOOL_DEFINITIONS).toHaveLength(6);
    });

    it('should have required names', () => {
      const names = TOOL_DEFINITIONS.map((t) => t.name);
      expect(names).toContain('query_jira_backlog');
      expect(names).toContain('plan_issue');
      expect(names).toContain('execute_plan');
      expect(names).toContain('review_code');
      expect(names).toContain('fetch_gcp_carbon_metrics');
      expect(names).toContain('get_compute_pricing');
    });

    it('should have inputSchema on all tools', () => {
      TOOL_DEFINITIONS.forEach((tool) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      });
    });
  });

  describe('handleToolCall', () => {
    it('should route query_jira_backlog', async () => {
      const result = await handleToolCall('query_jira_backlog', { projectKey: 'PROJ' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual({ issues: [], total: 0 });
    });

    it('should route plan_issue', async () => {
      const result = await handleToolCall('plan_issue', { issueKey: 'PROJ-1', summary: 'Test' });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toHaveProperty('planId');
    });

    it('should route execute_plan', async () => {
      const result = await handleToolCall('execute_plan', { plan: {} });
      expect(result.isError).toBeUndefined();
    });

    it('should route review_code', async () => {
      const result = await handleToolCall('review_code', { issueKey: 'PROJ-1', files: [] });
      expect(result.isError).toBeUndefined();
    });

    it('should route fetch_gcp_carbon_metrics', async () => {
      const result = await handleToolCall('fetch_gcp_carbon_metrics', { projectId: 'test' });
      expect(result.isError).toBeUndefined();
    });

    it('should route get_compute_pricing', async () => {
      const result = await handleToolCall('get_compute_pricing', { projectId: 'test' });
      expect(result.isError).toBeUndefined();
    });

    it('should return error for unknown tool', async () => {
      const result = await handleToolCall('nonexistent_tool');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle executor errors gracefully', async () => {
      const { executeQueryJiraBacklog } = await import('@/mcp-server/tools/query-jira-backlog');
      vi.mocked(executeQueryJiraBacklog).mockRejectedValueOnce(new Error('API timeout'));

      const result = await handleToolCall('query_jira_backlog', { projectKey: 'PROJ' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API timeout');
    });
  });
});
