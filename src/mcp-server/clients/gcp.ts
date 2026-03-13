/**
 * Google Cloud Platform client for carbon and pricing data
 * Queries BigQuery for carbon data and Billing API for pricing
 */

import { logInfo, createCorrelationId } from '@/lib/logger';
import type { GcpRegion, ComputePricing } from '@/types/index';

/**
 * Mock GCP client for hackathon (real implementation would use @google-cloud/bigquery)
 * This allows us to test without credentials during development
 */
export class GcpClient {
  constructor(private projectId: string) {}

  /**
   * Fetch carbon intensity metrics for GCP regions
   * Returns mock data for now; would query BigQuery carbon dataset in production
   */
  async fetchCarbonMetrics(
    regions?: string[],
    correlationId: string = createCorrelationId()
  ): Promise<GcpRegion[]> {
    logInfo('Fetching GCP carbon metrics', {
      correlationId,
      projectId: this.projectId,
      regions: regions || 'all',
    });

    // Mock carbon data (gCO2eq/kWh)
    const mockData: GcpRegion[] = [
      {
        region: 'us-central1',
        location: 'Iowa',
        carbonIntensity: 42,
        carbonData: new Date().toISOString(),
      },
      {
        region: 'us-west1',
        location: 'Oregon',
        carbonIntensity: 38,
        carbonData: new Date().toISOString(),
      },
      {
        region: 'us-east1',
        location: 'South Carolina',
        carbonIntensity: 67,
        carbonData: new Date().toISOString(),
      },
      {
        region: 'europe-west1',
        location: 'Belgium',
        carbonIntensity: 28,
        carbonData: new Date().toISOString(),
      },
      {
        region: 'asia-southeast1',
        location: 'Singapore',
        carbonIntensity: 142,
        carbonData: new Date().toISOString(),
      },
    ];

    let result = mockData;

    if (regions && regions.length > 0) {
      result = mockData.filter((r) => regions.includes(r.region));
    }

    logInfo('Successfully fetched carbon metrics', {
      correlationId,
      count: result.length,
    });

    return result;
  }

  /**
   * Fetch compute pricing for machine types and regions
   * Returns mock data for now; would query GCP Pricing API in production
   */
  async fetchComputePricing(
    machineTypes?: string[],
    regions?: string[],
    correlationId: string = createCorrelationId()
  ): Promise<ComputePricing[]> {
    logInfo('Fetching GCP compute pricing', {
      correlationId,
      projectId: this.projectId,
      machineTypes: machineTypes || 'all',
      regions: regions || 'all',
    });

    // Mock pricing data (USD/hour)
    const mockData: ComputePricing[] = [
      {
        region: 'us-central1',
        machineType: 'n2-standard-2',
        onDemandPerHour: 0.0945,
        spotPerHour: 0.0283,
        currency: 'USD',
        dataTimestamp: new Date().toISOString(),
      },
      {
        region: 'us-west1',
        machineType: 'n2-standard-2',
        onDemandPerHour: 0.104,
        spotPerHour: 0.0312,
        currency: 'USD',
        dataTimestamp: new Date().toISOString(),
      },
      {
        region: 'us-east1',
        machineType: 'n2-standard-2',
        onDemandPerHour: 0.104,
        spotPerHour: 0.0312,
        currency: 'USD',
        dataTimestamp: new Date().toISOString(),
      },
      {
        region: 'europe-west1',
        machineType: 'n2-standard-2',
        onDemandPerHour: 0.1155,
        spotPerHour: 0.0346,
        currency: 'USD',
        dataTimestamp: new Date().toISOString(),
      },
    ];

    let result = mockData;

    if (regions && regions.length > 0) {
      result = result.filter((r) => regions.includes(r.region));
    }

    if (machineTypes && machineTypes.length > 0) {
      result = result.filter((r) => machineTypes.includes(r.machineType));
    }

    logInfo('Successfully fetched compute pricing', {
      correlationId,
      count: result.length,
    });

    return result;
  }
}
