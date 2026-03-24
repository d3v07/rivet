# AGENTS.md — MCP Server Subdirectory Governance

This file refines the root AGENTS.md for code generated within the `/mcp-server/` directory. These rules apply to all Node.js/TypeScript code implementing MCP tools and servers.

## Node.js/TypeScript Specific

### Strict Types

- **No `any` types**: Every function parameter and return type must be explicitly typed. Use `unknown` only at system boundaries (JSON parsing), then narrow immediately.
- **Strict mode enabled**: `tsconfig.json` enforces `strict: true`, `noImplicitAny: true`, `noImplicitReturns: true`.
- **Zod validation at boundaries**: All external data (Jira API responses, GCP responses, HTTP payloads) must be validated against a Zod schema before use.

### Async Patterns

- **No callback hell**: Use async/await, not nested callbacks.
- **Error propagation**: Use try/catch and propagate errors up, do not silently swallow.
- **Timeout enforcement**: All external API calls must have a timeout. Default: 30 seconds. Timeouts throw an error and are caught by the caller.
- **No global state**: MCP tools must be stateless. All state is passed as arguments or stored in external systems (databases, caches).

### MCP Server Implementation

- **Single server instance**: Only one MCP server per process. Use stdio or HTTP transport, never both simultaneously in the same process.
- **Tool schema validation**: Every tool's input and output must have a Zod schema. Validate input before execution, validate output before returning.
- **Tool response sanitization**: All tool responses are passed through the Sanitization middleware before being returned to the caller. The middleware runs *inside* the tool handler, so data is clean before it leaves the server.

### External API Integration

- **Jira REST API v3**: Use OAuth 2.0 or API token authentication. Set `User-Agent: Rivet/1.0` header. Retry on 429 (rate limit) with exponential backoff (1s, 2s, 4s, then fail).
- **GCP APIs**: Authenticate via service account key (from `GOOGLE_APPLICATION_CREDENTIALS` env). Use the official `@google-cloud/bigquery` and `@google-cloud/billing` libraries. Handle quota exceeded (403) by waiting and retrying.
- **Response parsing**: Parse all API responses with Zod schemas. If parsing fails, log the raw response (truncated to 500 chars) and return a clear error.

### Logging & Debugging

- **Structured logging**: Use Winston logger. All logs are JSON with: `timestamp`, `level`, `message`, `context`, `correlationId`.
- **No `console.log`**: Development debugging uses the logger at `debug` level. Production must not see debug logs.
- **Correlation IDs**: Generate a UUID for each MCP request. Pass it through all logs so a single request can be traced end-to-end.

### Testing MCP Tools

- **Mock external APIs**: Unit tests for tools use mocked Jira and GCP responses. Never call real APIs in tests.
- **Integration tests**: Separate integration test suite (optional for hackathon, required for production) calls real APIs with a test environment.
- **Test tool handlers directly**: Don't test via the MCP server transport. Invoke the tool handler function directly with mocked dependencies.

### Performance & Token Efficiency

- **Payload trimming**: Before returning tool responses, remove unnecessary fields: `self`, `expand`, null values, empty arrays. Target >50% reduction in JSON size for Jira, >40% for GCP.
- **Lazy evaluation**: Don't fetch all issues, regions, or pricing tiers. Fetch only what the current step needs (pagination with limit).
- **Caching**: Cache stable data (GCP regions, carbon data that updates daily) for up to 24 hours to reduce API calls and token usage.

### Dependencies

- **Minimal production dependencies**: `@modelcontextprotocol/sdk`, `zod`, `axios` (or built-in `fetch`), `winston`, `uuid`. No large frameworks.
- **Dev dependencies only**: testing libraries, TypeScript, linters.
- **No peer dependencies**: Do not require consumers to install additional packages.

## Examples

### ✓ Good: Type-safe Zod validation

```typescript
import { z } from 'zod'

const JiraIssueSchema = z.object({
  key: z.string(),
  summary: z.string(),
  description: z.string().optional(),
})

async function fetchIssue(key: string): Promise<z.infer<typeof JiraIssueSchema>> {
  const response = await jiraClient.get(`/rest/api/3/issue/${key}`)
  return JiraIssueSchema.parse(response.data)
}
```

### ✗ Bad: No validation, `any` type

```typescript
async function fetchIssue(key: any): Promise<any> {
  const response = await jiraClient.get(`/rest/api/3/issue/${key}`)
  return response.data
}
```

### ✓ Good: Structured logging with correlation ID

```typescript
logger.info('Fetching issue', {
  correlationId,
  jiraKey: key,
  timestamp: new Date().toISOString(),
})
```

### ✗ Bad: Console.log

```typescript
console.log(`Fetching issue ${key}`)
```
