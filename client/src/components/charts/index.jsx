import { money, moneyCompact, fmtShort } from '../../lib/format.js';
import { cx } from '../ui/index.jsx';

export const axis = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
};
export const grid = { stroke: 'var(--line)', strokeDasharray: undefined, vertical: false };
export const yMoney = { ...axis, tickFormatter: (v) => moneyCompact(v), width: 64 };

/** Recharts tooltip content in our card style. rows: [{ key, label, color }] */
export function ChartTip({ active, payload, label, rows, labelFormat = fmtShort, footer }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-ink">{labelFormat(label ?? p.date)}</p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <span className="num font-semibold text-ink">{money(p[r.key])}</span>
        </div>
      ))}
      {footer?.(p)}
    </div>
  );
}

export function Legend({ items, className }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted', className)}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cx('rounded-full', i.line ? 'h-0.5 w-3' : 'size-2')} style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

/** Ranked horizontal bars — clearer than a donut for "where did the money go". */
export function RankedBars({ items, total, max = 6, onSelect }) {
  const top = items.slice(0, max);
  const rest = items.slice(max);
  const rows = rest.length ? [...top, { id: 'other', name: `Other (${rest.length})`, color: '#94a3b8', total: rest.reduce((s, r) => s + r.total, 0) }] : top;
  const peak = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id || r.name}>
          <button type="button" onClick={() => onSelect?.(r)} className={cx('w-full text-left', onSelect && 'cursor-pointer')} title={`${r.name}: ${money(r.total)}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.name}</span></span>
              <span className="shrink-0 num"><b className="font-semibold">{money(r.total)}</b>{total > 0 && <span className="ml-1.5 text-xs text-muted">{Math.round((r.total / total) * 100)}%</span>}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full transition-[width] duration-500" style={{ width: `${(r.total / peak) * 100}%`, background: r.color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** GitHub-style spending calendar. Single hue, light → dark by amount. */
export function Heatmap({ days }) {
  if (!days?.length) return null;
  const values = days.map((d) => d.expense).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => values[Math.floor(p * (values.length - 1))] || 0;
  const cuts = [q(0.25), q(0.5), q(0.75), q(0.93)];
  const level = (v) => (v <= 0 ? 0 : 1 + cuts.filter((c) => v > c).length);
  const shades = ['var(--surface-2)', 'color-mix(in oklab, var(--out) 22%, var(--surface))', 'color-mix(in oklab, var(--out) 42%, var(--surface))',
    'color-mix(in oklab, var(--out) 64%, var(--surface))', 'color-mix(in oklab, var(--out) 84%, var(--surface))', 'var(--out)'];
  // Pad so columns start on Monday.
  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const pad = (first + 6) % 7;
  const cells = [...Array(pad).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto scrollbar-none pb-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((d, j) => (d ? (
              <div key={d.date} title={`${fmtShort(d.date)} · ${money(d.expense)}${d.count ? ` · ${d.count} entries` : ''}`}
                className="size-3 rounded-[3px] sm:size-3.5" style={{ background: shades[level(d.expense)] }} />
            ) : <div key={`p${j}`} className="size-3 sm:size-3.5" />))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        Less {shades.map((s, i) => <span key={i} className="size-2.5 rounded-[2px]" style={{ background: s }} />)} More
      </div>
    </div>
  );
}
