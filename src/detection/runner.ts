import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DetectedRunner {
  framework: 'jest' | 'vitest' | 'playwright';
  version?: string;
  configFile?: string;
}

export function detectRunners(projectDir: string): {
  unit?: DetectedRunner;
  e2e?: DetectedRunner;
} {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {};
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const result: { unit?: DetectedRunner; e2e?: DetectedRunner } = {};

  // Detect unit test runner
  if (allDeps['vitest']) {
    const configFile = findConfigFile(projectDir, [
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mts',
      'vite.config.ts',
    ]);
    result.unit = {
      framework: 'vitest',
      version: cleanVersion(allDeps['vitest']),
      configFile,
    };
  } else if (allDeps['jest']) {
    const configFile = findConfigFile(projectDir, [
      'jest.config.ts',
      'jest.config.js',
      'jest.config.cjs',
      'jest.config.mjs',
    ]);
    result.unit = {
      framework: 'jest',
      version: cleanVersion(allDeps['jest']),
      configFile,
    };
  }

  // Detect E2E runner
  if (allDeps['@playwright/test'] || allDeps['playwright']) {
    const configFile = findConfigFile(projectDir, [
      'playwright.config.ts',
      'playwright.config.js',
    ]);
    result.e2e = {
      framework: 'playwright',
      version: cleanVersion(
        allDeps['@playwright/test'] || allDeps['playwright']
      ),
      configFile,
    };
  }

  return result;
}

function findConfigFile(
  projectDir: string,
  candidates: string[]
): string | undefined {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(projectDir, candidate))) {
      return candidate;
    }
  }
  return undefined;
}

function cleanVersion(ver: string): string {
  return ver.replace(/^[\^~>=<]+/, '');
}
