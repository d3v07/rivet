# Rivet

**Multi-agent DevSecOps pipeline that turns Jira tickets into secure, deployed code.**

Hackathon submission — [GitLab AI Hackathon 2026](https://gitlab.com/gitlab-ai-hackathon) (Feb 9 – Mar 25)

| Live | Link |
|------|------|
| Dashboard | [d3v07.github.io/rivet](https://d3v07.github.io/rivet/) |
| API | [rivet-api-1094724708022.europe-west1.run.app/api](https://rivet-api-1094724708022.europe-west1.run.app/api/health) |
| Jira | [rivet444.atlassian.net](https://rivet444.atlassian.net) |

---

![Pipeline Dashboard](docs/screenshots/rivet-dashboard.png)

## What It Does

Rivet reads a Jira issue, breaks it into an execution plan, generates code, scans for security vulnerabilities, picks the lowest-carbon GCP region, and deploys. Four agents, zero manual steps unless something critical is found.

```
Jira Issue
  → Planner Agent    (reads requirements, produces execution plan)
  → Developer Agent  (writes code via TDD)
  → Security Agent   (OWASP scan, blocks on critical findings)
  → Deployer Agent   (carbon-aware region selection, deploys)
  → PBOM             (full audit trail)
```

If security finds a critical issue, deployment is blocked automatically. No human needed.

## Numbers

| Metric | Value |
|--------|-------|
| Pipeline runs tracked | 7 |
| AI agents | 4 |
| Jira issues (live) | 13 |
| API endpoints | 23 |
| MCP tools | 6 |
| Tests | 215 across 16 files |
| Coverage | 85% |
| GCP regions scored | 10 |
| Tokens tracked | 118,877 |
| Greenest region | europe-north1 (12 gCO2/kWh) |
| Carbon saved | 78% vs default us-central1 |
| Critical findings auto-blocked | 2 (prompt injection on DEV-11) |

## Prize Tracks

| Track | How Rivet Qualifies |
|-------|---------------------|
| **General** | 4 GitLab Duo agents, MCP server with 6 tools, YAML flow orchestration |
| **Google Cloud ($13.5k)** | Carbon-aware deployment across 10 GCP regions, Cloud Run backend, cost/carbon composite scoring |
| **Anthropic ($13.5k)** | Claude Sonnet integration via `@anthropic-ai/sdk`, token tracking, structured logging |
| **Green Agents ($3k)** | Per-agent token efficiency, carbon budget tracking, region optimization, sustainability reporting |

## Screenshots

### Security Dashboard
![Security](docs/screenshots/rivet-security.png)

2 critical findings on DEV-11 — base64-encoded prompt injection and Unicode homoglyph attack. Both detected automatically, deployment blocked.

### Green Agents Metrics
![Green Metrics](docs/screenshots/rivet-green.png)

Token efficiency leaderboard, carbon budget (143/500 gCO2), 10-region comparison, deployment strategy recommendations.

## Architecture

```
src/
  agents/           4 agents (planner, developer, security, deployer)
  api/routes/       REST API — 10 route modules, 23 endpoints
  lib/              LLM client (4 providers), logger, sanitizer, token tracker
  mcp-server/       MCP server + 6 tools + Zod schemas
  security/         PBOM generation
  types/            TypeScript interfaces

.gitlab/
  agents/           GitLab Duo agent YAML configs (4)

flows/              GitLab Duo flow orchestration
```

### LLM Providers

Priority chain: Ollama → Gemini → Claude → Vertex AI. Each call tracks input/output tokens, latency, and provider.

```
OLLAMA_BASE_URL → local Ollama (development)
GEMINI_API_KEY  → Gemini 2.5 Flash (production, Cloud Run)
ANTHROPIC_API_KEY → Claude Sonnet (Anthropic prize track)
GCP_PROJECT_ID  → Vertex AI (GCP-native fallback)
```

### MCP Tools

| Tool | What It Does |
|------|-------------|
| `query_jira_backlog` | Fetch issues from Jira REST API, sanitize against prompt injection |
| `plan_issue` | Generate TDD execution plan from Jira issue |
| `execute_plan` | Run the plan through Developer agent |
| `review_code` | OWASP Top 10 security scan |
| `fetch_gcp_carbon_metrics` | Carbon intensity per GCP region |
| `get_compute_pricing` | Spot/on-demand pricing by region and machine type |

### Security

- Prompt injection sanitization on all external data before it reaches agents
- JQL injection prevention with regex-validated project keys
- OWASP scanning (secrets, XSS, SQL injection, auth, prompt injection)
- Zod validation on every MCP tool input/output
- PBOM audit trail for every pipeline run
- Human-in-the-loop gates on production deployments

### Green Agents

- Per-agent token tracking (input, output, latency per invocation)
- Carbon-aware deployment: 60% carbon weight, 40% cost weight
- Region scoring across 10 GCP regions with real carbon intensity data
- Monthly carbon budget with sustainability recommendations
- Token optimization suggestions per tool

## Frontend

11 pages, all powered by the live Cloud Run API:

| Page | Purpose |
|------|---------|
| **Dashboard** | Pipeline overview — status, grade, stages, region, carbon, duration, tokens |
| **Live** | Real-time pipeline visualization |
| **Activity** | Recent pipeline activity timeline |
| **Backlog** | Jira Kanban board (drag-and-drop, live from Jira REST API) |
| **Security** | Findings table, vulnerability trends, OWASP category breakdown |
| **Green Metrics** | Efficiency leaderboard, carbon budget, region map, forecast, cost estimator |
| **PBOM** | Expandable audit trail — agents, tools, token counts per pipeline |
| **Playground** | LLM prompt playground |
| **Report** | Sustainability report with carbon equivalences |
| **Audit** | Chronological event log with category filters |
| **Settings** | Configuration panel |

## Quick Start

```bash
git clone https://gitlab.com/gitlab-ai-hackathon/participants/35312041.git rivet
cd rivet
npm ci
cp .env.example .env    # add your API keys
make ci                 # typecheck + lint + test + build
make dev                # start dev server
```

### API Smoke Test

```bash
curl -s https://rivet-api-1094724708022.europe-west1.run.app/api/health | jq .status
curl -s https://rivet-api-1094724708022.europe-west1.run.app/api/pipelines | jq .meta.total
curl -s https://rivet-api-1094724708022.europe-west1.run.app/api/security/findings | jq length
curl -s https://rivet-api-1094724708022.europe-west1.run.app/api/backlog | jq .total
curl -s https://rivet-api-1094724708022.europe-west1.run.app/api/carbon/regions | jq length
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Express |
| LLM | Ollama, Gemini 2.5 Flash, Claude Sonnet, Vertex AI |
| MCP | `@modelcontextprotocol/sdk` |
| External APIs | Jira REST v3, GCP Carbon/Billing |
| Frontend | React, Vite, Tailwind, shadcn/ui, Recharts |
| Hosting | Cloud Run (europe-west1), GitHub Pages |
| CI/CD | GitLab CI, shared runners |
| Testing | Vitest, 85% coverage |

## License

MIT — see [LICENSE](LICENSE)
