/**
 * MCP tool: fetch_gcp_carbon_metrics
 * Fetches GCP region carbon intensity data
 */

import { GcpClient } from '@/mcp-server/clients/gcp';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  FetchGcpCarbonInputSchema,
  FetchGcpCarbonOutputSchema,
  type FetchGcpCarbonOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';

export async function executeFetchGcpCarbon(input: unknown): Promise<FetchGcpCarbonOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    // Validate input
    const validatedInput = FetchGcpCarbonInputSchema.parse(input);

    // Initialize GCP client
    const gcpClient = new GcpClient(validatedInput.projectId);

    // Fetch carbon metrics
    const regions = await gcpClient.fetchCarbonMetrics(validatedInput.regions, correlationId);

    // Sanitize and clean the response
    const cleaned = cleanExternalData(regions);

    // Find lowest carbon region
    const lowestCarbonRegion =
      regions.length > 0
        ? regions.reduce((lowest, current) =>
            current.carbonIntensity < lowest.carbonIntensity ? current : lowest
          )
        : null;

    logInfo('fetch_gcp_carbon_metrics executed', {
      correlationId,
      regionCount: regions.length,
      lowestCarbon: lowestCarbonRegion?.region,
      bytesRemoved: cleaned.bytesRemoved,
    });

    // Record token usage
    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'fetch_gcp_carbon_metrics',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = FetchGcpCarbonOutputSchema.parse({
      regions: cleaned.data,
      lowestCarbonRegion: lowestCarbonRegion
        ? {
            region: lowestCarbonRegion.region,
            carbonIntensity: lowestCarbonRegion.carbonIntensity,
          }
        : null,
    });

    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'fetch_gcp_carbon_metrics',
      inputTokens: estimateTokens(JSON.stringify(input)),
      outputTokens: 0,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
