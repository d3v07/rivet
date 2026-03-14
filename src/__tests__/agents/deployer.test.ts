import { describe, it, expect } from 'vitest';
import { DeployerAgent } from '@/agents/deployer';
import type { SecurityReview } from '@/agents/security-analyst';

const createPassingReview = (overrides?: Partial<SecurityReview>): SecurityReview => ({
  reviewId: 'sec-test-1',
  issueKey: 'PROJ-1',
  timestamp: new Date().toISOString(),
  overallSeverity: 'PASS',
  findings: [],
  summary: 'No security issues found. Code is safe to deploy.',
  blocksDeployment: false,
  ...overrides,
});

const createBlockingReview = (overrides?: Partial<SecurityReview>): SecurityReview => ({
  reviewId: 'sec-test-2',
  issueKey: 'PROJ-1',
  timestamp: new Date().toISOString(),
  overallSeverity: 'CRITICAL',
  findings: [
    {
      severity: 'CRITICAL',
      category: 'SECRETS',
      location: 'src/config.ts',
      issue: 'Hardcoded API key',
      recommendation: 'Use environment variables',
    },
  ],
  summary: 'Found 1 security issues: 1 CRITICAL. DEPLOYMENT BLOCKED.',
  blocksDeployment: true,
  ...overrides,
});

describe('DeployerAgent', () => {
  describe('deploy', () => {
    it('should deploy successfully with passing security review', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.status).toMatch(/deployed|dry_run/);
      expect(result.issueKey).toBe('PROJ-1');
      expect(result.deploymentId).toBeTruthy();
      expect(result.securityGate.passed).toBe(true);
    });

    it('should block deployment when security review fails', async () => {
      const deployer = new DeployerAgent();
      const review = createBlockingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.status).toBe('blocked');
      expect(result.securityGate.passed).toBe(false);
      expect(result.securityGate.overallSeverity).toBe('CRITICAL');
    });

    it('should select carbon-aware region', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.decision.selectedRegion).toBeTruthy();
      expect(result.decision.carbonIntensity).toBeGreaterThan(0);
      expect(result.decision.estimatedCostPerHour).toBeGreaterThan(0);
    });

    it('should calculate carbon savings', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.decision.carbonSavingsPercent).toBeGreaterThanOrEqual(0);
      expect(result.decision.carbonSavingsPercent).toBeLessThanOrEqual(100);
    });

    it('should calculate cost savings', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.decision.costSavingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('should produce an audit trail', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.auditTrail.length).toBeGreaterThan(0);
      expect(result.auditTrail[0]).toContain('PROJ-1');
    });

    it('should generate deployment config', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review, 'my-service');

      expect(result.config.service).toBe('my-service');
      expect(result.config.region).toBeTruthy();
      expect(result.config.machineType).toBeTruthy();
      expect(result.config.minInstances).toBeGreaterThanOrEqual(1);
      expect(result.config.maxInstances).toBeGreaterThanOrEqual(1);
    });

    it('should have zero config for blocked deployments', async () => {
      const deployer = new DeployerAgent();
      const review = createBlockingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.config.region).toBe('none');
      expect(result.config.minInstances).toBe(0);
    });

    it('should run as dry_run without GCP credentials', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.status).toBe('dry_run');
    });

    it('should include rationale in decision', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.decision.rationale).toBeTruthy();
      expect(result.decision.rationale.length).toBeGreaterThan(10);
    });

    it('should prefer spot pricing when available', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);

      expect(result.decision.isSpot).toBe(true);
    });
  });

  describe('correlation ID', () => {
    it('should accept custom correlation ID', async () => {
      const deployer = new DeployerAgent('test-corr-123');
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);
      expect(result).toBeDefined();
    });

    it('should generate correlation ID if not provided', async () => {
      const deployer = new DeployerAgent();
      const review = createPassingReview();

      const result = await deployer.deploy('PROJ-1', review);
      expect(result).toBeDefined();
    });
  });
});
