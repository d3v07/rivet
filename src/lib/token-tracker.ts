/**
 * Token tracking for Green Agents metrics
 * Logs per-agent input/output tokens for efficiency analysis
 */

import type { ToolInvocation } from '@/types/index'
import { logInfo } from '@/lib/logger'

const invocations: ToolInvocation[] = []

/**
 * Estimate token count for a string (rough approximation)
 * Uses 1 token ≈ 4 characters as a heuristic
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Record a tool invocation and its token usage
 */
export function recordInvocation(invocation: ToolInvocation): void {
  invocations.push(invocation)

  logInfo('Tool invoked', {
    correlationId: invocation.correlationId,
    toolName: invocation.toolName,
    inputTokens: invocation.inputTokens,
    outputTokens: invocation.outputTokens,
    latencyMs: invocation.latencyMs,
    status: invocation.status,
  })
}

/**
 * Get all recorded invocations
 */
export function getInvocations(): ToolInvocation[] {
  return [...invocations]
}

/**
 * Get aggregated metrics across all invocations
 */
export function getAggregatedMetrics(): {
  totalInvocations: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  byTool: Record<
    string,
    {
      count: number
      inputTokens: number
      outputTokens: number
      avgLatencyMs: number
    }
  >
} {
  const byTool: Record<
    string,
    {
      count: number
      inputTokens: number
      outputTokens: number
      avgLatencyMs: number
      totalLatency: number
    }
  > = {}

  for (const inv of invocations) {
    if (!byTool[inv.toolName]) {
      byTool[inv.toolName] = {
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        avgLatencyMs: 0,
        totalLatency: 0,
      }
    }

    const tool = byTool[inv.toolName]
    tool.count += 1
    tool.inputTokens += inv.inputTokens
    tool.outputTokens += inv.outputTokens
    tool.totalLatency += inv.latencyMs
  }

  // Calculate averages
  const toolMetrics: Record<
    string,
    {
      count: number
      inputTokens: number
      outputTokens: number
      avgLatencyMs: number
    }
  > = {}

  for (const [name, data] of Object.entries(byTool)) {
    toolMetrics[name] = {
      count: data.count,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      avgLatencyMs: data.totalLatency / data.count,
    }
  }

  const totalInputTokens = invocations.reduce((sum, inv) => sum + inv.inputTokens, 0)
  const totalOutputTokens = invocations.reduce((sum, inv) => sum + inv.outputTokens, 0)
  const avgLatency =
    invocations.length > 0
      ? invocations.reduce((sum, inv) => sum + inv.latencyMs, 0) / invocations.length
      : 0

  return {
    totalInvocations: invocations.length,
    totalInputTokens,
    totalOutputTokens,
    avgLatencyMs: avgLatency,
    byTool: toolMetrics,
  }
}

/**
 * Clear all tracked invocations (useful for testing)
 */
export function clearInvocations(): void {
  invocations.length = 0
}
