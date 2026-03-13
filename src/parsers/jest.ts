import type { TestResult } from '../types.js';

/**
 * Parse Jest output format:
 *   Test Suites: 2 failed, 19 passed, 21 total
 *   Tests:       5 failed, 95 passed, 100 total
 */
export function parseJestOutput(output: string): TestResult {
  const suitesLine =
    output.match(/^Test Suites:.*$/m)?.[0] ?? '';
  const testsLine =
    output.match(/^Tests:.*$/m)?.[0] ?? '';

  return {
    suitesPassed: extractNum(suitesLine, 'passed'),
    suitesFailed: extractNum(suitesLine, 'failed'),
    suitesTotal: extractNum(suitesLine, 'total'),
    testsPassed: extractNum(testsLine, 'passed'),
    testsFailed: extractNum(testsLine, 'failed'),
    testsTotal: extractNum(testsLine, 'total'),
    raw: output,
  };
}

function extractNum(line: string, keyword: string): number {
  const match = line.match(new RegExp(`(\\d+)\\s+${keyword}`));
  return match ? parseInt(match[1], 10) : 0;
}
