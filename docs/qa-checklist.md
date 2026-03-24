# Rivet QA Checklist

## URLs
- **Frontend**: https://d3v07.github.io/rivet/
- **Backend API**: https://rivet-api-1094724708022.europe-west1.run.app/api
- **Jira**: https://rivet444.atlassian.net (project: DEV)
- **GitLab**: https://gitlab.com/gitlab-ai-hackathon/participants/35312041

---

## Backend API Endpoints

| Endpoint | Expected | Check |
|----------|----------|-------|
| `GET /api/health` | `status: ok`, `llmProvider: gemini`, `llmAvailable: true` | [ ] |
| `GET /api/pipelines` | 7 pipelines (DEV-7 to DEV-13) with correct statuses | [ ] |
| `GET /api/pipelines/DEV-7` | Single pipeline with 4 success stages | [ ] |
| `GET /api/pipelines/DEV-11` | Blocked pipeline with 2 CRITICAL findings | [ ] |
| `GET /api/security/findings` | 7 findings (2 CRITICAL, 1 HIGH, 2 MEDIUM, 1 LOW, 1 PASS) | [ ] |
| `GET /api/security/trend` | 7-day vulnerability trend data | [ ] |
| `GET /api/backlog` | 13 Jira issues from rivet444.atlassian.net | [ ] |
| `GET /api/pbom` | 2 PBOMs (DEV-7 success, DEV-11 failed) | [ ] |
| `GET /api/carbon/regions` | 10 GCP regions with carbon/cost data | [ ] |
| `GET /api/carbon/forecast` | Carbon intensity forecast points | [ ] |
| `GET /api/analytics/tokens` | Token metrics with invocation counts | [ ] |
| `GET /api/analytics/green-score` | Green grades per pipeline | [ ] |
| `GET /api/audit` | 10 audit events | [ ] |
| `POST /api/pipelines/run` | Triggers real LLM pipeline (Gemini) | [ ] |
| `POST /api/chat` | AI chat with real LLM response | [ ] |

## Frontend Pages

| Page | What to Verify | Check |
|------|---------------|-------|
| Dashboard (`/`) | 7 pipelines with DEV-7 to DEV-13, "Live" badge green, stage indicators | [ ] |
| Live (`/live`) | Real-time pipeline visualization | [ ] |
| Activity (`/activity`) | Timeline of recent pipeline runs | [ ] |
| Backlog (`/backlog`) | 13 Jira issues from live API | [ ] |
| Security (`/security`) | Findings table, vulnerability trend chart, OWASP category breakdown | [ ] |
| Green Metrics (`/green`) | Carbon budget, efficiency leaderboard, region comparison | [ ] |
| PBOM (`/pbom`) | 2 PBOMs with expandable agent/tool details | [ ] |
| Playground (`/playground`) | Prompt playground with LLM interaction | [ ] |
| Report (`/report`) | Sustainability report with charts | [ ] |
| Audit (`/audit`) | Audit log with event timeline | [ ] |
| Settings (`/settings`) | Config panel | [ ] |

## Interactive Features

| Feature | How to Test | Check |
|---------|------------|-------|
| Run Pipeline | Click "Run Pipeline" on dashboard, fill form, submit | [ ] |
| AI Chat | Click "AI" in header, ask about security/carbon/tokens | [ ] |
| Command Palette | Press Cmd+K, search for "security" or "DEV-7" | [ ] |
| Dark Mode | Toggle via header button | [ ] |
| Notifications | Click bell icon in header | [ ] |
| Deploy Wizard | Click deploy on a pipeline row | [ ] |
| Onboarding Tour | Shows on first visit (Step 1 of 6) | [ ] |

## Data Coherence

| Check | Expected | Verify |
|-------|----------|--------|
| Pipeline DEV-11 blocked | Security findings show 2 CRITICAL for DEV-11 | [ ] |
| Pipeline DEV-13 failed | Development stage failed at 4/7 steps | [ ] |
| PBOM DEV-7 | Shows 4 agents, 3 tools, success status | [ ] |
| PBOM DEV-11 | Shows 3 agents, failed at security-scan stage | [ ] |
| Backlog matches Jira | Issue keys and summaries match rivet444.atlassian.net | [ ] |
| Green metrics regions | europe-north1 lowest carbon (12 gCO2), asia-east1 highest (55) | [ ] |

## LLM Integration

| Provider | Status | Verify |
|----------|--------|--------|
| Gemini 2.5 Flash | Active on Cloud Run | Health endpoint shows `llmProvider: gemini` |
| Anthropic Claude | Code ready, needs API key in Secret Manager | Set `ANTHROPIC_API_KEY` to activate |
| Ollama (local) | Available for local dev | Set `OLLAMA_BASE_URL` |

## Quick Smoke Test (30 seconds)

```bash
# All 5 should return 200
curl -s -o /dev/null -w "%{http_code}" https://rivet-api-1094724708022.europe-west1.run.app/api/health
curl -s -o /dev/null -w "%{http_code}" https://rivet-api-1094724708022.europe-west1.run.app/api/pipelines
curl -s -o /dev/null -w "%{http_code}" https://rivet-api-1094724708022.europe-west1.run.app/api/security/findings
curl -s -o /dev/null -w "%{http_code}" https://rivet-api-1094724708022.europe-west1.run.app/api/backlog
curl -s -o /dev/null -w "%{http_code}" https://rivet-api-1094724708022.europe-west1.run.app/api/pbom
```
