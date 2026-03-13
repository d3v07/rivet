import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateTokens,
  recordInvocation,
  getInvocations,
  getAggregatedMetrics,
  clearInvocations,
} from '@/lib/token-tracker'
import type { ToolInvocation } from '@/types/index'

describe('Token Tracker', () => {
  beforeEach(() => {
    clearInvocations()
  })

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'a'.repeat(400)
      const tokens = estimateTokens(text)
      expect(tokens).toBeCloseTo(100, -1) // Roughly 100 tokens (400 / 4)
    })

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('should round up for partial tokens', () => {
      const tokens = estimateTokens('abc')
      expect(tokens).toBeGreaterThanOrEqual(1)
    })
  })

  describe('recordInvocation', () => {
    it('should record tool invocations', () => {
      const invocation: ToolInvocation = {
        toolName: 'query_jira_backlog',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        timestamp: new Date().toISOString(),
        correlationId: '12345678-1234-1234-1234-123456789012',
        status: 'success',
      }

      recordInvocation(invocation)
      const invocations = getInvocations()

      expect(invocations).toHaveLength(1)
      expect(invocations[0].toolName).toBe('query_jira_backlog')
    })

    it('should record error status', () => {
      const invocation: ToolInvocation = {
        toolName: 'fetch_gcp_carbon_metrics',
        inputTokens: 50,
        outputTokens: 0,
        latencyMs: 100,
        timestamp: new Date().toISOString(),
        correlationId: '12345678-1234-1234-1234-123456789012',
        status: 'error',
        errorMessage: 'Connection timeout',
      }

      recordInvocation(invocation)
      expect(getInvocations()[0].status).toBe('error')
      expect(getInvocations()[0].errorMessage).toBe('Connection timeout')
    })
  })

  describe('getAggregatedMetrics', () => {
    it('should aggregate metrics across multiple invocations', () => {
      recordInvocation({
        toolName: 'query_jira_backlog',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        timestamp: new Date().toISOString(),
        correlationId: 'id1',
        status: 'success',
      })

      recordInvocation({
        toolName: 'query_jira_backlog',
        inputTokens: 150,
        outputTokens: 250,
        latencyMs: 600,
        timestamp: new Date().toISOString(),
        correlationId: 'id2',
        status: 'success',
      })

      const metrics = getAggregatedMetrics()

      expect(metrics.totalInvocations).toBe(2)
      expect(metrics.totalInputTokens).toBe(250)
      expect(metrics.totalOutputTokens).toBe(450)
      expect(metrics.byTool['query_jira_backlog'].count).toBe(2)
      expect(metrics.byTool['query_jira_backlog'].avgLatencyMs).toBeCloseTo(550, 0)
    })

    it('should separate metrics by tool name', () => {
      recordInvocation({
        toolName: 'query_jira_backlog',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        timestamp: new Date().toISOString(),
        correlationId: 'id1',
        status: 'success',
      })

      recordInvocation({
        toolName: 'fetch_gcp_carbon_metrics',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 200,
        timestamp: new Date().toISOString(),
        correlationId: 'id2',
        status: 'success',
      })

      const metrics = getAggregatedMetrics()

      expect(Object.keys(metrics.byTool)).toContain('query_jira_backlog')
      expect(Object.keys(metrics.byTool)).toContain('fetch_gcp_carbon_metrics')
    })

    it('should handle empty invocations', () => {
      const metrics = getAggregatedMetrics()

      expect(metrics.totalInvocations).toBe(0)
      expect(metrics.totalInputTokens).toBe(0)
      expect(metrics.avgLatencyMs).toBe(0)
    })
  })

  describe('clearInvocations', () => {
    it('should clear all recorded invocations', () => {
      recordInvocation({
        toolName: 'query_jira_backlog',
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        timestamp: new Date().toISOString(),
        correlationId: 'id1',
        status: 'success',
      })

      expect(getInvocations()).toHaveLength(1)

      clearInvocations()

      expect(getInvocations()).toHaveLength(0)
    })
  })
})
