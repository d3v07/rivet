/**
 * Jira REST API v3 client
 * Handles authentication and API calls to Jira Cloud instances
 */

import axios, { AxiosInstance } from 'axios';
import { logInfo, logError, createCorrelationId } from '@/lib/logger';
import type { JiraIssue } from '@/types/index';

export class JiraClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, email: string, apiToken: string) {
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Rivet/1.0',
      },
      timeout: 30000,
    });
  }

  /**
   * Fetch issues by JQL query
   */
  async fetchIssues(
    jql: string,
    maxResults: number = 10,
    correlationId: string = createCorrelationId()
  ): Promise<JiraIssue[]> {
    try {
      logInfo('Fetching Jira issues', {
        correlationId,
        jql,
        maxResults,
      });

      const response = await this.client.get('/rest/api/3/search', {
        params: {
          jql,
          maxResults,
          fields: [
            'key',
            'summary',
            'description',
            'status',
            'priority',
            'assignee',
            'created',
            'updated',
          ],
        },
      });

      const issues: JiraIssue[] = response.data.issues.map((issue: Record<string, unknown>) => {
        const fields = issue.fields as Record<string, unknown>;
        return {
          key: String(issue.key),
          summary: String(fields?.summary || ''),
          description: fields?.description ? String(fields.description) : null,
          status: String((fields?.status as Record<string, unknown>)?.name || 'Unknown'),
          priority: (fields?.priority as Record<string, unknown>)?.name
            ? String((fields.priority as Record<string, unknown>).name)
            : null,
          assignee: (fields?.assignee as Record<string, unknown>)?.displayName
            ? String((fields.assignee as Record<string, unknown>).displayName)
            : null,
          created: String(fields?.created || ''),
          updated: String(fields?.updated || ''),
        };
      });

      logInfo('Successfully fetched Jira issues', {
        correlationId,
        count: issues.length,
      });

      return issues;
    } catch (error) {
      logError('Failed to fetch Jira issues', { correlationId, jql }, error as Error);
      throw error;
    }
  }

  /**
   * Fetch issues by project key and status
   */
  async fetchIssuesByProject(
    projectKey: string,
    status?: string,
    maxResults: number = 10,
    correlationId: string = createCorrelationId()
  ): Promise<JiraIssue[]> {
    let jql = `project = ${projectKey}`;

    if (status) {
      jql += ` AND status = "${status}"`;
    }

    return this.fetchIssues(jql, maxResults, correlationId);
  }
}
