import * as fs from 'node:fs';

export function readJournalTail(
  journalPath: string,
  lines: number
): string {
  if (!fs.existsSync(journalPath)) return '';

  const content = fs.readFileSync(journalPath, 'utf-8');
  const allLines = content.split('\n');

  if (allLines.length <= lines) return content;

  return allLines.slice(-lines).join('\n');
}
