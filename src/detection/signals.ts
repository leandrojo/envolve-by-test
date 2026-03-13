import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ComplexitySignal } from '../types.js';

const BASE_SIGNALS: ComplexitySignal[] = [
  { pattern: '\\bif\\b', label: 'if' },
  { pattern: '\\bcatch\\b', label: 'catch' },
  { pattern: '\\bthrow\\b', label: 'throw' },
  { pattern: '\\bswitch\\b', label: 'switch' },
];

const REACT_SIGNALS: ComplexitySignal[] = [
  { pattern: '\\buseState\\b', label: 'useState' },
  { pattern: '\\buseEffect\\b', label: 'useEffect' },
  { pattern: '\\buseMemo\\b', label: 'useMemo' },
  { pattern: '\\buseCallback\\b', label: 'useCallback' },
];

const NODE_API_SIGNALS: ComplexitySignal[] = [
  { pattern: '\\bawait\\b', label: 'await' },
  { pattern: '\\.query\\b', label: 'query' },
  { pattern: '\\.transaction\\b', label: 'transaction' },
];

export function detectSignals(projectDir: string): ComplexitySignal[] {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return BASE_SIGNALS;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const signals = [...BASE_SIGNALS];

  // React preset
  if (allDeps['react'] || allDeps['next'] || allDeps['@remix-run/react']) {
    signals.push(...REACT_SIGNALS);
  }

  // Node API preset
  if (
    allDeps['express'] ||
    allDeps['hono'] ||
    allDeps['fastify'] ||
    allDeps['koa'] ||
    allDeps['@nestjs/core']
  ) {
    signals.push(...NODE_API_SIGNALS);
  }

  return signals;
}
