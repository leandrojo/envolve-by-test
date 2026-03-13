import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DetectedDomain {
  name: string;
  paths: string[];
}

const DOMAIN_PATTERNS = [
  'src/domains',
  'src/features',
  'src/modules',
  'src/services',
  'lib',
  'src/lib',
  'src/components',
];

export function detectDomains(projectDir: string): DetectedDomain[] {
  const domains: DetectedDomain[] = [];
  const seen = new Set<string>();

  for (const pattern of DOMAIN_PATTERNS) {
    const fullPath = path.join(projectDir, pattern);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      continue;
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;

      const name = entry.name;
      if (seen.has(name)) continue;
      seen.add(name);

      const relativePath = path.join(pattern, name);
      domains.push({ name, paths: [relativePath] });
    }
  }

  // Sort alphabetically
  domains.sort((a, b) => a.name.localeCompare(b.name));

  return domains;
}
