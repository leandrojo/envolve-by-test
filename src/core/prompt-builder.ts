import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvolveConfig, TestResult, TestLevel } from '../types.js';
import { readJournalTail } from './journal.js';

export interface PromptOptions {
  config: EvolveConfig;
  projectDir: string;
  baseline: TestResult;
  gapReport: string;
  domain?: string;
  level: TestLevel;
}

export function buildPrompt(options: PromptOptions): string {
  const { config, projectDir, baseline, gapReport, domain, level } = options;

  const identityPath = path.join(projectDir, '.evolve', 'IDENTITY.md');
  const identity = fs.existsSync(identityPath)
    ? fs.readFileSync(identityPath, 'utf-8')
    : '_No IDENTITY.md found._';

  // Journal context
  const journalFile = domain
    ? path.join(projectDir, '.evolve', 'journals', `${domain}.md`)
    : path.join(projectDir, '.evolve', 'JOURNAL.md');

  const journalContext = fs.existsSync(journalFile)
    ? readJournalTail(journalFile, 80)
    : '_No previous sessions._';

  // Global journal cross-reference in domain mode
  let globalJournalContext = '';
  if (domain) {
    const globalJournal = path.join(projectDir, '.evolve', 'JOURNAL.md');
    if (fs.existsSync(globalJournal)) {
      globalJournalContext = `## Global Journal (recent context)\n\n${readJournalTail(globalJournal, 20)}`;
    }
  }

  // Example tests
  const exampleContent = findExampleTests(config, projectDir, domain);

  // Test runner config content
  const runnerConfigContent = readRunnerConfig(config, projectDir, level);

  // Domain constraint
  const domainConstraint = domain
    ? `- **Domain scope:** Only work on files in: ${config.domains[domain]?.paths.join(', ') ?? domain}`
    : '';

  // Journal instruction
  const journalInstruction = domain
    ? `9. **Update** \`.evolve/journals/${domain}.md\` with session details using the format from IDENTITY.md (create if needed)`
    : `9. **Update** \`.evolve/JOURNAL.md\` with session details using the format from IDENTITY.md`;

  // Test commands
  const runner = level === 'e2e' ? config.runners.e2e : config.runners.unit;
  const testRunCmd = runner?.commandSingle ?? runner?.command ?? 'npm test';
  const testAllCmd = runner?.command ?? 'npm test';

  // Commit prefix
  const commitPrefix = config.commitPrefix.replace(
    '{domain}',
    domain ?? config.project
  );

  // Protected files
  const protectedList = config.protectedFiles
    .map((f) => `\`${f}\``)
    .join(', ');

  return `# ${config.project} Test Evolution Session${domain ? ` — Domain: ${domain}` : ''}${level === 'e2e' ? ' — Level: E2E' : ''}

You are the ${config.project} Test Evolution Agent. Your job is to improve the project through test-driven quality.

## Your Identity

${identity}

## Recent Journal (${domain ? `domain:${domain}` : 'global'})

${journalContext}

${globalJournalContext}

## Current Baseline

- Suites: ${baseline.suitesPassed} passed, ${baseline.suitesFailed} failed (${baseline.suitesTotal} total)
- Tests: ${baseline.testsPassed} passed, ${baseline.testsFailed} failed (${baseline.testsTotal} total)

## Gap Report

${gapReport}

${runnerConfigContent}

## Example Tests (for style reference)

${exampleContent}

## Your Task

1. **Read the gap report** and pick ONE weakness to address
2. **Explore the source code** of the target area (read the actual files)
3. **Hypothesize** what could be wrong or untested
4. **Write a test** that exposes the problem
5. **Run the test** with \`${testRunCmd}\`
6. **If test fails due to a real bug:** Fix the production code, then run the test again
7. **Run ALL tests** with \`${testAllCmd}\` to verify nothing broke
8. **Commit** test + fix together: \`git add <files> && git commit -m "${commitPrefix}: description"\`
${journalInstruction}

## Important

- Make **ONE focused improvement** — don't try to cover an entire domain
- The test should reveal something real, not just exercise happy paths
- If fixing code, commit test + fix together (the test documents the WHY)
- If the fix is too large, write the test (even if failing) and document as tech debt
- **Never modify:** ${protectedList}
- **Do not** increase the number of failing tests
${domainConstraint}
- Working directory: ${projectDir}

Begin your analysis now.
`;
}

function findExampleTests(
  config: EvolveConfig,
  projectDir: string,
  domain?: string
): string {
  const searchPaths: string[] = [];

  if (domain && config.domains[domain]) {
    for (const p of config.domains[domain].paths) {
      searchPaths.push(path.join(projectDir, p));
    }
  }

  // Also search src/ as fallback
  searchPaths.push(path.join(projectDir, 'src'));

  const testFiles: string[] = [];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    collectTestFiles(searchPath, config, testFiles);
    if (testFiles.length >= 2) break;
  }

  if (testFiles.length === 0) return '_No example tests found._';

  let content = '';
  for (const testFile of testFiles.slice(0, 2)) {
    const relPath = path.relative(projectDir, testFile);
    const fileContent = fs.readFileSync(testFile, 'utf-8');
    content += `### ${relPath}\n\n\`\`\`typescript\n${fileContent}\n\`\`\`\n\n`;
  }

  return content;
}

function collectTestFiles(
  dir: string,
  config: EvolveConfig,
  results: string[]
): void {
  if (results.length >= 2) return;
  if (!fs.existsSync(dir)) return;

  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (config.extensions.test.some((ext) => dir.endsWith(ext))) {
      results.push(dir);
    }
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, config, results);
    } else if (config.extensions.test.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
    if (results.length >= 2) return;
  }
}

function readRunnerConfig(
  config: EvolveConfig,
  projectDir: string,
  level: TestLevel
): string {
  const runner = level === 'e2e' ? config.runners.e2e : config.runners.unit;
  if (!runner) return '';

  const configFile = findRunnerConfigFile(runner.framework, projectDir);
  if (!configFile) return '';

  const content = fs.readFileSync(configFile, 'utf-8');
  const ext = path.extname(configFile).slice(1);
  const label =
    runner.framework === 'vitest'
      ? 'Vitest'
      : runner.framework === 'jest'
        ? 'Jest'
        : 'Playwright';

  return `## ${label} Configuration\n\n\`\`\`${ext}\n${content}\n\`\`\``;
}

function findRunnerConfigFile(
  framework: string,
  projectDir: string
): string | undefined {
  const candidates: Record<string, string[]> = {
    vitest: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'],
    jest: ['jest.config.ts', 'jest.config.js', 'jest.config.cjs', 'jest.config.mjs'],
    playwright: ['playwright.config.ts', 'playwright.config.js'],
  };

  for (const file of candidates[framework] ?? []) {
    const full = path.join(projectDir, file);
    if (fs.existsSync(full)) return full;
  }

  return undefined;
}
