import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig } from '../config.js';
import { runBaseline } from '../core/baseline.js';
import { analyzeGaps } from '../core/gap-analysis.js';
import { buildPrompt } from '../core/prompt-builder.js';
import { detectProvider, invokeProvider } from '../core/provider.js';
import { verify } from '../core/verification.js';
import type { TestLevel } from '../types.js';

interface RunOptions {
  dryRun: boolean;
  domain?: string;
  model?: string;
  level: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  const level = options.level as TestLevel;

  if (level !== 'unit' && level !== 'e2e') {
    console.error(chalk.red(`Invalid level: ${level} (must be 'unit' or 'e2e')`));
    process.exit(1);
  }

  // Validate domain
  if (options.domain && !config.domains[options.domain]) {
    console.error(chalk.red(`Unknown domain: ${options.domain}`));
    console.log(
      chalk.blue('->') +
        ` Available: ${Object.keys(config.domains).join(', ')}`
    );
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toTimeString().slice(0, 5);

  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan(`  ${config.project} Test Evolution — ${date} ${time}`));
  if (options.domain) console.log(chalk.cyan(`  Domain: ${options.domain}`));
  if (level === 'e2e') console.log(chalk.cyan(`  Level: E2E`));
  if (options.model) console.log(chalk.cyan(`  Model: ${options.model}`));
  console.log(chalk.cyan('='.repeat(60)));
  console.log('');

  if (options.dryRun) {
    console.log(chalk.yellow('Mode: DRY RUN (gap analysis only, no LLM)\n'));
  }

  // Save SHA for safe revert
  let sessionStartSha = '';
  try {
    sessionStartSha = execSync('git rev-parse HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Not a git repo — that's OK
  }

  // [1/6] Baseline
  console.log(chalk.yellow('[1/6] Running tests — capturing baseline...'));
  const baseline = runBaseline(config, projectDir, level);

  console.log('');
  console.log(
    `  Suites: ${chalk.green(`${baseline.suitesPassed} passed`)}, ${chalk.red(`${baseline.suitesFailed} failed`)}, ${baseline.suitesTotal} total`
  );
  console.log(
    `  Tests:  ${chalk.green(`${baseline.testsPassed} passed`)}, ${chalk.red(`${baseline.testsFailed} failed`)}, ${baseline.testsTotal} total`
  );
  console.log('');

  if (baseline.testsFailed > 0) {
    console.log(
      chalk.yellow(
        `! There are ${baseline.testsFailed} failing test(s). Evolution will proceed but must not increase failures.`
      )
    );
  }

  // [2/6] Gap analysis
  console.log(chalk.yellow('[2/6] Analyzing gaps...'));
  const gaps = analyzeGaps(config, projectDir, options.domain);

  console.log(`  Domains without tests: ${gaps.untestedDomains.length}`);
  console.log(`  Complexity ranking: done`);
  console.log(`  Shallow tests: ${gaps.shallowTests.length}`);
  console.log('');

  // [3/6] Build prompt
  console.log(chalk.yellow('[3/6] Building evolution prompt...'));
  const prompt = buildPrompt({
    config,
    projectDir,
    baseline,
    gapReport: gaps.report,
    domain: options.domain,
    level,
  });

  const promptLines = prompt.split('\n').length;
  console.log(chalk.green('v') + ` Prompt ready (${promptLines} lines)\n`);

  // [4/6] Dry run check
  if (options.dryRun) {
    console.log(chalk.yellow('[4/6] Dry run — showing gap report\n'));
    console.log(gaps.report);
    console.log('');
    console.log(
      chalk.blue('->') +
        ` To run full evolution: envolve-by-test run${options.domain ? ` --domain ${options.domain}` : ''}`
    );
    console.log('');
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('  Dry run complete'));
    console.log(chalk.cyan('='.repeat(60)));
    return;
  }

  // [5/6] Invoke LLM
  const provider = detectProvider(options.model);
  console.log(
    chalk.yellow(
      `[5/6] Invoking ${provider}${options.model ? ` (${options.model})` : ''}...`
    )
  );
  console.log('');

  invokeProvider(provider, options.model, prompt, projectDir);
  console.log('');

  // [6/6] Verification
  console.log(chalk.yellow('[6/6] Post-session verification...'));

  const { delta } = verify(config, projectDir, level, baseline);

  console.log('');
  console.log(chalk.bold('  Delta:'));

  if (delta.suitesDelta > 0) {
    console.log(chalk.green(`    Suites: +${delta.suitesDelta}`));
  } else {
    console.log(`    Suites: ${delta.suitesDelta}`);
  }

  if (delta.testsDelta > 0) {
    console.log(chalk.green(`    Tests:  +${delta.testsDelta}`));
  } else {
    console.log(`    Tests:  ${delta.testsDelta}`);
  }

  if (delta.failuresDelta > 0) {
    console.log(chalk.red(`    Failures: +${delta.failuresDelta} (regression!)`));
    if (sessionStartSha) {
      console.log(
        chalk.red(
          `    Consider reverting: git reset --soft ${sessionStartSha}`
        )
      );
    }
  } else if (delta.failuresDelta < 0) {
    console.log(chalk.green(`    Failures: ${delta.failuresDelta} (fixes!)`));
  } else {
    console.log('    Failures: 0 (stable)');
  }

  console.log('');
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan('  Evolution session complete'));
  if (sessionStartSha) {
    console.log(chalk.cyan(`  Revert SHA: ${sessionStartSha}`));
  }
  console.log(chalk.cyan('='.repeat(60)));
}
