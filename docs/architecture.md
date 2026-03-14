# Architecture

## System Overview

```
Jira Backlog
    │
    ▼
┌─────────────────────────────────────────────┐
│              Orchestrator                    │
│  (correlation ID, audit trail, metrics)     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐    ┌───────────┐             │
│  │ Planner  │───▶│ Developer │             │
│  │ Agent    │    │ Agent     │             │
│  └──────────┘    └─────┬─────┘             │
│       │                │                    │
│       │          ┌─────▼──────┐            │
│       │          │ Security   │            │
│       │          │ Analyst    │            │
│       │          └─────┬──────┘            │
│       │                │                    │
│       │          ┌─────▼──────┐            │
│       │          │ Deployer   │            │
│       │          │ Agent      │            │
│       │          └────────────┘            │
│                                             │
├─────────────────────────────────────────────┤
│              MCP Server (6 tools)           │
│  query_jira_backlog | plan_issue            │
│  execute_plan | review_code                 │
│  fetch_gcp_carbon | get_compute_pricing     │
├─────────────────────────────────────────────┤
│              Shared Libraries               │
│  claude-client | sanitize | logger          │
│  token-tracker                              │
└─────────────────────────────────────────────┘
```

## Agent Responsibilities

| Agent | Input | Output | LLM Provider |
|-------|-------|--------|---------------|
| **Planner** | JiraIssue | ExecutionPlan (TDD steps) | Ollama/Gemini (with fallback) |
| **Developer** | ExecutionPlan | DeveloperProgress (code) | Ollama/Gemini (with fallback) |
| **Security** | Code files | SecurityReview (findings) | No (regex-based) |
| **Deployer** | SecurityReview | DeploymentResult | No (scoring algo) |

## Data Flow

1. **Jira Query**: Fetch issues with "Ready for Engineering" status
2. **Sanitize**: Strip prompt injection patterns, remove bloat fields
3. **Plan**: Generate TDD execution plan (6-8 steps per issue)
4. **Develop**: Execute each step (test→implement→refactor→verify→commit)
5. **Security Review**: Scan generated code for OWASP vulnerabilities
6. **Deploy Decision**: Score regions by carbon (70%) + cost (30%), select optimal
7. **Audit**: Log every stage with correlation ID and token metrics

## Security Model

- **Input validation**: Zod schemas on all MCP tool inputs
- **Prompt injection**: Regex-based sanitization on all external data
- **JQL injection**: Project key validation with `/^[A-Z][A-Z0-9]{1,9}$/`
- **Secret scanning**: Regex detection of hardcoded passwords, API keys, tokens
- **Deployment gate**: CRITICAL/HIGH findings block deployment

## Green Agents

Token efficiency tracked at three levels:
1. **Per-invocation**: Each MCP tool call records input/output tokens + latency
2. **Per-agent**: LLM API calls tracked separately with `llm_api:` prefix
3. **Aggregate**: Total tokens, avg latency, per-tool breakdown

Carbon-aware deployment uses weighted scoring:
- `score = (normalized_carbon × 0.7) + (normalized_cost × 0.3)`
- Prefers spot pricing when available
- Reports carbon/cost savings vs worst-case region
