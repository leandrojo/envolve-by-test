import type { TestResult } from '../types.js';

/**
 * Parse Playwright output format:
 *   10 passed (15.2s)
 *   2 failed
 *   1 skipped
 */
export function parsePlaywrightOutput(output: string): TestResult {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');

  const passedMatch = clean.match(/(\d+)\s+passed/);
  const failedMatch = clean.match(/(\d+)\s+failed/);

  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;

  return {
    suitesPassed: passed > 0 ? 1 : 0,
    suitesFailed: failed > 0 ? 1 : 0,
    suitesTotal: 1,
    testsPassed: passed,
    testsFailed: failed,
    testsTotal: passed + failed,
    raw: output,
  };
}
