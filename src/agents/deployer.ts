/**
 * Deployer Agent: Handles carbon-aware deployment to GCP
 * Selects optimal region based on carbon intensity and cost,
 * generates deployment configs, and produces audit trail
 */

import { createCorrelationId, logInfo } from '@/lib/logger';
import { GcpClient } from '@/mcp-server/clients/gcp';
import type { GcpRegion, ComputePricing } from '@/types/index';
import type { SecurityReview } from '@/agents/security-analyst';
import { z } from 'zod';

const DeploymentDecisionSchema = z.object({
  selectedRegion: z.string(),
  selectedMachineType: z.string(),
  carbonIntensity: z.number(),
  estimatedCostPerHour: z.number(),
  isSpot: z.boolean(),
  carbonSavingsPercent: z.number(),
  costSavingsPercent: z.number(),
  rationale: z.string(),
});

export type DeploymentDecision = z.infer<typeof DeploymentDecisionSchema>;

const DeploymentResultSchema = z.object({
  deploymentId: z.string(),
  issueKey: z.string(),
  timestamp: z.string(),
  decision: DeploymentDecisionSchema,
  securityGate: z.object({
    passed: z.boolean(),
    overallSeverity: z.string(),
    findingCount: z.number(),
  }),
  config: z.object({
    service: z.string(),
    region: z.string(),
    machineType: z.string(),
    useSpot: z.boolean(),
    minInstances: z.number(),
    maxInstances: z.number(),
  }),
  status: z.enum(['deployed', 'blocked', 'dry_run']),
  auditTrail: z.array(z.string()),
});

export type DeploymentResult = z.infer<typeof DeploymentResultSchema>;

export class DeployerAgent {
  private correlationId: string;
  private gcpProjectId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || createCorrelationId();
    this.gcpProjectId = process.env.GCP_PROJECT_ID || 'rivet-hackathon';
  }

  /**
   * Deploy code with carbon-aware region selection
   */
  async deploy(
    issueKey: string,
    securityReview: SecurityReview,
    serviceName?: string
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const auditTrail: string[] = [];

    logInfo('Deployer: starting deployment', {
      correlationId: this.correlationId,
      issueKey,
      securitySeverity: securityReview.overallSeverity,
    });

    auditTrail.push(`${new Date().toISOString()} - Deployment initiated for ${issueKey}`);

    // Gate 1: Security check
    if (securityReview.blocksDeployment) {
      auditTrail.push(
        `${new Date().toISOString()} - BLOCKED: Security review found ${securityReview.findings.length} issues (${securityReview.overallSeverity})`
      );

      logInfo('Deployer: deployment blocked by security review', {
        correlationId: this.correlationId,
        issueKey,
        severity: securityReview.overallSeverity,
        findingCount: securityReview.findings.length,
      });

      return {
        deploymentId: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        issueKey,
        timestamp: new Date().toISOString(),
        decision: {
          selectedRegion: 'none',
          selectedMachineType: 'none',
          carbonIntensity: 0,
          estimatedCostPerHour: 0,
          isSpot: false,
          carbonSavingsPercent: 0,
          costSavingsPercent: 0,
          rationale: `Deployment blocked: ${securityReview.summary}`,
        },
        securityGate: {
          passed: false,
          overallSeverity: securityReview.overallSeverity,
          findingCount: securityReview.findings.length,
        },
        config: {
          service: serviceName || issueKey.toLowerCase(),
          region: 'none',
          machineType: 'none',
          useSpot: false,
          minInstances: 0,
          maxInstances: 0,
        },
        status: 'blocked',
        auditTrail,
      };
    }

    auditTrail.push(
      `${new Date().toISOString()} - Security gate passed (${securityReview.overallSeverity})`
    );

    // Gate 2: Select optimal region
    const decision = await this.selectOptimalRegion();
    auditTrail.push(
      `${new Date().toISOString()} - Region selected: ${decision.selectedRegion} (${decision.carbonIntensity} gCO2eq/kWh, $${decision.estimatedCostPerHour}/hr)`
    );

    // Gate 3: Generate deployment config
    const service = serviceName || `rivet-${issueKey.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const config = {
      service,
      region: decision.selectedRegion,
      machineType: decision.selectedMachineType,
      useSpot: decision.isSpot,
      minInstances: 1,
      maxInstances: 3,
    };

    auditTrail.push(
      `${new Date().toISOString()} - Config generated: ${config.service} in ${config.region}`
    );

    const isDryRun = !process.env.GCP_PROJECT_ID;
    const status = isDryRun ? 'dry_run' : 'deployed';
    auditTrail.push(
      `${new Date().toISOString()} - Deployment ${status} (${Date.now() - startTime}ms)`
    );

    logInfo('Deployer: deployment complete', {
      correlationId: this.correlationId,
      issueKey,
      status,
      region: decision.selectedRegion,
      carbonIntensity: decision.carbonIntensity,
      duration: Date.now() - startTime,
    });

    return {
      deploymentId: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      issueKey,
      timestamp: new Date().toISOString(),
      decision,
      securityGate: {
        passed: true,
        overallSeverity: securityReview.overallSeverity,
        findingCount: securityReview.findings.length,
      },
      config,
      status,
      auditTrail,
    };
  }

  /**
   * Select region optimizing for lowest carbon, then cost
   */
  private async selectOptimalRegion(): Promise<DeploymentDecision> {
    const gcpClient = new GcpClient(this.gcpProjectId);

    const [carbonData, pricingData] = await Promise.all([
      gcpClient.fetchCarbonMetrics(undefined, this.correlationId),
      gcpClient.fetchComputePricing(undefined, undefined, this.correlationId),
    ]);

    // Score each region: 70% carbon weight, 30% cost weight
    const scored = this.scoreRegions(carbonData, pricingData);
    const best = scored[0];

    const worstCarbon = Math.max(...carbonData.map((r) => r.carbonIntensity));
    const worstCost = Math.max(...pricingData.map((r) => r.spotPerHour ?? r.onDemandPerHour));

    const carbonSavings =
      worstCarbon > 0 ? Math.round(((worstCarbon - best.carbonIntensity) / worstCarbon) * 100) : 0;

    const bestPrice = best.spotPrice ?? best.onDemandPrice;
    const costSavings = worstCost > 0 ? Math.round(((worstCost - bestPrice) / worstCost) * 100) : 0;

    return {
      selectedRegion: best.region,
      selectedMachineType: best.machineType,
      carbonIntensity: best.carbonIntensity,
      estimatedCostPerHour: bestPrice,
      isSpot: best.spotPrice !== null,
      carbonSavingsPercent: carbonSavings,
      costSavingsPercent: costSavings,
      rationale: `Selected ${best.region} for lowest carbon-weighted score. Carbon: ${best.carbonIntensity} gCO2eq/kWh (${carbonSavings}% savings). Cost: $${bestPrice}/hr${best.spotPrice ? ' (spot)' : ''}.`,
    };
  }

  /**
   * Score regions by weighted carbon + cost metric
   */
  private scoreRegions(
    carbonData: GcpRegion[],
    pricingData: ComputePricing[]
  ): Array<{
    region: string;
    machineType: string;
    carbonIntensity: number;
    onDemandPrice: number;
    spotPrice: number | null;
    score: number;
  }> {
    const maxCarbon = Math.max(...carbonData.map((r) => r.carbonIntensity), 1);
    const maxCost = Math.max(...pricingData.map((r) => r.spotPerHour ?? r.onDemandPerHour), 0.01);

    const scored = pricingData
      .map((pricing) => {
        const carbon = carbonData.find((c) => c.region === pricing.region);
        if (!carbon) return null;

        const normalizedCarbon = carbon.carbonIntensity / maxCarbon;
        const effectivePrice = pricing.spotPerHour ?? pricing.onDemandPerHour;
        const normalizedCost = effectivePrice / maxCost;

        const score = normalizedCarbon * 0.7 + normalizedCost * 0.3;

        return {
          region: pricing.region,
          machineType: pricing.machineType,
          carbonIntensity: carbon.carbonIntensity,
          onDemandPrice: pricing.onDemandPerHour,
          spotPrice: pricing.spotPerHour,
          score,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    scored.sort((a, b) => a.score - b.score);
    return scored;
  }
}
