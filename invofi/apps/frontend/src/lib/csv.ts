// Escapes a single CSV field per RFC 4180: wraps in quotes if it contains a
// comma, quote, or newline, doubling any embedded quotes.
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Builds a CSV string from an array of objects, using `columns` to pick and
// order fields and label the header row.
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const headerRow = columns.map(c => escapeCsvField(c.header)).join(',');
  const dataRows = rows.map(row =>
    columns.map(c => escapeCsvField(row[c.key])).join(','),
  );
  return [headerRow, ...dataRows].join('\r\n');
}

// Triggers a browser download of `content` as a file named `filename`.
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
