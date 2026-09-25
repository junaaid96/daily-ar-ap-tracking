/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Advance a date by a recurrence step, clamping month-ends (Jan 31 -> Feb 28). */
export function advance(iso, frequency, every = 1, anchorDay) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + every);
  else if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * every);
  else {
    const months = frequency === 'monthly' ? every : 12 * every;
    const day = anchorDay ?? d.getUTCDate();
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days: end.getUTCDate() };
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
