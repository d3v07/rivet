/**
 * Zod schemas for MCP tool inputs and outputs
 * All external data is validated against these schemas before use
 */

import { z } from 'zod';

/**
 * Input schema for query_jira_backlog tool
 */
export const QueryJiraBacklogInputSchema = z.object({
  projectKey: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Must be a valid Jira project key (e.g., PROJ)')
    .describe('Jira project key (e.g., PROJ)'),
  statusFilter: z
    .enum(['Ready for Engineering', 'In Progress', 'Done', 'Backlog'])
    .optional()
    .describe('Filter by issue status'),
  maxResults: z.number().int().min(1).max(100).default(10).describe('Maximum results to return'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type QueryJiraBacklogInput = z.infer<typeof QueryJiraBacklogInputSchema>;

/**
 * Output schema for query_jira_backlog tool
 */
export const JiraIssueSchema = z.object({
  key: z.string().describe('Jira issue key'),
  summary: z.string().describe('Issue summary/title'),
  description: z.string().nullable().describe('Issue description'),
  status: z.string().describe('Current status'),
  priority: z.string().nullable().describe('Priority (High, Medium, Low)'),
  assignee: z.string().nullable().describe('Assignee name'),
  created: z.string().datetime().describe('Created timestamp'),
  updated: z.string().datetime().describe('Updated timestamp'),
});

export const QueryJiraBacklogOutputSchema = z.object({
  issues: z.array(JiraIssueSchema).describe('Array of sanitized Jira issues'),
  total: z.number().int().describe('Total matching issues'),
  sanitizationApplied: z.boolean().describe('Whether prompt injection sanitization was applied'),
});

export type QueryJiraBacklogOutput = z.infer<typeof QueryJiraBacklogOutputSchema>;

/**
 * Input schema for fetch_gcp_carbon_metrics tool
 */
export const FetchGcpCarbonInputSchema = z.object({
  projectId: z.string().min(1).describe('GCP project ID'),
  regions: z.array(z.string()).optional().describe('Specific regions to query (omit for all)'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type FetchGcpCarbonInput = z.infer<typeof FetchGcpCarbonInputSchema>;

/**
 * Output schema for fetch_gcp_carbon_metrics tool
 */
export const GcpRegionSchema = z.object({
  region: z.string().describe('GCP region (e.g., us-central1)'),
  location: z.string().describe('Human-readable location'),
  carbonIntensity: z.number().nonnegative().describe('gCO2eq/kWh'),
  carbonData: z.string().datetime().describe('Timestamp of carbon data'),
});

export const FetchGcpCarbonOutputSchema = z.object({
  regions: z.array(GcpRegionSchema).describe('Array of regions with carbon intensity'),
  lowestCarbonRegion: z
    .object({
      region: z.string(),
      carbonIntensity: z.number(),
    })
    .describe('Region with lowest carbon intensity'),
});

export type FetchGcpCarbonOutput = z.infer<typeof FetchGcpCarbonOutputSchema>;

/**
 * Input schema for get_compute_pricing tool
 */
export const GetComputePricingInputSchema = z.object({
  projectId: z.string().min(1).describe('GCP project ID'),
  machineTypes: z.array(z.string()).optional().describe('Machine types to query'),
  regions: z.array(z.string()).optional().describe('Regions to query'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type GetComputePricingInput = z.infer<typeof GetComputePricingInputSchema>;

/**
 * Output schema for get_compute_pricing tool
 */
export const ComputePricingSchema = z.object({
  region: z.string().describe('GCP region'),
  machineType: z.string().describe('Machine type'),
  onDemandPerHour: z.number().nonnegative().describe('On-demand price per hour (USD)'),
  spotPerHour: z.number().nonnegative().nullable().describe('Spot price per hour (USD)'),
  currency: z.string().default('USD'),
  dataTimestamp: z.string().datetime(),
});

export const GetComputePricingOutputSchema = z.object({
  pricing: z.array(ComputePricingSchema),
  lowestCostOption: z
    .object({
      region: z.string(),
      machineType: z.string(),
      pricePerHour: z.number(),
      isSpot: z.boolean(),
    })
    .describe('Lowest-cost machine + region combination'),
});

export type GetComputePricingOutput = z.infer<typeof GetComputePricingOutputSchema>;

/**
 * Input schema for plan_issue tool
 */
export const PlanIssueInputSchema = z.object({
  issueKey: z.string().min(1).describe('Jira issue key (e.g., PROJ-123)'),
  summary: z.string().min(1).describe('Issue title'),
  description: z.string().optional().describe('Issue description'),
  status: z.string().optional().describe('Issue status'),
  priority: z.string().optional().describe('Priority (Critical, High, Medium, Low)'),
  assignee: z.string().nullable().optional().describe('Assigned person'),
  created: z.string().datetime().optional().describe('Created timestamp'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type PlanIssueInput = z.infer<typeof PlanIssueInputSchema>;

/**
 * Output schema for plan_issue tool
 */
export const ExecutionStepSchema = z.object({
  stepNumber: z.number().min(1).describe('Step sequence number'),
  action: z.string().describe('What to do in this step'),
  effort: z.enum(['small', 'medium', 'large']).describe('Effort estimate'),
  risk: z.enum(['low', 'medium', 'high']).describe('Risk level'),
  successCriteria: z.array(z.string()).describe('What success looks like'),
  blockedBy: z.array(z.string()).optional().describe('Dependencies or blockers'),
  estimatedTime: z.string().describe('Time estimate (e.g., 30 minutes)'),
});

export const ExecutionPlanSchema = z.object({
  planId: z.string().describe('Unique plan identifier'),
  issueKey: z.string().describe('Jira issue key'),
  title: z.string().describe('Plan title'),
  description: z.string().optional().describe('Full description'),
  steps: z.array(ExecutionStepSchema).describe('Ordered steps to execute'),
  totalEstimatedTime: z.string().describe('Total time estimate'),
  riskSummary: z.string().describe('Overall risk assessment'),
  blockersSummary: z.string().optional().describe('Identified blockers'),
  dependencies: z.array(z.string()).optional().describe('Other issues this depends on'),
});

export const PlanIssueOutputSchema = z.object({
  plan: ExecutionPlanSchema.describe('Detailed execution plan'),
});

export type PlanIssueOutput = z.infer<typeof PlanIssueOutputSchema>;

/**
 * Input schema for execute_plan tool
 */
export const ExecutePlanInputSchema = z.object({
  plan: ExecutionPlanSchema.describe('Execution plan to execute'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type ExecutePlanInput = z.infer<typeof ExecutePlanInputSchema>;

/**
 * Output schema for execute_plan tool
 */
export const StepExecutionResultSchema = z.object({
  stepNumber: z.number().describe('Step number'),
  status: z.enum(['success', 'failed', 'blocked']).describe('Step status'),
  action: z.string().describe('What was performed'),
  result: z.string().describe('Step result/output'),
  filesModified: z.array(z.string()).describe('Files changed'),
  testsPassedCount: z.number().optional().describe('Number of tests passed'),
  coveragePercent: z.number().optional().describe('Code coverage percentage'),
  errorMessage: z.string().optional().describe('Error message if failed'),
  duration: z.number().describe('Duration in milliseconds'),
});

export const DeveloperProgressSchema = z.object({
  planId: z.string().describe('Plan ID'),
  issueKey: z.string().describe('Jira issue key'),
  status: z.enum(['started', 'in_progress', 'completed', 'failed']).describe('Overall status'),
  completedSteps: z.number().describe('Steps completed successfully'),
  totalSteps: z.number().describe('Total steps in plan'),
  results: z.array(StepExecutionResultSchema).describe('Results for each step'),
  overallStatus: z.string().describe('Overall status message'),
  startedAt: z.string().datetime().describe('Execution start time'),
  completedAt: z.string().datetime().optional().describe('Execution end time'),
  totalDuration: z.number().optional().describe('Total duration in milliseconds'),
});

export const ExecutePlanOutputSchema = z.object({
  progress: DeveloperProgressSchema.describe('Execution progress and results'),
});

export type ExecutePlanOutput = z.infer<typeof ExecutePlanOutputSchema>;

/**
 * Input schema for review_code tool
 */
export const CodeFileSchema = z.object({
  path: z.string().describe('File path'),
  content: z.string().describe('File content/source code'),
});

export const ReviewCodeInputSchema = z.object({
  issueKey: z.string().min(1).describe('Jira issue key'),
  files: z.array(CodeFileSchema).describe('Code files to review'),
  correlationId: z.string().uuid().describe('Correlation ID for tracing'),
});

export type ReviewCodeInput = z.infer<typeof ReviewCodeInputSchema>;

/**
 * Output schema for review_code tool
 */
export const SecurityFindingSchema = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).describe('Severity level'),
  category: z
    .enum([
      'SQL_INJECTION',
      'XSS',
      'AUTH',
      'SECRETS',
      'VALIDATION',
      'LOGGING',
      'DEPENDENCY',
      'OTHER',
    ])
    .describe('Vulnerability category'),
  location: z.string().describe('File path where issue found'),
  issue: z.string().describe('Description of the issue'),
  recommendation: z.string().describe('How to fix it'),
  reference: z.string().optional().describe('Reference link (e.g., OWASP)'),
});

export const SecurityReviewSchema = z.object({
  reviewId: z.string().describe('Unique review ID'),
  issueKey: z.string().describe('Jira issue key'),
  timestamp: z.string().datetime().describe('Review timestamp'),
  overallSeverity: z
    .enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASS'])
    .describe('Overall severity'),
  findings: z.array(SecurityFindingSchema).describe('All findings'),
  summary: z.string().describe('Human-readable summary'),
  blocksDeployment: z.boolean().describe('Whether deployment is blocked'),
});

export const ReviewCodeOutputSchema = z.object({
  review: SecurityReviewSchema.describe('Security review results'),
});

export type ReviewCodeOutput = z.infer<typeof ReviewCodeOutputSchema>;
