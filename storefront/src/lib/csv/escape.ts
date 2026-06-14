export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const s = String(value);
  const prefixed = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + prefixed.replace(/"/g, '""') + '"';
}
