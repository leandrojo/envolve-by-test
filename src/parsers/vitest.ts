import type { TestResult } from '../types.js';

/**
 * Parse Vitest output format (after stripping ANSI):
 *   Test Files  3 passed (3)
 *   Tests  15 passed (15)
 *
 * Or with failures:
 *   Test Files  1 failed | 2 passed (3)
 *   Tests  2 failed | 13 passed (15)
 */
export function parseVitestOutput(output: string): TestResult {
  // Strip ANSI escape codes
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');

  const filesLine =
    clean.match(/Test Files\s+.*/)?.[0] ?? '';
  const testsLine =
    clean.match(/(?:^|\n)\s*Tests\s+.*/)?.[0] ?? '';

  const suitesPassed = extractVitestNum(filesLine, 'passed');
  const suitesFailed = extractVitestNum(filesLine, 'failed');
  const testsPassed = extractVitestNum(testsLine, 'passed');
  const testsFailed = extractVitestNum(testsLine, 'failed');

  return {
    suitesPassed,
    suitesFailed,
    suitesTotal: suitesPassed + suitesFailed,
    testsPassed,
    testsFailed,
    testsTotal: testsPassed + testsFailed,
    raw: output,
  };
}

function extractVitestNum(line: string, keyword: string): number {
  const match = line.match(new RegExp(`(\\d+)\\s+${keyword}`));
  return match ? parseInt(match[1], 10) : 0;
}
