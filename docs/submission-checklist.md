# Submission Checklist

## Required

- [x] Public GitLab project in hackathon group
- [x] README.md with project description
- [x] AGENTS.md with agent governance rules
- [x] Working CI/CD pipeline (.gitlab-ci.yml)
- [x] MCP server with tool definitions
- [x] mcp.json for GitLab Duo integration
- [x] Test suite with 80%+ coverage
- [x] Human-AI collaboration documentation (in CLAUDE.md)

## Prize Track: General

- [x] Multi-agent orchestration pipeline
- [x] 4 specialized agents (Planner, Developer, Security, Deployer)
- [x] Async pipeline with error handling
- [x] Full E2E integration test

## Prize Track: Anthropic via GitLab

- [x] Multi-provider LLM integration (Ollama/Gemini/Claude/Vertex)
- [x] Structured prompts with system/user separation
- [x] Graceful fallback when API unavailable
- [x] Token usage tracking per agent call

## Prize Track: Google Cloud

- [x] GCP carbon intensity metrics (BigQuery-ready)
- [x] GCP compute pricing integration
- [x] Carbon-aware region selection algorithm
- [x] Cost optimization (spot pricing preference)

## Prize Track: Green Agents

- [x] Token tracking per tool invocation
- [x] Aggregated metrics (input/output tokens, latency)
- [x] Carbon-weighted deployment scoring
- [x] Efficient payload sanitization (bytes removed tracking)

## Security

- [x] Prompt injection sanitization on all external data
- [x] JQL injection prevention (regex-validated project keys)
- [x] OWASP Top 10 scanning (secrets, XSS, SQLi, auth)
- [x] No secrets in code (.env gitignored)
- [x] Zod validation on all MCP tool inputs/outputs

## Architecture

- [x] AGENTS.md hierarchical governance
- [x] Correlation IDs for distributed tracing
- [x] Structured JSON logging (Winston)
- [x] Immutable data patterns throughout
- [x] TypeScript strict mode
