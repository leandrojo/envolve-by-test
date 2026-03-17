# envolve-by-test

[![npm version](https://img.shields.io/npm/v/envolve-by-test.svg)](https://www.npmjs.com/package/envolve-by-test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

AI-powered test-driven code evolution for TypeScript/JavaScript projects.

## The Concept: Test-Driven Code Evolution

The core idea is to use **tests as discovery instruments**, not just coverage metrics.

### The Problem

Every codebase accumulates blind spots — areas with complex logic that were never truly tested. These dormant bugs (edge cases, state violations, missing error handling) only surface in production, when the cost is high.

Writing tests manually to cover everything is expensive in time and cognitive effort. And even when tests are written, the tendency is to test the "happy path", not the dark corners of the code.

### The Approach

The proposal is to create a **continuous evolution loop** where an AI agent:

1. **Analyzes** the codebase and identifies gaps — complex files without tests, shallow tests, entire uncovered domains
2. **Formulates a hypothesis** — "this code snippet likely has a bug in this edge condition"
3. **Writes a test** that tries to prove that hypothesis
4. **If the test fails** (confirming the bug), **fixes the production code**
5. **Verifies** that no regressions were introduced
6. **Documents** what was found to give context to the next session

Each session attacks **a single weakness**, in a focused and incremental way. Quality is evaluated across three dimensions: **correctness** (logic and edge cases), **resilience** (error handling), and **consistency** (patterns across modules).

### The Philosophy

- **Tests are investigation tools**, not coverage bureaucracy
- **Incremental and verifiable improvement** — each cycle produces an atomic commit (test + fix together)
- **The agent thinks like a senior QA**, not a boilerplate generator — it hunts real bugs, not empty coverage
- **Built-in safety** — baseline tracking prevents regressions, protected files can't be touched, and everything is revertible

In short: an AI agent can **autonomously evolve** codebase quality, using tests as the mechanism for discovery and proof — an automated and intelligent "red-green-refactor" loop.

## Quick Start

```bash
cd your-project
npx envolve-by-test init      # Bootstrap .evolve/ with auto-detection
npx envolve-by-test doctor    # Verify prerequisites
npx envolve-by-test run       # Full evolution cycle
```

## Requirements

- **Node.js** >= 20
- **At least one AI agent CLI** installed: [`claude`](https://docs.anthropic.com/en/docs/claude-code), [`gemini`](https://github.com/google-gemini/gemini-cli), or [`codex`](https://github.com/openai/codex)
- **A test runner**: Jest, Vitest, or Playwright
- **Git** (for commit tracking)

## Commands

### `init` — Bootstrap your project

```bash
npx envolve-by-test init
```

Auto-detects your test runner, domains, and complexity signals. Creates a `.evolve/` directory with configuration, identity, and journal files.

### `run` — Execute evolution cycle

```bash
npx envolve-by-test run                                     # Full cycle (uses Claude by default)
npx envolve-by-test run --dry-run                           # Gap analysis only (no LLM)
npx envolve-by-test run --domain billing                    # Scoped to a domain
npx envolve-by-test run --model gemini-2.5-flash            # Use Gemini CLI
npx envolve-by-test run --model codex-mini                  # Use Codex CLI
npx envolve-by-test run --level e2e --domain onboarding     # E2E tests (Playwright)
```

### `domains` — Manage code domains

```bash
npx envolve-by-test domains                                 # List domains with stats
npx envolve-by-test domains --remap "organize by feature"   # Reorganize via AI
```

### `doctor` — Health check

```bash
npx envolve-by-test doctor
```

Verifies Node.js version, config validity, test runner, installed AI agents, Git, and domain paths.

## The Evolution Loop

Each session follows 6 steps:

1. **Baseline** — Run existing tests, capture pass/fail counts
2. **Gap Analysis** — Scan for untested files, rank by complexity (if/catch/throw/switch)
3. **Prompt** — Build context: identity, journal, baseline, gaps, test examples
4. **Agent** — AI reads the prompt, writes tests, discovers bugs, fixes code, commits
5. **Verification** — Re-run tests, compute delta (new tests, regressions)
6. **Journal** — Agent documents what was discovered in `.evolve/JOURNAL.md`

```
┌─────────────┐     ┌──────────────┐     ┌────────┐
│  1. Baseline │────>│ 2. Gap       │────>│ 3.     │
│  (run tests) │     │    Analysis  │     │ Prompt │
└─────────────┘     └──────────────┘     └───┬────┘
                                             │
┌─────────────┐     ┌──────────────┐     ┌───v────┐
│  6. Journal  │<────│ 5. Verify    │<────│ 4. AI  │
│  (document)  │     │    (delta)   │     │ Agent  │
└─────────────┘     └──────────────┘     └────────┘
```

## What Gets Created

```
.evolve/
  config.yaml       # Project configuration
  IDENTITY.md       # Agent identity and rules
  JOURNAL.md        # Global session journal
  journals/         # Domain-specific journals
```

## Configuration

`.evolve/config.yaml` is auto-generated by `init` and can be customized:

```yaml
project: "my-project"

runners:
  unit:
    framework: vitest        # jest | vitest | auto
    command: "npx vitest run"
    commandSingle: "npx vitest run {file}"
  e2e:                       # optional
    framework: playwright
    command: "npx playwright test"
    commandSingle: "npx playwright test {file}"

domains:
  billing:
    paths: [src/domains/billing]
  inbox:
    paths: [src/components/inbox]

extensions:
  source: [".ts", ".tsx"]
  test: [".test.ts", ".test.tsx", ".spec.ts"]
  ignore: [".stories.ts", ".stories.tsx", ".d.ts"]

complexitySignals:
  - { pattern: "\\bif\\b", label: "if" }
  - { pattern: "\\bcatch\\b", label: "catch" }
  - { pattern: "\\bthrow\\b", label: "throw" }
  - { pattern: "\\bswitch\\b", label: "switch" }

protectedFiles:
  - ".evolve/IDENTITY.md"
  - ".evolve/config.yaml"
  - "*.config.ts"

commitPrefix: "test({domain})"
```

## AI Provider Detection

The `--model` flag determines which CLI agent to invoke:

| Model prefix | Provider | CLI |
|---|---|---|
| `gemini*` | Gemini CLI | `gemini` |
| `o3*`, `o4*`, `gpt*`, `codex*` | Codex CLI | `codex` |
| *(default)* | Claude Code | `claude` |

Each provider must be installed and authenticated separately. envolve-by-test does not store or manage any credentials — it delegates to the installed CLI tools.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

### Development

```bash
git clone https://github.com/YOUR_USERNAME/envolve-by-test.git
cd envolve-by-test
npm install
npm run build        # Compile TypeScript
npm run dev          # Watch mode
```

## License

[MIT](LICENSE)
