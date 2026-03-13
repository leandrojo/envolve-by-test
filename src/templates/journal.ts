export function generateJournalHeader(projectName: string): string {
  return `# ${projectName} — Test Evolution Journal

This journal documents each evolution session — what was discovered, tested, fixed, and learned.

---

`;
}

export function generateDomainJournalHeader(
  domainName: string
): string {
  const capitalized = domainName.charAt(0).toUpperCase() + domainName.slice(1);
  return `# ${capitalized} Domain — Test Evolution Journal

---

`;
}
