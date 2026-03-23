# Rivet Demo Video Script (3 minutes)

## Setup Before Recording
- Open https://d3v07.github.io/rivet/ in browser (dark mode ON)
- Open https://rivet444.atlassian.net in second tab
- Terminal ready with curl commands
- Clear browser cache if onboarding tour should show

---

## [0:00–0:20] Hook + Problem Statement

**Screen**: Dashboard with all 7 pipelines visible

> "Meet Rivet — a multi-agent DevSecOps pipeline that autonomously transforms Jira business requirements into secure, audited, deployed code."

> "The problem: modern development requires juggling code generation, security scanning, carbon-aware deployment, and audit compliance. Rivet automates the entire chain with specialized AI agents."

---

## [0:20–0:50] Architecture Overview (30 sec)

**Screen**: Scroll dashboard showing pipeline stages

> "Rivet orchestrates four AI agents through GitLab Duo Agent Platform."

**Point to stage indicators on DEV-7 row**:
> "Each pipeline runs through: a Planner that breaks down Jira issues, a Developer that writes code via TDD, a Security Analyst that scans for OWASP vulnerabilities, and a Deployer that selects the greenest GCP region."

**Click DEV-11 (blocked)**:
> "When security finds critical issues — like this prompt injection bypass — deployment is automatically blocked. No human intervention needed."

---

## [0:50–1:20] Live Demo: Run a Pipeline (30 sec)

**Screen**: Click "Run Pipeline" button

> "Let me trigger a real pipeline. I'll pick a Jira issue from our backlog."

**Fill form**: Issue key: `DEV-14`, Summary: "Add rate limiting to chat endpoint", Priority: High

> "This hits our live backend on Cloud Run, which calls Gemini 2.5 Flash to plan, develop, scan, and deploy."

**Wait for response or cut to result**:
> "The pipeline completed in under a minute — all four stages passed, deployed to europe-west1 at 28 gCO2 per kilowatt hour."

---

## [1:20–1:50] Security + PBOM (30 sec)

**Screen**: Navigate to Security page

> "The Security dashboard aggregates findings across all pipeline runs."

**Point to findings table**:
> "Two critical findings on DEV-11 — a base64-encoded prompt injection bypass and a Unicode homoglyph attack. These blocked deployment automatically."

**Navigate to PBOM page, expand DEV-7**:
> "Every pipeline generates a Pipeline Bill of Materials — documenting every agent, model, tool invocation, and token count. Full audit trail for compliance."

---

## [1:50–2:20] Green Agents + Carbon Metrics (30 sec)

**Screen**: Navigate to Green Metrics

> "For the Green Agents prize track — Rivet tracks every token across every agent."

**Point to efficiency leaderboard**:
> "DEV-8 is our most efficient pipeline — grade B, 398 tokens per second."

**Point to carbon budget**:
> "The carbon budget shows 143 gCO2 used this month. Our deployment algorithm scored europe-north1 at just 12 gCO2 — 78% lower than the default us-central1."

**Point to region comparison table**:
> "Region selection uses a 60/40 composite score — carbon intensity weighted higher than cost."

---

## [2:20–2:45] AI Chat + Jira Integration (25 sec)

**Screen**: Click AI button in header

> "The built-in AI assistant can query pipeline data in natural language."

**Type**: "What are the critical security findings?"

**Show response**, then:

**Switch to Jira tab**:
> "All 13 issues are real — pulled live from Jira. The backlog page fetches them via Jira REST API. Eleven completed, two still in progress."

---

## [2:45–3:00] Closing (15 sec)

**Screen**: Back to dashboard

> "Rivet is fully open source. The backend runs on Cloud Run in europe-west1, the frontend on GitHub Pages."

> "Multi-agent orchestration, security gates, carbon-aware deployment, full audit trail — all autonomous, all auditable."

> "Thank you."

---

## Key Numbers to Mention
- 7 pipeline runs tracked
- 4 specialized AI agents
- 13 real Jira issues
- 10 GCP regions compared
- 118k+ tokens tracked
- 2 CRITICAL findings auto-blocked deployment
- 12 gCO2/kWh (best region) vs 55 gCO2/kWh (worst)
