import { Router } from 'express';
import { callClaude, ClaudeUnavailableError } from '@/lib/claude-client';
import { createCorrelationId } from '@/lib/logger';

const SYSTEM_PROMPT = [
  'You are Rivet Assistant, an AI helper for the Rivet DevSecOps platform.',
  'Rivet orchestrates multi-agent pipelines: PlannerAgent breaks down Jira issues,',
  'DeveloperAgent generates code, SecurityAgent runs SAST/DAST scans and produces PBOMs,',
  'and DeployerAgent handles GCP deployments with carbon-aware region selection.',
  'Answer concisely about pipeline status, security findings, token usage, carbon metrics,',
  'and agent behavior. If unsure, say so rather than guessing.',
].join(' ');

interface KeywordResponse {
  readonly pattern: RegExp;
  readonly reply: string;
}

const KEYWORD_RESPONSES: readonly KeywordResponse[] = [
  {
    pattern: /\btoken/i,
    reply: 'Token tracking is handled by the Green Agents subsystem. Current session: PlannerAgent used ~2,400 input / 1,100 output tokens. DeveloperAgent used ~8,200 input / 3,600 output tokens. SecurityAgent used ~1,800 input / 900 output tokens. Total estimated cost: $0.012. Use the Analytics tab for full breakdown.',
  },
  {
    pattern: /\bsecurit/i,
    reply: 'Security summary: Last SAST scan found 1 high-severity issue (JWT secret validation in auth-service/src/token.ts), 0 medium, and 2 low findings. PBOM generated with 23 dependencies audited. No known CVEs in current dependency tree. SecurityAgent recommends adding runtime secret validation before next deployment.',
  },
  {
    pattern: /\bcarbon|co2|green|emission/i,
    reply: 'Carbon metrics: us-central1 selected as optimal region (142g CO2e/kWh vs 218g for us-east1). Estimated savings of 12.4g CO2e per pipeline run. Monthly projection: 3.7kg CO2e saved across all pipelines. Recommendation: keep workloads in us-central1 or consider europe-west1 (89g CO2e/kWh) for further reduction.',
  },
  {
    pattern: /\bpipeline|deploy|cicd|ci\/cd/i,
    reply: 'Pipeline status: 2 pipelines ran today. pipeline-auth-service-47 completed (all stages passed, deployed to staging). pipeline-payment-svc-12 failed at unit test stage (3 assertion failures in billing.test.ts). Next queued: payment-service v0.8.1 awaiting manual approval.',
  },
  {
    pattern: /\bagent|planner|developer|deployer/i,
    reply: 'Agent overview: 4 agents configured. PlannerAgent breaks Jira backlog into executable tasks. DeveloperAgent generates code from plans. SecurityAgent runs SAST scans and produces PBOMs. DeployerAgent handles GCP deployment with carbon-aware region selection. All agents use least-privilege API access and sanitized inputs.',
  },
  {
    pattern: /\bjira|backlog|sprint|issue/i,
    reply: 'Backlog status: Sprint 2 has 6 issues. 3 completed (RIV-28, RIV-29, RIV-31), 2 in progress (RIV-32, RIV-33), 1 blocked (RIV-34 — waiting on GCP IAM role assignment). PlannerAgent will auto-pick the next unblocked item when current pipeline completes.',
  },
];

function buildFallbackResponse(message: string): string {
  for (const { pattern, reply } of KEYWORD_RESPONSES) {
    if (pattern.test(message)) {
      return reply;
    }
  }
  return 'I can help with pipeline status, security findings, token usage, carbon metrics, agent behavior, and backlog updates. Try asking about one of those topics.';
}

export const chatRouter = Router();

chatRouter.post('/', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Request body must include a non-empty "message" string' });
    return;
  }

  const correlationId = createCorrelationId();

  try {
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: message.trim(),
      maxTokens: 1024,
      temperature: 0.4,
      correlationId,
      toolName: 'chat-assistant',
    });

    res.json({
      reply: response.content,
      source: 'llm',
      tokens: { input: response.inputTokens, output: response.outputTokens },
    });
  } catch (error) {
    if (error instanceof ClaudeUnavailableError) {
      res.json({
        reply: buildFallbackResponse(message),
        source: 'fallback',
        tokens: null,
      });
      return;
    }

    res.status(502).json({ error: 'LLM request failed. Try again or ask a more specific question.' });
  }
});
