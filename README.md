# envolve-by-test

AI-powered test-driven code evolution for TypeScript/JavaScript projects.

Uses AI agents (Claude Code, Gemini CLI, Codex CLI) to autonomously improve codebases through tests. The loop: **baseline -> gap analysis -> prompt -> agent writes tests, discovers bugs, fixes, commits -> verification**.

## Quick Start

```bash
cd your-project
npx envolve-by-test init      # Bootstrap .evolve/ with auto-detection
npx envolve-by-test doctor    # Verify prerequisites
npx envolve-by-test run       # Full evolution cycle
```

## Commands

```bash
# Initialize
npx envolve-by-test init                                    # Bootstrap .evolve/

# Run evolution
npx envolve-by-test run                                     # Full cycle (uses Claude by default)
npx envolve-by-test run --dry-run                           # Gap analysis only (no LLM)
npx envolve-by-test run --domain billing                    # Scoped to a domain
npx envolve-by-test run --model gemini-3-flash-preview      # Use Gemini CLI
npx envolve-by-test run --model gpt-5.3-codex              # Use Codex CLI
npx envolve-by-test run --level e2e --domain onboarding    # E2E (Playwright)

# Manage domains
npx envolve-by-test domains                                 # List domains with stats
npx envolve-by-test domains --remap "organize by feature"   # Reorganize via AI

# Health check
npx envolve-by-test doctor                                  # Check prerequisites
```

## The Evolution Loop

Each session follows 6 steps:

1. **Baseline** — Run existing tests, capture pass/fail counts
2. **Gap Analysis** — Scan for untested files, complexity ranking, shallow tests
3. **Prompt** — Build context: identity, journal, baseline, gaps, examples
4. **Agent** — AI reads the prompt, writes tests, discovers bugs, fixes code, commits
5. **Verification** — Re-run tests, compute delta (new tests, regressions)
6. **Journal** — Agent documents what was discovered in `.evolve/JOURNAL.md`

## What Gets Created

```
.evolve/
  config.yaml       # Project configuration
  IDENTITY.md       # Agent identity and rules
  JOURNAL.md        # Global session journal
  journals/         # Domain-specific journals
```

## Configuration

`.evolve/config.yaml`:

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

The `--model` flag determines which CLI agent to use:

| Model prefix | Provider | Command |
|---|---|---|
| `gemini*` | Gemini CLI | `gemini -y -m MODEL -p "" < prompt` |
| `o3*`, `o4*`, `gpt*`, `codex*` | Codex CLI | `codex exec --full-auto -m MODEL < prompt` |
| (default) | Claude Code | `claude --print --dangerously-skip-permissions < prompt` |

## Requirements

- Node.js >= 20
- At least one AI agent CLI installed: `claude`, `gemini`, or `codex`
- A test runner: Jest, Vitest, or Playwright
- Git (for commit tracking)

## How It Works

The tool extracts a pattern proven in production at [Freshbase](https://freshbase.dev): autonomous AI agents that evolve codebases through test-driven quality. The approach found and fixed real bugs including:

- State machine guard violations
- Billing policy override bugs
- Time formatting edge cases with fractional seconds

The key insight: **tests as discovery tools**, not just coverage metrics. Each session makes ONE focused improvement, documents what was learned, and suggests what to explore next.

## License

MIT
