/**
 * MCP tool: get_compute_pricing
 * Fetches GCP compute pricing for specified machine types and regions
 */

import { GcpClient } from '@/mcp-server/clients/gcp';
import { cleanExternalData } from '@/lib/sanitize';
import { recordInvocation, estimateTokens } from '@/lib/token-tracker';
import {
  GetComputePricingInputSchema,
  GetComputePricingOutputSchema,
  type GetComputePricingOutput,
} from '@/mcp-server/schemas';
import { createCorrelationId, logInfo } from '@/lib/logger';

export async function executeGetComputePricing(input: unknown): Promise<GetComputePricingOutput> {
  const startTime = Date.now();
  const correlationId =
    ((input as Record<string, unknown>)?.correlationId as string) || createCorrelationId();

  try {
    // Validate input
    const validatedInput = GetComputePricingInputSchema.parse(input);

    // Initialize GCP client
    const gcpClient = new GcpClient(validatedInput.projectId);

    // Fetch pricing data
    const pricing = await gcpClient.fetchComputePricing(
      validatedInput.machineTypes,
      validatedInput.regions,
      correlationId
    );

    // Sanitize and clean the response
    const cleaned = cleanExternalData(pricing);

    // Find lowest cost option (prefer spot pricing)
    let lowestCostOption = null;
    if (pricing.length > 0) {
      const withCost = pricing.map((p) => ({
        ...p,
        effectivePrice: p.spotPerHour ?? p.onDemandPerHour,
        isSpot: p.spotPerHour !== null,
      }));

      const lowest = withCost.reduce((lowest, current) =>
        current.effectivePrice < lowest.effectivePrice ? current : lowest
      );

      lowestCostOption = {
        region: lowest.region,
        machineType: lowest.machineType,
        pricePerHour: lowest.effectivePrice,
        isSpot: lowest.isSpot,
      };
    }

    logInfo('get_compute_pricing executed', {
      correlationId,
      pricingCount: pricing.length,
      lowestCost: lowestCostOption?.pricePerHour,
      bytesRemoved: cleaned.bytesRemoved,
    });

    // Record token usage
    const inputTokens = estimateTokens(JSON.stringify(validatedInput));
    const outputTokens = estimateTokens(JSON.stringify(cleaned.data));
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'get_compute_pricing',
      inputTokens,
      outputTokens,
      latencyMs,
      timestamp: new Date().toISOString(),
      correlationId,
      status: 'success',
    });

    const output = GetComputePricingOutputSchema.parse({
      pricing: cleaned.data,
      lowestCostOption,
    });

    return output;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    recordInvocation({
      toolName: 'get_compute_pricing',
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
