import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { configExists, loadConfig } from '../config.js';
import { isProviderInstalled } from '../core/provider.js';
import { runBaseline } from '../core/baseline.js';

interface Check {
  label: string;
  value: string;
  ok: boolean;
}

export async function doctorCommand(): Promise<void> {
  const projectDir = process.cwd();
  const checks: Check[] = [];

  console.log(chalk.cyan('\nenvolve-by-test doctor\n'));

  // 1. Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  checks.push({
    label: 'Node.js',
    value: nodeVersion,
    ok: nodeMajor >= 20,
  });

  // 2. Config exists
  const hasConfig = configExists(projectDir);
  checks.push({
    label: 'Config',
    value: hasConfig ? '.evolve/config.yaml' : 'not found',
    ok: hasConfig,
  });

  // 3. Test runner
  let runnerInfo = 'not detected';
  let runnerOk = false;

  if (hasConfig) {
    try {
      const config = loadConfig(projectDir);
      const framework = config.runners.unit.framework;
      const pkgPath = path.join(projectDir, 'package.json');

      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        const resolvedFramework =
          framework === 'auto'
            ? allDeps['vitest']
              ? 'vitest'
              : 'jest'
            : framework;

        const version = allDeps[resolvedFramework];
        if (version) {
          runnerInfo = `${resolvedFramework} ${version.replace(/^[\^~]/, '')}`;
          runnerOk = true;
        } else {
          runnerInfo = `${resolvedFramework} (not in dependencies)`;
        }
      }
    } catch {
      runnerInfo = 'config error';
    }
  }
  checks.push({ label: 'Test runner', value: runnerInfo, ok: runnerOk });

  // 4. Tests baseline
  let baselineInfo = 'skipped';
  let baselineOk = false;

  if (hasConfig && runnerOk) {
    try {
      const config = loadConfig(projectDir);
      const result = runBaseline(config, projectDir, 'unit');
      baselineInfo = `${result.testsPassed} passed, ${result.testsFailed} failed`;
      baselineOk = true;
    } catch (err) {
      baselineInfo = `error: ${(err as Error).message}`;
    }
  }
  checks.push({ label: 'Tests baseline', value: baselineInfo, ok: baselineOk });

  // 5-7. Agent providers
  for (const agent of ['claude', 'gemini', 'codex'] as const) {
    const installed = isProviderInstalled(agent);
    checks.push({
      label: `Agent: ${agent}`,
      value: installed ? 'installed' : 'not found',
      ok: installed,
    });
  }

  // 8. Git
  let gitInfo = 'not found';
  let gitOk = false;
  try {
    const gitVersion = execSync('git --version', {
      encoding: 'utf-8',
    }).trim();
    const match = gitVersion.match(/(\d+\.\d+\.\d+)/);
    gitInfo = match ? match[1] : gitVersion;
    gitOk = true;
  } catch {
    // Git not installed
  }
  checks.push({ label: 'Git', value: gitInfo, ok: gitOk });

  // 9. Domains
  let domainsInfo = 'not configured';
  let domainsOk = false;
  if (hasConfig) {
    try {
      const config = loadConfig(projectDir);
      const count = Object.keys(config.domains).length;
      domainsInfo = `${count} configured`;
      domainsOk = count > 0;
    } catch {
      domainsInfo = 'config error';
    }
  }
  checks.push({ label: 'Domains', value: domainsInfo, ok: domainsOk });

  // Print results
  const maxLabel = Math.max(...checks.map((c) => c.label.length));

  for (const check of checks) {
    const dots = '.'.repeat(maxLabel - check.label.length + 15);
    const icon = check.ok ? chalk.green('v') : chalk.red('x');
    console.log(`  ${check.label} ${dots} ${check.value} ${icon}`);
  }

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n  ${passed}/${checks.length} checks passed\n`);
}
