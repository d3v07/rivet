export interface PBOMInput {
  readonly pipelineId: string
  readonly correlationId: string
  readonly trigger: { readonly type: string; readonly issueKey: string }
  readonly agents: ReadonlyArray<{
    readonly name: string
    readonly model: string
    readonly provider: string
  }>
  readonly tools: ReadonlyArray<{
    readonly name: string
    readonly invocations: number
    readonly totalTokens: number
  }>
  readonly tokenMetrics: {
    readonly totalInputTokens: number
    readonly totalOutputTokens: number
    readonly totalLatencyMs: number
  }
  readonly stages: ReadonlyArray<{
    readonly name: string
    readonly status: 'success' | 'failed'
    readonly durationMs: number
  }>
}

export interface PBOM {
  readonly version: string
  readonly pipelineId: string
  readonly correlationId: string
  readonly generatedAt: string
  readonly trigger: { readonly type: string; readonly issueKey: string }
  readonly agents: ReadonlyArray<{
    readonly name: string
    readonly model: string
    readonly provider: string
  }>
  readonly tools: ReadonlyArray<{
    readonly name: string
    readonly invocations: number
    readonly totalTokens: number
  }>
  readonly tokenMetrics: {
    readonly totalInputTokens: number
    readonly totalOutputTokens: number
    readonly totalLatencyMs: number
    readonly efficiency: number
  }
  readonly stages: ReadonlyArray<{
    readonly name: string
    readonly status: 'success' | 'failed'
    readonly durationMs: number
  }>
  readonly totalDurationMs: number
  readonly overallStatus: 'success' | 'failed'
  readonly environment: {
    readonly nodeVersion: string
    readonly platform: string
    readonly rivetVersion: string
  }
}

export function generatePBOM(input: PBOMInput): PBOM {
  const totalDurationMs = input.stages.reduce(
    (sum, stage) => sum + stage.durationMs,
    0
  )

  const overallStatus = input.stages.some((s) => s.status === 'failed')
    ? 'failed'
    : 'success'

  const efficiency =
    input.tokenMetrics.totalOutputTokens / input.tokenMetrics.totalInputTokens

  const pbom: PBOM = {
    version: '1.0.0',
    pipelineId: input.pipelineId,
    correlationId: input.correlationId,
    generatedAt: new Date().toISOString(),
    trigger: { ...input.trigger },
    agents: input.agents.map((a) => ({ ...a })),
    tools: input.tools.map((t) => ({ ...t })),
    tokenMetrics: {
      totalInputTokens: input.tokenMetrics.totalInputTokens,
      totalOutputTokens: input.tokenMetrics.totalOutputTokens,
      totalLatencyMs: input.tokenMetrics.totalLatencyMs,
      efficiency,
    },
    stages: input.stages.map((s) => ({ ...s })),
    totalDurationMs,
    overallStatus,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      rivetVersion: '0.1.0',
    },
  }

  return Object.freeze(pbom)
}
