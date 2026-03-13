import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvolveConfig, GapContext } from '../types.js';

export function analyzeGaps(
  config: EvolveConfig,
  projectDir: string,
  domain?: string
): GapContext {
  const scanPaths = resolveScanPaths(config, projectDir, domain);

  const untestedDomains = findUntestedDomains(config, projectDir, domain);
  const complexityRanking = buildComplexityRanking(
    config,
    projectDir,
    scanPaths
  );
  const shallowTests = findShallowTests(config, projectDir, scanPaths);

  const report = buildReport(untestedDomains, complexityRanking, shallowTests);

  return { untestedDomains, complexityRanking, shallowTests, report };
}

function resolveScanPaths(
  config: EvolveConfig,
  projectDir: string,
  domain?: string
): string[] {
  if (domain) {
    const domainConfig = config.domains[domain];
    if (!domainConfig) {
      throw new Error(
        `Unknown domain: ${domain}. Available: ${Object.keys(config.domains).join(', ')}`
      );
    }
    return domainConfig.paths
      .map((p) => path.join(projectDir, p))
      .filter((p) => fs.existsSync(p));
  }

  // Scan all domain paths
  const paths: string[] = [];
  for (const d of Object.values(config.domains)) {
    for (const p of d.paths) {
      const full = path.join(projectDir, p);
      if (fs.existsSync(full)) paths.push(full);
    }
  }

  // If no domains configured, scan src/
  if (paths.length === 0) {
    const srcDir = path.join(projectDir, 'src');
    if (fs.existsSync(srcDir)) paths.push(srcDir);
  }

  return paths;
}

function findUntestedDomains(
  config: EvolveConfig,
  projectDir: string,
  domain?: string
): { name: string; sourceCount: number }[] {
  const result: { name: string; sourceCount: number }[] = [];
  const domains = domain
    ? { [domain]: config.domains[domain] }
    : config.domains;

  for (const [name, domainConfig] of Object.entries(domains)) {
    if (!domainConfig) continue;

    let sourceCount = 0;
    let testCount = 0;

    for (const p of domainConfig.paths) {
      const fullPath = path.join(projectDir, p);
      if (!fs.existsSync(fullPath)) continue;

      const files = walkFiles(fullPath);
      for (const f of files) {
        if (isTestFile(f, config)) {
          testCount++;
        } else if (isSourceFile(f, config) && !isIgnoredFile(f, config)) {
          sourceCount++;
        }
      }
    }

    if (testCount === 0 && sourceCount > 0) {
      result.push({ name, sourceCount });
    }
  }

  return result;
}

function buildComplexityRanking(
  config: EvolveConfig,
  projectDir: string,
  scanPaths: string[]
): { file: string; lines: number; signals: string }[] {
  const entries: { file: string; lines: number; signals: string }[] = [];

  for (const scanPath of scanPaths) {
    if (!fs.existsSync(scanPath)) continue;

    const files = walkFiles(scanPath);
    for (const filePath of files) {
      if (isTestFile(filePath, config)) continue;
      if (isIgnoredFile(filePath, config)) continue;
      if (!isSourceFile(filePath, config)) continue;
      if (path.basename(filePath) === 'index.ts') continue;

      // Check if test file exists
      if (hasTestFile(filePath, config)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const signals = countSignals(content, config);

      const relPath = path.relative(projectDir, filePath);
      entries.push({ file: relPath, lines, signals });
    }
  }

  // Sort by lines descending, take top 15
  entries.sort((a, b) => b.lines - a.lines);
  return entries.slice(0, 15);
}

function findShallowTests(
  config: EvolveConfig,
  projectDir: string,
  scanPaths: string[]
): { file: string; testCount: number; sourceLines: number }[] {
  const result: { file: string; testCount: number; sourceLines: number }[] = [];

  for (const scanPath of scanPaths) {
    if (!fs.existsSync(scanPath)) continue;

    const files = walkFiles(scanPath);
    for (const filePath of files) {
      if (!isTestFile(filePath, config)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const testBlockCount = (
        content.match(/^\s*(it|test)\s*\(/gm) || []
      ).length;

      if (testBlockCount < 5) {
        // Find corresponding source file
        const sourceFile = findSourceFile(filePath, config);
        if (sourceFile && fs.existsSync(sourceFile)) {
          const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
          const sourceLines = sourceContent.split('\n').length;
          if (sourceLines > 50) {
            const relPath = path.relative(projectDir, filePath);
            result.push({
              file: relPath,
              testCount: testBlockCount,
              sourceLines,
            });
          }
        }
      }
    }
  }

  return result;
}

function buildReport(
  untestedDomains: { name: string; sourceCount: number }[],
  complexityRanking: { file: string; lines: number; signals: string }[],
  shallowTests: { file: string; testCount: number; sourceLines: number }[]
): string {
  let report = '';

  report += '### Domains without tests\n\n';
  if (untestedDomains.length > 0) {
    for (const d of untestedDomains) {
      report += `- **${d.name}** — ${d.sourceCount} source files, 0 tests\n`;
    }
  } else {
    report += '_All domains have at least one test file._\n';
  }
  report += '\n';

  report += '### Complexity ranking (top 15 untested files)\n\n';
  report += '| File | Lines | Complexity signals |\n';
  report += '| ---- | ----- | ------------------ |\n';
  for (const entry of complexityRanking) {
    report += `| \`${entry.file}\` | ${entry.lines} | ${entry.signals} |\n`;
  }
  report += '\n';

  report += '### Shallow tests (files with <5 it/test blocks)\n\n';
  if (shallowTests.length > 0) {
    for (const s of shallowTests) {
      report += `- \`${s.file}\` — ${s.testCount} tests for ${s.sourceLines}-line source\n`;
    }
  } else {
    report += '_No shallow test files found._\n';
  }
  report += '\n';

  return report;
}

// --- Helpers ---

function walkFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const stat = fs.statSync(dir);
  if (stat.isFile()) return [dir];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function isSourceFile(filePath: string, config: EvolveConfig): boolean {
  return config.extensions.source.some((ext) => filePath.endsWith(ext));
}

function isTestFile(filePath: string, config: EvolveConfig): boolean {
  return config.extensions.test.some((ext) => filePath.endsWith(ext));
}

function isIgnoredFile(filePath: string, config: EvolveConfig): boolean {
  return config.extensions.ignore.some((ext) => filePath.endsWith(ext));
}

function hasTestFile(filePath: string, config: EvolveConfig): boolean {
  for (const srcExt of config.extensions.source) {
    if (!filePath.endsWith(srcExt)) continue;
    const base = filePath.slice(0, -srcExt.length);
    for (const testExt of config.extensions.test) {
      if (fs.existsSync(base + testExt)) return true;
    }
  }
  return false;
}

function findSourceFile(
  testFilePath: string,
  config: EvolveConfig
): string | undefined {
  for (const testExt of config.extensions.test) {
    if (!testFilePath.endsWith(testExt)) continue;
    const base = testFilePath.slice(0, -testExt.length);
    for (const srcExt of config.extensions.source) {
      const candidate = base + srcExt;
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function countSignals(content: string, config: EvolveConfig): string {
  const parts: string[] = [];

  for (const signal of config.complexitySignals) {
    const regex = new RegExp(signal.pattern, 'g');
    const count = (content.match(regex) || []).length;
    if (count > 0) {
      parts.push(`${signal.label}:${count}`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}
