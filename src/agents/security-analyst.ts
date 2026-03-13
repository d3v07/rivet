/**
 * Security Analyst Agent: Reviews code for vulnerabilities and compliance
 * Scans for OWASP Top 10, secrets, auth issues, and generates security findings
 */

import { createCorrelationId, logInfo, logError } from '@/lib/logger';
import { z } from 'zod';

/**
 * Security finding with severity and recommendation
 */
const SecurityFindingSchema = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum([
    'SQL_INJECTION',
    'XSS',
    'AUTH',
    'SECRETS',
    'VALIDATION',
    'LOGGING',
    'DEPENDENCY',
    'OTHER',
  ]),
  location: z.string(),
  issue: z.string(),
  recommendation: z.string(),
  reference: z.string().optional(),
});

export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

const SecurityReviewSchema = z.object({
  reviewId: z.string(),
  issueKey: z.string(),
  timestamp: z.string(),
  overallSeverity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASS']),
  findings: z.array(SecurityFindingSchema),
  summary: z.string(),
  blocksDeployment: z.boolean(),
});

export type SecurityReview = z.infer<typeof SecurityReviewSchema>;

/**
 * Security Analyst Agent: Scans code for vulnerabilities
 */
export class SecurityAnalystAgent {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || createCorrelationId();
  }

  /**
   * Review code for security issues
   */
  async reviewCode(
    issueKey: string,
    files: Array<{ path: string; content: string }>
  ): Promise<SecurityReview> {
    const startTime = Date.now();

    logInfo('SecurityAnalyst: starting code review', {
      correlationId: this.correlationId,
      issueKey,
      fileCount: files.length,
    });

    try {
      const findings: SecurityFinding[] = [];

      // Scan each file for security issues
      for (const file of files) {
        const fileFindings = await this.scanFile(file.path, file.content, issueKey);
        findings.push(...fileFindings);
      }

      // Determine overall severity
      const overallSeverity = this.determineOverallSeverity(findings);
      const blocksDeployment = overallSeverity === 'CRITICAL' || overallSeverity === 'HIGH';

      const review: SecurityReview = {
        reviewId: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        issueKey,
        timestamp: new Date().toISOString(),
        overallSeverity,
        findings,
        summary: this.generateSummary(findings, overallSeverity),
        blocksDeployment,
      };

      logInfo('SecurityAnalyst: review completed', {
        correlationId: this.correlationId,
        issueKey,
        findingCount: findings.length,
        overallSeverity,
        duration: Date.now() - startTime,
      });

      return review;
    } catch (error) {
      logError(
        'SecurityAnalyst: review failed',
        { correlationId: this.correlationId },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Scan a single file for security issues
   */
  private async scanFile(
    path: string,
    content: string,
    _issueKey: string
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for hardcoded secrets
    findings.push(...this.checkSecrets(path, content));

    // Check for SQL injection vulnerabilities
    findings.push(...this.checkSqlInjection(path, content));

    // Check for XSS vulnerabilities
    findings.push(...this.checkXss(path, content));

    // Check for authentication issues
    findings.push(...this.checkAuth(path, content));

    // Check for validation issues
    findings.push(...this.checkValidation(path, content));

    // Check for logging issues
    findings.push(...this.checkLogging(path, content));

    return findings;
  }

  /**
   * Check for hardcoded secrets
   */
  private checkSecrets(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Look for common secret patterns
    const secretPatterns = [
      {
        pattern: /(['"])(password|passwd|pwd)(['"])\s*[:=]\s*['"][^'"]+['"]/gi,
        name: 'Hardcoded password',
      },
      {
        pattern: /(['"])(api[-_]?key|apikey)(['"])\s*[:=]\s*['"][^'"]+['"]/gi,
        name: 'Hardcoded API key',
      },
      {
        pattern: /(['"])(token|secret)(['"])\s*[:=]\s*['"][^'"]+['"]/gi,
        name: 'Hardcoded token/secret',
      },
      {
        pattern: /(['"])(client[-_]?secret)(['"])\s*[:=]\s*['"][^'"]+['"]/gi,
        name: 'Hardcoded client secret',
      },
    ];

    secretPatterns.forEach((p) => {
      if (p.pattern.test(content)) {
        findings.push({
          severity: 'CRITICAL',
          category: 'SECRETS',
          location: path,
          issue: p.name + ' detected in code',
          recommendation:
            'Move secrets to environment variables or secret manager (e.g., GCP Secret Manager)',
          reference: 'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
        });
      }
    });

    return findings;
  }

  /**
   * Check for SQL injection vulnerabilities
   */
  private checkSqlInjection(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Look for string concatenation in SQL queries
    const sqlPatterns = [
      /sql\s*[`'"]+\s*\+\s*/gi,
      /query\s*=\s*[`'"][^`'"]*"\s*\+\s*/gi,
      /execute\s*\(\s*[`'"][^`'"]*"\s*\+\s*/gi,
    ];

    sqlPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        findings.push({
          severity: 'CRITICAL',
          category: 'SQL_INJECTION',
          location: path,
          issue: 'Potential SQL injection: string concatenation in query',
          recommendation:
            'Use parameterized queries or ORM with proper escaping. Never concatenate user input.',
          reference: 'https://owasp.org/www-community/attacks/SQL_Injection',
        });
      }
    });

    return findings;
  }

  /**
   * Check for XSS vulnerabilities
   */
  private checkXss(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Look for unsafe innerHTML assignment
    if (/innerHTML\s*=|\.html\s*\(\s*[^)]*req/gi.test(content)) {
      findings.push({
        severity: 'HIGH',
        category: 'XSS',
        location: path,
        issue: 'Potential XSS: unsafe innerHTML or html() with user input',
        recommendation:
          'Use textContent or DOM methods. Sanitize user input with DOMPurify or similar.',
        reference: 'https://owasp.org/www-community/attacks/xss/',
      });
    }

    // Look for rendering user input without escaping
    if (/dangerouslySetInnerHTML|v-html|ng-bind-html/i.test(content)) {
      findings.push({
        severity: 'HIGH',
        category: 'XSS',
        location: path,
        issue: 'Potentially unsafe HTML rendering without sanitization',
        recommendation: 'Ensure user input is properly sanitized before rendering.',
        reference: 'https://owasp.org/www-community/attacks/xss/',
      });
    }

    return findings;
  }

  /**
   * Check for authentication issues
   */
  private checkAuth(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check for missing token validation
    if (/route|endpoint|handler/.test(path) && !/jwt|token|auth|permission|role/i.test(content)) {
      // Simple heuristic: endpoints without auth-related code might be unprotected
      // This is a low-confidence check
    }

    // Check for weak password policies
    if (/password|pwd|pass/.test(content) && !/length.*8|minLength|strength/i.test(content)) {
      findings.push({
        severity: 'MEDIUM',
        category: 'AUTH',
        location: path,
        issue: 'Password validation may be weak or missing',
        recommendation:
          'Enforce minimum password length (12+), complexity requirements, and use password managers.',
        reference: 'https://owasp.org/www-community/controls/Password_Strength_Controls',
      });
    }

    return findings;
  }

  /**
   * Check for validation issues
   */
  private checkValidation(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check for missing input validation
    if (
      /req\.body|req\.query|req\.params|req\.headers/.test(content) &&
      !/validate|zod|joi|yup/i.test(content)
    ) {
      findings.push({
        severity: 'MEDIUM',
        category: 'VALIDATION',
        location: path,
        issue: 'External input received without apparent validation',
        recommendation: 'Use schema validation (Zod, Joi, Yup) for all external inputs.',
        reference: 'https://owasp.org/www-community/attacks/injection',
      });
    }

    return findings;
  }

  /**
   * Check for logging issues
   */
  private checkLogging(path: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check for logging of sensitive data
    if (/(log|console|debug|warn|error).*password|token|secret|key|auth/i.test(content)) {
      findings.push({
        severity: 'HIGH',
        category: 'LOGGING',
        location: path,
        issue: 'Sensitive data may be logged (password, token, secret)',
        recommendation: 'Never log sensitive data. Mask or redact before logging.',
        reference: 'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
      });
    }

    return findings;
  }

  /**
   * Determine overall severity
   */
  private determineOverallSeverity(
    findings: SecurityFinding[]
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS' {
    if (findings.length === 0) return 'PASS';

    const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
    if (hasCritical) return 'CRITICAL';

    const hasHigh = findings.some((f) => f.severity === 'HIGH');
    if (hasHigh) return 'HIGH';

    const hasMedium = findings.some((f) => f.severity === 'MEDIUM');
    if (hasMedium) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(findings: SecurityFinding[], severity: string): string {
    if (findings.length === 0) {
      return 'No security issues found. Code is safe to deploy.';
    }

    const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
    const high = findings.filter((f) => f.severity === 'HIGH').length;
    const medium = findings.filter((f) => f.severity === 'MEDIUM').length;
    const low = findings.filter((f) => f.severity === 'LOW').length;

    let summary = `Found ${findings.length} security issues: `;
    const parts = [];
    if (critical > 0) parts.push(`${critical} CRITICAL`);
    if (high > 0) parts.push(`${high} HIGH`);
    if (medium > 0) parts.push(`${medium} MEDIUM`);
    if (low > 0) parts.push(`${low} LOW`);

    summary += parts.join(', ');

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      summary += '. DEPLOYMENT BLOCKED: Fix critical/high-severity issues before deploying.';
    }

    return summary;
  }
}
