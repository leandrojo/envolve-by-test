import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, stringify } from 'yaml';
import type { EvolveConfig } from './types.js';

const CONFIG_PATH = '.evolve/config.yaml';

const DEFAULT_CONFIG: EvolveConfig = {
  project: '',
  runners: {
    unit: {
      framework: 'auto',
      command: 'npm test',
      commandSingle: 'npm test -- {file}',
    },
  },
  domains: {},
  extensions: {
    source: ['.ts', '.tsx'],
    test: ['.test.ts', '.test.tsx', '.spec.ts'],
    ignore: ['.stories.ts', '.stories.tsx', '.d.ts'],
  },
  complexitySignals: [
    { pattern: '\\bif\\b', label: 'if' },
    { pattern: '\\bcatch\\b', label: 'catch' },
    { pattern: '\\bthrow\\b', label: 'throw' },
    { pattern: '\\bswitch\\b', label: 'switch' },
  ],
  protectedFiles: [
    '.evolve/IDENTITY.md',
    '.evolve/config.yaml',
    '*.config.ts',
  ],
  commitPrefix: 'test({domain})',
  gapAnalyses: [],
};

export function getConfigPath(projectDir: string): string {
  return path.join(projectDir, CONFIG_PATH);
}

export function configExists(projectDir: string): boolean {
  return fs.existsSync(getConfigPath(projectDir));
}

export function loadConfig(projectDir: string): EvolveConfig {
  const configPath = getConfigPath(projectDir);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `.evolve/config.yaml not found. Run 'envolve-by-test init' first.`
    );
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = parse(raw) as Partial<EvolveConfig>;

  return mergeConfig(parsed);
}

export function saveConfig(projectDir: string, config: EvolveConfig): void {
  const configPath = getConfigPath(projectDir);
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, stringify(config, { lineWidth: 120 }), 'utf-8');
}

function mergeConfig(partial: Partial<EvolveConfig>): EvolveConfig {
  return {
    project: partial.project ?? DEFAULT_CONFIG.project,
    runners: {
      unit: {
        ...DEFAULT_CONFIG.runners.unit,
        ...partial.runners?.unit,
      },
      ...(partial.runners?.e2e ? { e2e: { ...partial.runners.e2e } } : {}),
    },
    domains: partial.domains ?? DEFAULT_CONFIG.domains,
    extensions: {
      ...DEFAULT_CONFIG.extensions,
      ...partial.extensions,
    },
    complexitySignals:
      partial.complexitySignals ?? DEFAULT_CONFIG.complexitySignals,
    protectedFiles: partial.protectedFiles ?? DEFAULT_CONFIG.protectedFiles,
    commitPrefix: partial.commitPrefix ?? DEFAULT_CONFIG.commitPrefix,
    gapAnalyses: partial.gapAnalyses ?? DEFAULT_CONFIG.gapAnalyses,
  };
}

export { DEFAULT_CONFIG };
