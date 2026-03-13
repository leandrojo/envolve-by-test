import type { EvolveConfig, TestResult, TestLevel, VerificationDelta } from '../types.js';
import { runBaseline } from './baseline.js';

export function verify(
  config: EvolveConfig,
  projectDir: string,
  level: TestLevel,
  before: TestResult
): { after: TestResult; delta: VerificationDelta } {
  const after = runBaseline(config, projectDir, level);

  const delta: VerificationDelta = {
    suitesDelta: after.suitesTotal - before.suitesTotal,
    testsDelta: after.testsPassed - before.testsPassed,
    failuresDelta: after.testsFailed - before.testsFailed,
  };

  return { after, delta };
}
