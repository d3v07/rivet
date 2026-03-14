# Rivet Demo Script (3 minutes)

## Setup (pre-demo)

```bash
npm ci
cp .env.example .env  # Add API keys
```

## Demo Flow

### 1. Show the Architecture (30s)

"Rivet is a multi-agent DevSecOps pipeline. It takes Jira issues and autonomously plans, develops, security-reviews, and deploys code — with carbon-aware region selection."

Show: `AGENTS.md` hierarchy, agent files in `src/agents/`

### 2. Run the Pipeline (60s)

```bash
npx tsx src/index.ts
```

Walk through the output:
- **Planner** analyzes each Jira issue, generates TDD execution plan
- **Developer** executes the plan (RED → GREEN → REFACTOR)
- **Security Analyst** scans for OWASP Top 10 vulnerabilities
- **Deployer** selects the greenest GCP region (carbon-weighted scoring)

### 3. MCP Integration (30s)

```bash
npx tsx src/mcp-server/index.ts
```

"The MCP server exposes 6 tools that GitLab Duo agents can call. Each tool validates input with Zod, sanitizes external data against prompt injection, and tracks token usage."

Show: `mcp.json`, tool list from ListTools

### 4. Security & Green Agents (30s)

- **Prompt injection sanitization** on all Jira data before agents see it
- **JQL injection prevention** with regex-validated project keys
- **Token tracking** per-tool for Green Agents metrics
- **Carbon-aware deployment**: 70% carbon weight, 30% cost weight

### 5. Test Suite (30s)

```bash
npx vitest run
```

"134 tests across 12 files. Every agent, every tool, every security boundary tested. E2E pipeline test runs the full flow."

## Key Talking Points

- **4 agents**: Planner, Developer, Security Analyst, Deployer
- **6 MCP tools**: Jira query, plan issue, execute plan, review code, GCP carbon, GCP pricing
- **Claude API integration** with deterministic fallback
- **AGENTS.md governance**: behavioral rules for all agents
- **Green Agents**: carbon-aware deployment + token efficiency tracking
- **Security**: prompt injection sanitization, JQL injection prevention, OWASP scanning
