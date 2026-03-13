#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { domainsCommand } from './commands/domains.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('envolve-by-test')
  .description('AI-powered test-driven code evolution')
  .version('0.1.0');

program
  .command('init')
  .description('Bootstrap .evolve/ directory with auto-detection')
  .action(async () => {
    await initCommand();
  });

program
  .command('run')
  .description('Run a full evolution cycle')
  .option('--dry-run', 'Gap analysis only, no LLM invocation')
  .option('--domain <name>', 'Scope to a specific domain')
  .option('--model <model>', 'AI model to use (determines provider)')
  .option('--level <level>', 'Test level: unit or e2e', 'unit')
  .action(async (options) => {
    await runCommand({
      dryRun: options.dryRun ?? false,
      domain: options.domain,
      model: options.model,
      level: options.level,
    });
  });

program
  .command('domains')
  .description('List configured domains with stats')
  .option('--remap <instruction>', 'Reorganize domains via AI')
  .option('--model <model>', 'AI model for remap')
  .action(async (options) => {
    await domainsCommand({
      remap: options.remap,
      model: options.model,
    });
  });

program
  .command('doctor')
  .description('Check prerequisites and configuration')
  .action(async () => {
    await doctorCommand();
  });

program.parse();
