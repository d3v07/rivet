# CLAUDE.md — Rivet Project Configuration

## Project Overview

**Rivet** is a multi-agent, async DevSecOps flow for the 2026 GitLab AI Hackathon. It autonomously transforms Jira business requirements into secure, audited, deployed code via specialized AI agents orchestrated through GitLab Duo Agent Platform.

**Deadline**: March 25, 2026 (12 days from start)
**Prize tracks**: General, Google Cloud, Anthropic, Green Agents ($65k total pool)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **MCP Server** | Node.js 18+, TypeScript, `@modelcontextprotocol/sdk` |
| **Agent Platform** | GitLab Duo Agent Platform (Premium/Ultimate) |
| **Agent Models** | Anthropic Claude 3.5 Sonnet, GitLab native agents |
| **External APIs** | Jira REST v3, GCP BigQuery, Cloud Billing |
| **CI/CD** | GitLab CI (shared runners), `.gitlab-ci.yml` |
| **Testing** | Vitest, 80% coverage minimum |
| **Linting** | ESLint + TypeScript strict mode |
| **Formatting** | Prettier |

## Build & Test Commands

```bash
make dev              # Start dev server with watch
make build            # Build TS to dist/
make typecheck        # Type-check only
make test             # Run all tests
make test-coverage    # Generate coverage report
make lint             # Run ESLint
make format           # Format with Prettier
make mcp-server       # Run MCP server
make ci               # Full CI pipeline locally
```

**All must pass before commit:**
- `make typecheck` ✓
- `make lint` ✓
- `make test` ✓ (coverage >= 80%)
- `make build` ✓

## Project Structure

```
rivet/
├── src/
│   ├── agents/          # Agent handlers (planner, developer, security, deployer)
│   ├── mcp-server/      # MCP server + tools (Jira, GCP, sanitization)
│   ├── lib/             # Shared utilities (token tracker, logger, sanitizer)
│   ├── security/        # Security infrastructure (PBOM, identity, audit)
│   ├── types/           # TypeScript interfaces
│   ├── __tests__/       # Test files (mirror src structure)
│   └── index.ts         # Entry point
├── mcp-server/
│   └── AGENTS.md        # Node.js/TS-specific agent rules
├── AGENTS.md            # Global agent governance
├── .gitlab-ci.yml       # CI/CD pipeline
├── Makefile             # Build targets
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config (strict mode)
├── vitest.config.ts     # Test config
└── docs/
    ├── architecture.md   # System design
    ├── demo-script.md    # 3-minute demo outline
    └── submission-checklist.md
```

## Key Rules (from AGENTS.md)

All AI agents MUST follow:

1. **Vertical slices**: One complete, deployable path at a time. No partial scaffolding.
2. **Async-first**: All operations non-blocking, graceful failure, no human intervention loops.
3. **Least privilege**: Each agent gets exactly the API permissions it needs.
4. **Immutability**: No object mutations. Spread operators, map/filter, frozen dataclasses only.
5. **Function size**: Max 50 lines. Max file size: 800 lines.
6. **Error handling**: Explicit at every level. Never silently swallow errors.
7. **Validation at boundaries**: Zod schemas for all external data (Jira, GCP, HTTP payloads).
8. **No secrets in logs**: Log hashed/masked values only.
9. **Sanitization**: All LLM inputs sanitized to prevent prompt injection.
10. **Testing**: 80% coverage minimum. TDD: test first, then implementation.
11. **Human gates**: Production merges + deployments require approval. Security failures halt flow.
12. **Token tracking**: Log per-agent input/output tokens for Green Agents metrics.

## Execution Strategy

**Sprint 0 (Day 1)**: Repo scaffold, AGENTS.md, CI pipeline working
**Sprint 1 (Days 2-3)**: MCP server with 3 tools (Jira + GCP), testable
**Sprint 2 (Days 4-5)**: Agent configs in GitLab, Planner producing plans
**Sprint 3 (Days 6-7)**: Developer writing code, Security scanning
**Sprint 4 (Days 8-9)**: Flow orchestration, Deployer agent
**Sprint 5 (Days 10-11)**: Security hardening, Green Agents metrics
**Sprint 6 (Days 11-12)**: E2E test, docs, demo, submission

## External Dependencies

### Required (once GitLab group access arrives)

- **GitLab Premium/Ultimate** group with Duo Agent Platform enabled
- **Anthropic API key** (console.anthropic.com)
- **Jira Cloud** free instance + API token
- **GCP project** + service account key
- **glab CLI** installed locally (`brew install glab`)

### Optional (local dev works without these)

- Real API credentials can be mocked for local testing
- All tools have integration tests with mocked responses

## Conventions

### Naming

- **Agents**: `PascalCase` + "Agent" suffix (e.g., `PlannerAgent`, `DeveloperAgent`)
- **Functions**: `camelCase` (e.g., `queryJiraBacklog`, `fetchGcpCarbonMetrics`)
- **Types/Schemas**: `PascalCase` (e.g., `JiraIssue`, `GcpRegion`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_CONTEXT_TOKENS`, `JIRA_API_TIMEOUT`)
- **Files**: `kebab-case.ts` (e.g., `query-jira-backlog.ts`, `sanitize.ts`)

### Code Style

- **Immutability**: Always use spread operators or map/filter, never mutate in place
- **Error handling**: Use try/catch at boundaries, propagate errors up with context
- **Logging**: Winston logger with structured JSON format, correlation IDs for tracing
- **Comments**: Only for non-obvious logic (the "why", not the "what"). One line max.
- **Type safety**: No `any` types. Use `unknown` at boundaries, narrow with type guards.

### Testing

- **Test-first**: Write failing test (RED) → implement (GREEN) → refactor (REFACTOR)
- **Mocking**: Mock all external APIs; integration tests separate
- **Edge cases**: Always test null/undefined, boundaries, error paths, Unicode

## Human-AI Collaboration Log

Per hackathon rules, all AI tool usage is documented:

- **Claude Code**: Used for all code generation, architecture planning, test design
- **AI-assisted code**: All code must have human review before merge
- **Manual contribution**: Human developer orchestrates the flow, approves critical decisions

The system itself demonstrates multi-agent orchestration with human-in-the-loop gates at production boundaries (merges, deployments).

## Gotchas & Known Constraints

1. **GitLab Duo API may shift** (public beta) — agent configs are YAML-based, fast to iterate
2. **Shared runners have 30-minute timeout** — keep jobs fast, use caching
3. **npm ci vs npm install** — always use `npm ci` in CI for reproducibility
4. **ESLint + TypeScript strict mode** — will block many patterns (no implicit any, unused variables, etc.)
5. **Token efficiency** — context window is limited; aggressive payload optimization needed for Green Agents track
6. **Prompt injection risk** — sanitization middleware runs on ALL external API responses before they reach agents

## Next Steps

1. ✓ Install dependencies: `npm ci`
2. ✓ Set up `.env` from `.env.example` (can leave blank for local dev with mocks)
3. ✓ Run smoke tests: `npm run test`
4. ✓ Verify build: `npm run build`
5. → Start Sprint 1: Implement MCP server with Jira + GCP tools
