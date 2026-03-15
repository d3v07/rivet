import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JiraClient } from '@/mcp-server/clients/jira';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

describe('JiraClient', () => {
  describe('constructor', () => {
    it('should create client with auth headers', async () => {
      const axios = await import('axios');
      new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://jira.example.com',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('fetchIssues', () => {
    let client: JiraClient;
    let mockGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const axios = await import('axios');
      mockGet = vi.fn();
      vi.mocked(axios.default.create).mockReturnValue({ get: mockGet } as unknown as ReturnType<
        typeof axios.default.create
      >);
      client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');
    });

    it('should fetch and map Jira issues', async () => {
      mockGet.mockResolvedValue({
        data: {
          issues: [
            {
              key: 'PROJ-1',
              fields: {
                summary: 'Test issue',
                description: 'A test description',
                status: { name: 'Open' },
                priority: { name: 'High' },
                assignee: { displayName: 'Dev' },
                created: '2026-03-14T00:00:00Z',
                updated: '2026-03-14T00:00:00Z',
              },
            },
          ],
        },
      });

      const issues = await client.fetchIssues('project = "PROJ"', 10, 'test-corr');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        key: 'PROJ-1',
        summary: 'Test issue',
        description: 'A test description',
        status: 'Open',
        priority: 'High',
        assignee: 'Dev',
        created: '2026-03-14T00:00:00Z',
        updated: '2026-03-14T00:00:00Z',
      });
    });

    it('should handle null fields gracefully', async () => {
      mockGet.mockResolvedValue({
        data: {
          issues: [
            {
              key: 'PROJ-2',
              fields: {
                summary: 'Minimal issue',
                description: null,
                status: { name: 'Backlog' },
                priority: null,
                assignee: null,
                created: '2026-03-14',
                updated: '2026-03-14',
              },
            },
          ],
        },
      });

      const issues = await client.fetchIssues('project = "PROJ"');

      expect(issues[0].description).toBeNull();
      expect(issues[0].priority).toBeNull();
      expect(issues[0].assignee).toBeNull();
    });

    it('should pass correct params to Jira API', async () => {
      mockGet.mockResolvedValue({ data: { issues: [] } });

      await client.fetchIssues('project = "TEST"', 25, 'corr-123');

      expect(mockGet).toHaveBeenCalledWith('/rest/api/3/search/jql', {
        params: expect.objectContaining({
          jql: 'project = "TEST"',
          maxResults: 25,
        }),
      });
    });

    it('should propagate API errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(client.fetchIssues('project = "PROJ"')).rejects.toThrow('Network error');
    });
  });

  describe('fetchIssuesByProject', () => {
    let client: JiraClient;
    let mockGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const axios = await import('axios');
      mockGet = vi.fn().mockResolvedValue({ data: { issues: [] } });
      vi.mocked(axios.default.create).mockReturnValue({ get: mockGet } as unknown as ReturnType<
        typeof axios.default.create
      >);
      client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');
    });

    it('should reject invalid project keys (JQL injection prevention)', async () => {
      await expect(client.fetchIssuesByProject('PROJ" OR 1=1 --')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should reject lowercase project keys', async () => {
      await expect(client.fetchIssuesByProject('proj')).rejects.toThrow('Invalid Jira project key');
    });

    it('should reject empty project keys', async () => {
      await expect(client.fetchIssuesByProject('')).rejects.toThrow('Invalid Jira project key');
    });

    it('should reject project keys with special characters', async () => {
      await expect(client.fetchIssuesByProject('PROJ;DROP')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should reject overly long project keys', async () => {
      await expect(client.fetchIssuesByProject('ABCDEFGHIJK')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should build JQL for valid project key', async () => {
      await client.fetchIssuesByProject('PROJ');

      expect(mockGet).toHaveBeenCalledWith('/rest/api/3/search/jql', {
        params: expect.objectContaining({
          jql: 'project = "PROJ"',
        }),
      });
    });

    it('should append status filter to JQL', async () => {
      await client.fetchIssuesByProject('PROJ', 'In Progress');

      expect(mockGet).toHaveBeenCalledWith('/rest/api/3/search/jql', {
        params: expect.objectContaining({
          jql: 'project = "PROJ" AND status = "In Progress"',
        }),
      });
    });

    it('should sanitize status with quotes', async () => {
      await client.fetchIssuesByProject('PROJ', 'Ready "for" Dev');

      expect(mockGet).toHaveBeenCalledWith('/rest/api/3/search/jql', {
        params: expect.objectContaining({
          jql: 'project = "PROJ" AND status = "Ready \\"for\\" Dev"',
        }),
      });
    });

    it('should accept valid project keys', () => {
      const validKeys = ['PROJ', 'AB', 'MYPROJECT', 'A1', 'TEST123'];

      validKeys.forEach((key) => {
        expect(/^[A-Z][A-Z0-9]{1,9}$/.test(key)).toBe(true);
      });
    });
  });
});
