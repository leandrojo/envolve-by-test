import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Provider } from '../types.js';

export function detectProvider(model?: string): Provider {
  if (!model) return 'claude';
  if (model.startsWith('gemini')) return 'gemini';
  if (/^(o3|o4|gpt|codex|openai)/.test(model)) return 'codex';
  return 'claude';
}

export function invokeProvider(
  provider: Provider,
  model: string | undefined,
  prompt: string,
  cwd: string
): void {
  // Write prompt to temp file
  const tmpFile = path.join(os.tmpdir(), `evolve-prompt-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  try {
    switch (provider) {
      case 'gemini': {
        execSync(`gemini -y -m "${model}" -p "" < "${tmpFile}"`, {
          cwd,
          stdio: 'inherit',
          shell: '/bin/bash',
        });
        break;
      }

      case 'codex': {
        execSync(`codex exec --full-auto -m "${model}" < "${tmpFile}"`, {
          cwd,
          stdio: 'inherit',
          shell: '/bin/bash',
        });
        break;
      }

      case 'claude': {
        const modelArg = model ? `--model "${model}"` : '';
        // Allow nested invocation when running inside a Claude Code session
        const env = { ...process.env };
        delete env['CLAUDECODE'];
        execSync(
          `claude --print --dangerously-skip-permissions ${modelArg} < "${tmpFile}"`,
          {
            cwd,
            stdio: 'inherit',
            shell: '/bin/bash',
            env,
          }
        );
        break;
      }
    }
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

export function isProviderInstalled(provider: Provider): boolean {
  const commands: Record<Provider, string> = {
    claude: 'claude',
    gemini: 'gemini',
    codex: 'codex',
  };

  try {
    execSync(`which ${commands[provider]}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}
