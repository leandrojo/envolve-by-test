export interface RunnerConfig {
  framework: 'jest' | 'vitest' | 'playwright' | 'auto';
  command: string;
  commandSingle: string;
}

export interface DomainConfig {
  paths: string[];
}

export interface ComplexitySignal {
  pattern: string;
  label: string;
}

export interface EvolveConfig {
  project: string;
  runners: {
    unit: RunnerConfig;
    e2e?: RunnerConfig;
  };
  domains: Record<string, DomainConfig>;
  extensions: {
    source: string[];
    test: string[];
    ignore: string[];
  };
  complexitySignals: ComplexitySignal[];
  protectedFiles: string[];
  commitPrefix: string;
  gapAnalyses: string[];
}

export interface TestResult {
  suitesPassed: number;
  suitesFailed: number;
  suitesTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsTotal: number;
  raw: string;
}

export interface GapEntry {
  file: string;
  lines: number;
  signals: string;
}

export interface GapContext {
  untestedDomains: { name: string; sourceCount: number }[];
  complexityRanking: GapEntry[];
  shallowTests: { file: string; testCount: number; sourceLines: number }[];
  report: string;
}

export interface VerificationDelta {
  suitesDelta: number;
  testsDelta: number;
  failuresDelta: number;
}

export type Provider = 'claude' | 'gemini' | 'codex';
export type TestLevel = 'unit' | 'e2e';
