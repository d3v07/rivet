import { describe, it, expect, beforeEach } from 'vitest'
import { executeQueryJiraBacklog } from '@/mcp-server/tools/query-jira-backlog'
import { executeFetchGcpCarbon } from '@/mcp-server/tools/fetch-gcp-carbon'
import { executeGetComputePricing } from '@/mcp-server/tools/get-compute-pricing'
import { clearInvocations, getInvocations } from '@/lib/token-tracker'
import { v4 as uuidv4 } from 'uuid'

const correlationId = uuidv4()

describe('MCP Tools', () => {
  beforeEach(() => {
    clearInvocations()
  })

  describe('query_jira_backlog', () => {
    it('should return mock issues when credentials not configured', async () => {
      const result = await executeQueryJiraBacklog({
        projectKey: 'TEST',
        maxResults: 10,
        correlationId,
      })

      expect(result).toBeDefined()
      expect(result.issues).toHaveLength(2)
      expect(result.issues[0].key).toBe('PROJ-1')
      expect(result.total).toBe(2)
    })

    it('should validate input schema', async () => {
      expect(
        executeQueryJiraBacklog({
          projectKey: '', // Invalid: empty
          correlationId,
        })
      ).rejects.toThrow()
    })

    it('should record token usage', async () => {
      await executeQueryJiraBacklog({
        projectKey: 'TEST',
        maxResults: 10,
        correlationId,
      })

      const invocations = getInvocations()
      expect(invocations).toHaveLength(1)
      expect(invocations[0].toolName).toBe('query_jira_backlog')
      expect(invocations[0].status).toBe('success')
      expect(invocations[0].inputTokens).toBeGreaterThan(0)
      expect(invocations[0].outputTokens).toBeGreaterThan(0)
    })
  })

  describe('fetch_gcp_carbon_metrics', () => {
    it('should return carbon metrics', async () => {
      const result = await executeFetchGcpCarbon({
        projectId: 'test-project',
        correlationId,
      })

      expect(result).toBeDefined()
      expect(result.regions).toHaveLength(5)
      expect(result.lowestCarbonRegion).toBeDefined()
      expect(result.lowestCarbonRegion?.region).toBe('europe-west1')
    })

    it('should filter by region', async () => {
      const result = await executeFetchGcpCarbon({
        projectId: 'test-project',
        regions: ['us-central1', 'us-west1'],
        correlationId,
      })

      expect(result.regions.length).toBeLessThanOrEqual(2)
      const regions = result.regions.map((r) => r.region)
      expect(regions).toContain('us-central1')
    })

    it('should record token usage', async () => {
      await executeFetchGcpCarbon({
        projectId: 'test-project',
        correlationId,
      })

      const invocations = getInvocations()
      expect(invocations).toHaveLength(1)
      expect(invocations[0].toolName).toBe('fetch_gcp_carbon_metrics')
      expect(invocations[0].status).toBe('success')
    })
  })

  describe('get_compute_pricing', () => {
    it('should return compute pricing', async () => {
      const result = await executeGetComputePricing({
        projectId: 'test-project',
        correlationId,
      })

      expect(result).toBeDefined()
      expect(result.pricing.length).toBeGreaterThan(0)
      expect(result.lowestCostOption).toBeDefined()
    })

    it('should find lowest cost option with spot pricing', async () => {
      const result = await executeGetComputePricing({
        projectId: 'test-project',
        correlationId,
      })

      const lowest = result.lowestCostOption
      expect(lowest).toBeDefined()
      if (lowest) {
        expect(lowest.pricePerHour).toBeGreaterThan(0)
        expect(lowest.region).toBeDefined()
        expect(lowest.machineType).toBeDefined()
      }
    })

    it('should record token usage', async () => {
      await executeGetComputePricing({
        projectId: 'test-project',
        correlationId,
      })

      const invocations = getInvocations()
      expect(invocations).toHaveLength(1)
      expect(invocations[0].toolName).toBe('get_compute_pricing')
      expect(invocations[0].status).toBe('success')
    })
  })
})
