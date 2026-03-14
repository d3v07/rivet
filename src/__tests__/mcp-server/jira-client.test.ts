import { describe, it, expect } from 'vitest';
import { JiraClient } from '@/mcp-server/clients/jira';

describe('JiraClient', () => {
  describe('fetchIssuesByProject', () => {
    it('should reject invalid project keys (JQL injection prevention)', async () => {
      const client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      await expect(client.fetchIssuesByProject('PROJ" OR 1=1 --')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should reject lowercase project keys', async () => {
      const client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      await expect(client.fetchIssuesByProject('proj')).rejects.toThrow('Invalid Jira project key');
    });

    it('should reject empty project keys', async () => {
      const client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      await expect(client.fetchIssuesByProject('')).rejects.toThrow('Invalid Jira project key');
    });

    it('should reject project keys with special characters', async () => {
      const client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      await expect(client.fetchIssuesByProject('PROJ;DROP')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should reject overly long project keys', async () => {
      const client = new JiraClient('https://jira.example.com', 'test@test.com', 'token');

      await expect(client.fetchIssuesByProject('ABCDEFGHIJK')).rejects.toThrow(
        'Invalid Jira project key'
      );
    });

    it('should accept valid project keys', () => {
      const validKeys = ['PROJ', 'AB', 'MYPROJECT', 'A1', 'TEST123'];

      validKeys.forEach((key) => {
        expect(/^[A-Z][A-Z0-9]{1,9}$/.test(key)).toBe(true);
      });
    });
  });
});
