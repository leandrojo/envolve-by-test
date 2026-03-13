import type { TestResult } from '../types.js';
import { parseJestOutput } from './jest.js';
import { parseVitestOutput } from './vitest.js';
import { parsePlaywrightOutput } from './playwright.js';

const parsers: Record<string, (output: string) => TestResult> = {
  jest: parseJestOutput,
  vitest: parseVitestOutput,
  playwright: parsePlaywrightOutput,
};

export function parseTestOutput(
  framework: string,
  output: string
): TestResult {
  const parser = parsers[framework];
  if (!parser) {
    throw new Error(`Unknown test framework: ${framework}. Supported: ${Object.keys(parsers).join(', ')}`);
  }
  return parser(output);
}

/**
 * Auto-detect framework from output content.
 */
export function detectFrameworkFromOutput(output: string): string {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');

  if (/^Test Suites:/m.test(clean)) return 'jest';
  if (/Test Files\s+/m.test(clean)) return 'vitest';
  if (/\d+\s+passed\s+\([\d.]+s\)/.test(clean)) return 'playwright';

  return 'jest'; // fallback
}
