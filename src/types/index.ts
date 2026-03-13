/**
 * TypeScript type definitions for Rivet
 */

/**
 * Jira issue representation used internally
 */
export interface JiraIssue {
  key: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee: string | null;
  created: string;
  updated: string;
}

/**
 * GCP region with carbon and pricing data
 */
export interface GcpRegion {
  region: string;
  location: string;
  carbonIntensity: number; // gCO2eq/kWh
  carbonData: string; // ISO timestamp of data freshness
}

/**
 * Compute pricing for a specific machine type and region
 */
export interface ComputePricing {
  region: string;
  machineType: string;
  onDemandPerHour: number; // USD
  spotPerHour: number | null; // USD, null if not available
  currency: string;
  dataTimestamp: string; // ISO timestamp
}

/**
 * Sanitization report
 */
export interface SanitizationReport {
  original: string;
  sanitized: string;
  patternsFound: string[];
  tokensRemoved: number;
}

/**
 * MCP Tool invocation metadata for token tracking
 */
export interface ToolInvocation {
  toolName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  timestamp: string;
  correlationId: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

/**
 * Single step in an execution plan
 */
export interface ExecutionStep {
  stepNumber: number;
  action: string;
  effort: 'small' | 'medium' | 'large';
  risk: 'low' | 'medium' | 'high';
  successCriteria: string[];
  blockedBy?: string[];
  estimatedTime: string;
}

/**
 * Structured execution plan for a Jira issue
 */
export interface ExecutionPlan {
  planId: string;
  issueKey: string;
  title: string;
  description?: string;
  steps: ExecutionStep[];
  totalEstimatedTime: string;
  riskSummary: string;
  blockersSummary?: string;
  dependencies?: string[];
}
