/**
 * Sanitization middleware to prevent prompt injection attacks
 * Strips dangerous patterns from external API responses before they reach LLM context
 */

import type { SanitizationReport } from '@/types/index';

const PROMPT_INJECTION_PATTERNS = [
  // Command-like prefixes
  /\{ignore[\s\S]*?\}/gi,
  /\[SYSTEM[\s]*OVERRIDE\]/gi,
  /USER[\s]*PROMPT[\s]*:/gi,
  /\[SYSTEM[\s]*\]/gi,
  /ignore[\s]*previous[\s]*instructions/gi,

  // Control characters that might indicate encoding attempts
  /[\x00-\x1F]/g,

  // Excessive Unicode homoglyphs (potential obfuscation)
  /[\u0430-\u044F]{50,}/g, // Cyrillic characters repeated
  /[\u05D0-\u05EA]{50,}/g, // Hebrew characters repeated

  // Script injection patterns
  /<script[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+[\s]*=/gi, // onclick=, onerror=, etc.

  // SQL injection patterns
  /('|(--)|([/*])|xp_|sp_)/gi,

  // Known jailbreak patterns from research
  /do[\s]*not[\s]*follow[\s]*instructions/gi,
  /override[\s]*instructions/gi,
  /bypass[\s]*safety/gi,
];

/**
 * Sanitize a string by removing prompt injection patterns
 */
export function sanitizeString(input: string): SanitizationReport {
  let sanitized = input;
  const patternsFound: string[] = [];
  let tokensRemoved = 0;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const matches = input.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        patternsFound.push(match);
        tokensRemoved += match.length;
      });
      sanitized = sanitized.replace(pattern, ' ');
    }
  }

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return {
    original: input,
    sanitized,
    patternsFound,
    tokensRemoved,
  };
}

/**
 * Sanitize a JSON object by applying sanitization to all string values
 */
export function sanitizeJson(obj: unknown): SanitizationReport {
  const reports: SanitizationReport[] = [];
  let stringified = JSON.stringify(obj, (_, value) => {
    if (typeof value === 'string') {
      const report = sanitizeString(value);
      reports.push(report);
      return report.sanitized;
    }
    return value;
  });

  return {
    original: JSON.stringify(obj),
    sanitized: stringified,
    patternsFound: reports.flatMap((r) => r.patternsFound),
    tokensRemoved: reports.reduce((sum, r) => sum + r.tokensRemoved, 0),
  };
}

/**
 * Remove JSON bloat: null values, empty arrays, self links, expand fields
 */
export function stripJsonBloat(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    const filtered = obj
      .map((item) => stripJsonBloat(item))
      .filter((item) => item !== undefined && item !== null);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip these fields
      if (['self', 'expand', '_links'].includes(key.toLowerCase())) {
        continue;
      }

      const cleaned = stripJsonBloat(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return obj;
}

/**
 * Combine sanitization and bloat stripping
 */
export function cleanExternalData(data: unknown): {
  data: unknown;
  sanitizationReport: SanitizationReport | null;
  bytesRemoved: number;
} {
  const beforeStr = JSON.stringify(data);
  const bloatStripped = stripJsonBloat(data);
  const sanitizationReport = sanitizeJson(bloatStripped);

  return {
    data: JSON.parse(sanitizationReport.sanitized),
    sanitizationReport,
    bytesRemoved: beforeStr.length - sanitizationReport.sanitized.length,
  };
}
