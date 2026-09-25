const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows, columns) {
  const head = columns.map(([, label]) => cell(label)).join(',');
  const body = rows.map((r) => columns.map(([key]) => cell(r[key])).join(','));
  return [head, ...body].join('\r\n');
}
