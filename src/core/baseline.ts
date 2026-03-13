import { execSync } from 'node:child_process';
import type { EvolveConfig, TestResult, TestLevel } from '../types.js';
import { parseTestOutput, detectFrameworkFromOutput } from '../parsers/index.js';

export function runBaseline(
  config: EvolveConfig,
  projectDir: string,
  level: TestLevel
): TestResult {
  const runner = level === 'e2e' ? config.runners.e2e : config.runners.unit;

  if (!runner) {
    throw new Error(`No runner configured for level: ${level}`);
  }

  const command = runner.command;

  let output: string;
  try {
    output = execSync(command, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000, // 5 min
    });
  } catch (err: unknown) {
    // Tests may exit with non-zero when there are failures — that's OK
    const execErr = err as { stdout?: string; stderr?: string };
    output = (execErr.stdout ?? '') + '\n' + (execErr.stderr ?? '');
  }

  const framework =
    runner.framework === 'auto'
      ? detectFrameworkFromOutput(output)
      : runner.framework;

  return parseTestOutput(framework, output);
}
