import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import chalk from 'chalk';
import { configExists, saveConfig } from '../config.js';
import { detectRunners } from '../detection/runner.js';
import { detectDomains } from '../detection/domains.js';
import { detectSignals } from '../detection/signals.js';
import { buildConfig } from '../templates/config.js';
import { generateIdentity } from '../templates/identity.js';
import { generateJournalHeader } from '../templates/journal.js';

export async function initCommand(): Promise<void> {
  const projectDir = process.cwd();
  const evolveDir = path.join(projectDir, '.evolve');

  if (configExists(projectDir)) {
    console.log(
      chalk.yellow('! .evolve/config.yaml already exists. Use --force to reinitialize.')
    );
    return;
  }

  console.log(chalk.cyan('Initializing .evolve/ for test evolution...\n'));

  // 1. Detect project name
  const pkgPath = path.join(projectDir, 'package.json');
  let projectName = path.basename(projectDir);
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    projectName = pkg.name?.replace(/^@[^/]+\//, '') ?? projectName;
  }

  console.log(chalk.blue('->') + ` Project: ${chalk.bold(projectName)}`);

  // 2. Detect test runner
  const runners = detectRunners(projectDir);
  if (runners.unit) {
    console.log(
      chalk.blue('->') +
        ` Unit runner: ${chalk.bold(runners.unit.framework)}` +
        (runners.unit.version ? ` v${runners.unit.version}` : '') +
        (runners.unit.configFile ? ` (${runners.unit.configFile})` : '')
    );
  } else {
    console.log(chalk.yellow('! No unit test runner detected'));
  }

  if (runners.e2e) {
    console.log(
      chalk.blue('->') +
        ` E2E runner: ${chalk.bold(runners.e2e.framework)}` +
        (runners.e2e.version ? ` v${runners.e2e.version}` : '')
    );
  }

  // 3. Detect domains
  const domains = detectDomains(projectDir);
  console.log(
    chalk.blue('->') + ` Domains detected: ${chalk.bold(String(domains.length))}`
  );
  for (const d of domains.slice(0, 10)) {
    console.log(`   ${d.name} -> ${d.paths.join(', ')}`);
  }
  if (domains.length > 10) {
    console.log(`   ... and ${domains.length - 10} more`);
  }

  // 4. Detect complexity signals
  const signals = detectSignals(projectDir);
  console.log(
    chalk.blue('->') +
      ` Complexity signals: ${signals.map((s) => s.label).join(', ')}`
  );

  console.log('');

  // 5. Confirm
  const confirmed = await confirm('Create .evolve/ with these settings?');
  if (!confirmed) {
    console.log(chalk.yellow('Cancelled.'));
    return;
  }

  // 6. Build config
  const config = buildConfig({
    projectName,
    runner: runners.unit ?? { framework: 'jest' },
    domains,
    signals,
  });

  // 7. Create .evolve directory structure
  fs.mkdirSync(evolveDir, { recursive: true });
  fs.mkdirSync(path.join(evolveDir, 'journals'), { recursive: true });

  // 8. Write files
  saveConfig(projectDir, config);
  console.log(chalk.green('v') + ' .evolve/config.yaml');

  const identityContent = generateIdentity(config);
  fs.writeFileSync(
    path.join(evolveDir, 'IDENTITY.md'),
    identityContent,
    'utf-8'
  );
  console.log(chalk.green('v') + ' .evolve/IDENTITY.md');

  const journalContent = generateJournalHeader(projectName);
  fs.writeFileSync(
    path.join(evolveDir, 'JOURNAL.md'),
    journalContent,
    'utf-8'
  );
  console.log(chalk.green('v') + ' .evolve/JOURNAL.md');

  console.log(
    `\n${chalk.green('Done!')} Run ${chalk.cyan('envolve-by-test doctor')} to verify prerequisites.`
  );
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [Y/n] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}
