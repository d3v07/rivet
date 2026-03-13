/**
 * Rivet - Multi-Agent DevSecOps Flow for GitLab AI Hackathon 2026
 *
 * Entry point for the Rivet orchestration system.
 * This module coordinates multi-agent workflows that transform Jira issues into deployed code.
 *
 * Workflow:
 * 1. Contextual Planner Agent - reads Jira issue, generates execution plan
 * 2. Developer Agent - writes code via Anthropic Claude API
 * 3. Security Analyst Agent - scans code for OWASP vulnerabilities
 * 4. Deployer Agent - orchestrates carbon-aware deployment to GCP
 */

export const VERSION = '0.1.0';

export function greeting(): string {
  return `Rivet v${VERSION} - GitLab AI Hackathon 2026`;
}
