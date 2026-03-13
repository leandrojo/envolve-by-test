import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { parse } from 'yaml';
import { loadConfig, saveConfig } from '../config.js';
import { detectProvider, invokeProvider } from '../core/provider.js';

interface DomainsOptions {
  remap?: string;
  model?: string;
}

export async function domainsCommand(options: DomainsOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);

  if (options.remap) {
    await remapDomains(projectDir, options.remap, options.model);
    return;
  }

  // List domains with stats
  const domains = Object.entries(config.domains);

  if (domains.length === 0) {
    console.log(chalk.yellow('No domains configured.'));
    console.log(
      chalk.blue('->') +
        ' Run `envolve-by-test init` to auto-detect domains.'
    );
    return;
  }

  console.log(chalk.cyan('Configured domains:\n'));
  console.log(
    `  ${padRight('DOMAIN', 20)} ${padRight('SOURCES', 8)} ${padRight('TESTS', 8)} JOURNAL`
  );
  console.log(
    `  ${padRight('------', 20)} ${padRight('-------', 8)} ${padRight('-----', 8)} -------`
  );

  for (const [name, domainConfig] of domains) {
    let srcCount = 0;
    let testCount = 0;

    for (const p of domainConfig.paths) {
      const fullPath = path.join(projectDir, p);
      if (!fs.existsSync(fullPath)) continue;

      const files = walkDir(fullPath);
      for (const f of files) {
        if (
          f.endsWith('.test.ts') ||
          f.endsWith('.test.tsx') ||
          f.endsWith('.spec.ts')
        ) {
          testCount++;
        } else if (
          (f.endsWith('.ts') || f.endsWith('.tsx')) &&
          !f.endsWith('.stories.ts') &&
          !f.endsWith('.stories.tsx') &&
          !f.endsWith('.d.ts')
        ) {
          srcCount++;
        }
      }
    }

    const journalPath = path.join(
      projectDir,
      '.evolve',
      'journals',
      `${name}.md`
    );
    const journalMarker = fs.existsSync(journalPath) ? '●' : '';

    console.log(
      `  ${padRight(name, 20)} ${padRight(String(srcCount), 8)} ${padRight(String(testCount), 8)} ${journalMarker}`
    );
  }

  console.log('');
  console.log(
    chalk.blue('->') + ' ● = domain journal exists in .evolve/journals/'
  );
}

async function remapDomains(
  projectDir: string,
  instruction: string,
  model?: string
): Promise<void> {
  const config = loadConfig(projectDir);

  console.log(chalk.cyan('Remapping domains via AI...\n'));

  // Collect file tree
  const srcDir = path.join(projectDir, 'src');
  const fileTree = fs.existsSync(srcDir)
    ? walkDir(srcDir)
        .map((f) => path.relative(projectDir, f))
        .filter(
          (f) =>
            (f.endsWith('.ts') || f.endsWith('.tsx')) &&
            !f.endsWith('.d.ts') &&
            !f.endsWith('.stories.ts')
        )
        .join('\n')
    : '(no src/ directory found)';

  // Current domains YAML
  const currentDomainsYaml = Object.entries(config.domains)
    .map(([name, d]) => `  ${name}:\n    paths: [${d.paths.join(', ')}]`)
    .join('\n');

  const prompt = `You are reorganizing the domain mapping for a project.

## Current domains

\`\`\`yaml
domains:
${currentDomainsYaml}
\`\`\`

## File tree

\`\`\`
${fileTree}
\`\`\`

## Instruction

${instruction}

## Output format

Respond with ONLY a valid YAML block containing the new domains mapping, nothing else:

\`\`\`yaml
domains:
  domain-name:
    paths: [path/to/dir]
\`\`\`
`;

  const provider = detectProvider(model);
  const tmpFile = path.join(os.tmpdir(), `evolve-remap-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  let output: string;
  try {
    switch (provider) {
      case 'gemini':
        output = execSync(`gemini -y -m "${model}" -p "" < "${tmpFile}"`, {
          encoding: 'utf-8',
          shell: '/bin/bash',
        });
        break;
      case 'codex':
        output = execSync(
          `codex exec --full-auto -m "${model}" < "${tmpFile}"`,
          { encoding: 'utf-8', shell: '/bin/bash' }
        );
        break;
      default: {
        const modelArg = model ? `--model "${model}"` : '';
        const env = { ...process.env };
        delete env['CLAUDECODE'];
        output = execSync(
          `claude --print --dangerously-skip-permissions ${modelArg} < "${tmpFile}"`,
          { encoding: 'utf-8', shell: '/bin/bash', env }
        );
        break;
      }
    }
  } finally {
    fs.unlinkSync(tmpFile);
  }

  // Extract YAML from response
  const yamlMatch = output.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (!yamlMatch) {
    console.error(chalk.red('Could not parse AI response as YAML'));
    console.log(output);
    return;
  }

  const parsed = parse(yamlMatch[1]) as {
    domains?: Record<string, { paths: string[] }>;
  };

  if (!parsed?.domains) {
    console.error(chalk.red('Invalid domains format in AI response'));
    return;
  }

  // Show diff
  console.log(chalk.bold('Before:'));
  for (const [name, d] of Object.entries(config.domains)) {
    console.log(`  ${name}: ${d.paths.join(', ')}`);
  }

  console.log('');
  console.log(chalk.bold('After:'));
  for (const [name, d] of Object.entries(parsed.domains)) {
    console.log(`  ${name}: ${d.paths.join(', ')}`);
  }

  // Update config
  config.domains = parsed.domains;
  saveConfig(projectDir, config);

  console.log(`\n${chalk.green('v')} config.yaml updated with new domains.`);
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
