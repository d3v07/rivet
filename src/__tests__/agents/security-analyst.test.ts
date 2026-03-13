/**
 * Tests for Security Analyst agent
 */

import { describe, it, expect } from 'vitest';
import { SecurityAnalystAgent } from '@/agents/security-analyst';

describe('SecurityAnalystAgent', () => {
  describe('reviewCode', () => {
    it('should pass clean code without findings', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/app.ts',
          content: `
import { z } from 'zod';
const userSchema = z.object({
  name: z.string(),
});
function processUser(user: unknown) {
  const validated = userSchema.parse(user);
  console.log(validated.name);
}`,
        },
      ];

      const review = await agent.reviewCode('PROJ-1', files);

      expect(review.overallSeverity).toBe('PASS');
      expect(review.findings.length).toBe(0);
      expect(review.blocksDeployment).toBe(false);
    });

    it('should detect hardcoded passwords', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/config.ts',
          content: 'const password = "admin123";',
        },
      ];

      const review = await agent.reviewCode('PROJ-1', files);

      expect(review.overallSeverity).toBe('CRITICAL');
      expect(review.findings.length).toBeGreaterThan(0);
      expect(review.findings.some((f) => f.severity === 'CRITICAL')).toBe(true);
      expect(review.blocksDeployment).toBe(true);
    });

    it('should detect hardcoded API keys', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/api.ts',
          content: 'const apiKey = "sk-1234567890abcdef";',
        },
      ];

      const review = await agent.reviewCode('PROJ-2', files);

      expect(review.findings.some((f) => f.category === 'SECRETS')).toBe(true);
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/database.ts',
          content: 'const query = `SELECT * FROM users WHERE id = ` + userId;',
        },
      ];

      const review = await agent.reviewCode('PROJ-3', files);

      expect(review.findings.some((f) => f.category === 'SQL_INJECTION')).toBe(true);
    });

    it('should detect XSS vulnerabilities', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/view.tsx',
          content:
            'function render(userInput: string) { return <div dangerouslySetInnerHTML={{__html: userInput}} />; }',
        },
      ];

      const review = await agent.reviewCode('PROJ-4', files);

      expect(review.findings.some((f) => f.category === 'XSS')).toBe(true);
    });

    it('should detect missing input validation', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/routes.ts',
          content:
            'app.post("/user", (req, res) => { const user = req.body; saveUser(user); res.send("OK"); });',
        },
      ];

      const review = await agent.reviewCode('PROJ-5', files);

      expect(review.findings.some((f) => f.category === 'VALIDATION')).toBe(true);
    });

    it('should detect sensitive data in logs', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/auth.ts',
          content: 'function login(password: string) { console.log("Password:", password); }',
        },
      ];

      const review = await agent.reviewCode('PROJ-6', files);

      expect(review.findings.some((f) => f.category === 'LOGGING')).toBe(true);
    });

    it('should scan multiple files', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        { path: 'src/file1.ts', content: 'const password = "secret";' },
        { path: 'src/file2.ts', content: 'const apiKey = "key123";' },
        { path: 'src/file3.ts', content: 'console.log(token);' },
      ];

      const review = await agent.reviewCode('PROJ-7', files);

      expect(review.findings.length).toBeGreaterThan(0);
    });

    it('should set blocksDeployment for CRITICAL severity', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/config.ts',
          content: 'const api_key = "super_secret_key_12345";',
        },
      ];

      const review = await agent.reviewCode('PROJ-8', files);

      expect(review.blocksDeployment).toBe(true);
    });

    it('should set blocksDeployment for HIGH severity', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/view.tsx',
          content: 'document.innerHTML = userInput;',
        },
      ];

      const review = await agent.reviewCode('PROJ-9', files);

      expect(review.blocksDeployment).toBe(true);
    });

    it('should not block deployment for MEDIUM/LOW issues', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        {
          path: 'src/routes.ts',
          content: 'app.get("/api/users", (req) => { return req.query; });',
        },
      ];

      const review = await agent.reviewCode('PROJ-10', files);

      expect(review.blocksDeployment).toBe(false);
    });

    it('should generate summary for findings', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        { path: 'src/app.ts', content: 'const password = "pwd123";' },
      ];

      const review = await agent.reviewCode('PROJ-11', files);

      expect(review.summary).toBeTruthy();
      expect(review.summary.length).toBeGreaterThan(0);
      expect(review.summary.toLowerCase()).toContain('critical');
    });

    it('should have correct review metadata', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        { path: 'src/app.ts', content: 'console.log("hello");' },
      ];

      const review = await agent.reviewCode('PROJ-12', files);

      expect(review.reviewId).toBeTruthy();
      expect(review.issueKey).toBe('PROJ-12');
      expect(review.timestamp).toBeTruthy();
    });

    it('should provide recommendations for each finding', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        { path: 'src/config.ts', content: 'const secret = "mySecret123";' },
      ];

      const review = await agent.reviewCode('PROJ-13', files);

      const secretFinding = review.findings.find((f) => f.category === 'SECRETS');
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.recommendation).toBeTruthy();
      expect(secretFinding?.recommendation.length).toBeGreaterThan(0);
    });

    it('should provide references for findings', async () => {
      const agent = new SecurityAnalystAgent();
      const files = [
        { path: 'src/app.ts', content: 'const password = "admin";' },
      ];

      const review = await agent.reviewCode('PROJ-14', files);

      expect(review.findings.some((f) => f.reference)).toBe(true);
    });
  });

  describe('correlation ID tracking', () => {
    it('should preserve correlation ID', async () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const agent = new SecurityAnalystAgent(correlationId);
      const files = [{ path: 'src/app.ts', content: 'console.log("safe");' }];

      const review = await agent.reviewCode('PROJ-15', files);

      expect(review).toBeDefined();
    });
  });
});
