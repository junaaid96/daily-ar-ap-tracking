export const CURRENCIES = [
  ['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['BDT', 'Bangladeshi Taka'], ['INR', 'Indian Rupee'],
  ['PKR', 'Pakistani Rupee'], ['AED', 'UAE Dirham'], ['SAR', 'Saudi Riyal'], ['MYR', 'Malaysian Ringgit'], ['SGD', 'Singapore Dollar'],
  ['CAD', 'Canadian Dollar'], ['AUD', 'Australian Dollar'], ['JPY', 'Japanese Yen'], ['CNY', 'Chinese Yuan'], ['NGN', 'Nigerian Naira'],
  ['KES', 'Kenyan Shilling'], ['IDR', 'Indonesian Rupiah'], ['TRY', 'Turkish Lira'], ['BRL', 'Brazilian Real'], ['ZAR', 'South African Rand'],
];

let currency = 'USD';
let fmt;
let fmtCompact;
export function setCurrency(code) {
  currency = code || 'USD';
  fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  fmtCompact = new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
}
setCurrency('USD');

export const getCurrency = () => currency;
export const money = (n) => fmt.format(Number(n) || 0);
export const moneyCompact = (n) => (Math.abs(n) >= 10000 ? fmtCompact.format(n) : money(n));
export const currencySymbol = () =>
  fmt.formatToParts(0).find((p) => p.type === 'currency')?.value || currency;

export const pct = (n, digits = 0) => `${(n * 100).toFixed(digits)}%`;

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dowFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });

const d = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
export const fmtDate = (iso) => (iso ? dateFmt.format(d(iso)) : '—');
export const fmtShort = (iso) => (iso ? shortFmt.format(d(iso)) : '—');
export const fmtMonth = (ym) => monthFmt.format(d(`${ym}-01`));
export const fmtMonthShort = (ym) => monthShortFmt.format(d(`${ym}-01`));
export const weekday = (iso) => dowFmt.format(d(iso));

export function todayISO() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
}
export function addDaysISO(iso, days) {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}
export const diffDays = (a, b) => Math.round((d(b) - d(a)) / 86_400_000);

/** "Today", "Yesterday", "Mon, Sep 22" style labels for grouped lists. */
export function dayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDaysISO(t, -1)) return 'Yesterday';
  if (iso === addDaysISO(t, 1)) return 'Tomorrow';
  return `${weekday(iso).slice(0, 3)}, ${fmtShort(iso)}`;
}

export function relativeDue(days) {
  if (days === null || days === undefined) return 'No due date';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return '1 day overdue';
  return `${-days} days overdue`;
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const AVATAR = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#eab308', '#ef4444'];
export const avatarColor = (s = '') => AVATAR[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];
