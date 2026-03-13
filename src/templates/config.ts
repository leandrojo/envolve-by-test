import type { EvolveConfig } from '../types.js';
import type { DetectedRunner } from '../detection/runner.js';
import type { DetectedDomain } from '../detection/domains.js';
import type { ComplexitySignal } from '../types.js';

export function buildConfig(options: {
  projectName: string;
  runner: DetectedRunner;
  domains: DetectedDomain[];
  signals: ComplexitySignal[];
}): EvolveConfig {
  const { projectName, runner, domains, signals } = options;

  const domainMap: Record<string, { paths: string[] }> = {};
  for (const d of domains) {
    domainMap[d.name] = { paths: d.paths };
  }

  const runnerCommand =
    runner.framework === 'vitest'
      ? 'npx vitest run'
      : runner.framework === 'jest'
        ? 'npx jest'
        : 'npm test';

  const runnerCommandSingle =
    runner.framework === 'vitest'
      ? 'npx vitest run {file}'
      : runner.framework === 'jest'
        ? 'npx jest {file}'
        : 'npm test -- {file}';

  return {
    project: projectName,
    runners: {
      unit: {
        framework: runner.framework,
        command: runnerCommand,
        commandSingle: runnerCommandSingle,
      },
    },
    domains: domainMap,
    extensions: {
      source: ['.ts', '.tsx'],
      test: ['.test.ts', '.test.tsx', '.spec.ts'],
      ignore: ['.stories.ts', '.stories.tsx', '.d.ts'],
    },
    complexitySignals: signals,
    protectedFiles: [
      '.evolve/IDENTITY.md',
      '.evolve/config.yaml',
      '*.config.ts',
    ],
    commitPrefix: 'test({domain})',
    gapAnalyses: [],
  };
}
