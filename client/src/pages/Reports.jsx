import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';
import { Card, CardHeader, PageHeader, Button, Segmented, Skeleton, Empty } from '../components/ui/index.jsx';
import { ChartTip, axis, grid, yMoney, Legend, RankedBars, Heatmap } from '../components/charts/index.jsx';
import { useReport } from '../lib/queries.js';
import { money, fmtMonth, fmtMonthShort, pct, todayISO, addDaysISO } from '../lib/format.js';
import { download } from '../lib/api.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Reports() {
  const [months, setMonths] = useState(6);
  const [range, setRange] = useState('month');
  const [kind, setKind] = useState('expense');
  const today = todayISO();
  const from = range === 'month' ? `${today.slice(0, 7)}-01` : range === '90' ? addDaysISO(today, -89) : addDaysISO(today, -364);
  const { data: trend } = useReport('trend', { months });
  const { data: cats } = useReport('categories', { from, to: today, kind });
  const { data: heat } = useReport('heatmap', { days: 182 });
  const { data: weekday } = useReport('weekday');
  const { data: aging } = useReport('aging');

  const totals = (trend || []).reduce((s, m) => ({ income: s.income + m.income, expense: s.expense + m.expense, saved: s.saved + m.saved }), { income: 0, expense: 0, saved: 0 });
  const rate = totals.income > 0 ? (totals.income - totals.expense) / totals.income : null;
  const wk = DOW.map((label, i) => ({ label, ...(weekday || []).find((w) => w.dow === i + 1) })).map((w) => ({ ...w, avgPerActiveDay: w.avgPerActiveDay || 0 }));

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Trends, breakdowns and aging — exportable any time"
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => download('/transactions/export.csv', {}, 'transactions.csv')}>Transactions CSV</Button>
          <Button variant="secondary" icon={Download} onClick={() => download('/reports/aging', { format: 'csv' }, 'aging.csv')}>Aging CSV</Button>
        </>} />

      <Card>
        <CardHeader title="Income vs expenses" subtitle={rate !== null ? `Kept ${pct(rate)} of income over ${months} months · ${money(totals.saved)} moved to savings` : 'Monthly totals'}
          action={<Segmented size="sm" value={months} onChange={setMonths} options={[{ value: 3, label: '3M' }, { value: 6, label: '6M' }, { value: 12, label: '12M' }]} />} />
        <Legend className="px-5 pt-3" items={[{ label: 'Income', color: 'var(--in)' }, { label: 'Expenses', color: 'var(--out)' }]} />
        <div className="h-72 px-2 pb-3 pt-2">
          {!trend ? <Skeleton className="m-4 h-60" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="month" {...axis} tickFormatter={fmtMonthShort} />
                <YAxis {...yMoney} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip labelFormat={fmtMonth}
                  rows={[{ key: 'income', label: 'Income', color: 'var(--in)' }, { key: 'expense', label: 'Expenses', color: 'var(--out)' }, { key: 'net', label: 'Net', color: 'var(--muted)' }]} />} />
                <Bar dataKey="income" fill="var(--in)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="expense" fill="var(--out)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={kind === 'expense' ? 'Spending by category' : 'Income by source'} subtitle={cats ? `${money(cats.total)} total` : ''}
            action={<Segmented size="sm" value={range} onChange={setRange} options={[{ value: 'month', label: 'Month' }, { value: '90', label: '90d' }, { value: '365', label: '1Y' }]} />} />
          <div className="px-5 pt-3"><Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} /></div>
          <div className="p-5">
            {!cats ? <Skeleton className="h-48" /> : cats.items.length ? <RankedBars items={cats.items} total={cats.total} max={8} /> : <Empty title="No data for this period" className="py-6" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Spending calendar" subtitle="Last 6 months — darker means more spent that day" />
          <div className="p-5">{heat ? <Heatmap days={heat} /> : <Skeleton className="h-28" />}</div>
          <div className="border-t border-line p-5">
            <p className="mb-2 text-sm font-semibold">Average spend by weekday <span className="font-normal text-muted">· last 90 days</span></p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wk} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...yMoney} width={56} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip labelFormat={(l) => l} rows={[{ key: 'avgPerActiveDay', label: 'Avg per spending day', color: 'var(--brand)' }]} />} />
                  <Bar dataKey="avgPerActiveDay" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Collections & repayments" subtitle="Money received on receivables vs paid out on payables, per month" />
        <Legend className="px-5 pt-3" items={[{ label: 'Collected', color: 'var(--in)', line: true }, { label: 'Repaid', color: 'var(--out)', line: true }]} />
        <div className="h-56 px-2 pb-3 pt-2">
          {trend && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="month" {...axis} tickFormatter={fmtMonthShort} />
                <YAxis {...yMoney} />
                <Tooltip content={<ChartTip labelFormat={fmtMonth} rows={[{ key: 'collected', label: 'Collected', color: 'var(--in)' }, { key: 'repaid', label: 'Repaid', color: 'var(--out)' }]} />} />
                <Line type="monotone" dataKey="collected" stroke="var(--in)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="repaid" stroke="var(--out)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Aging summary" subtitle="Outstanding amounts by how long they’re past due" />
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Type</th>
                {['Not due', '1–30', '31–60', '61–90', '90+', 'Total'].map((h) => <th key={h} className="px-3 py-3 text-right font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {aging && ['receivable', 'payable'].map((dir) => (
                <tr key={dir} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium capitalize">{dir}s</td>
                  {['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus', 'total'].map((k) => (
                    <td key={k} className={`px-3 py-3 text-right num ${k === 'total' ? 'font-bold' : ''} ${k !== 'current' && k !== 'total' && aging[dir][k] > 0 ? 'text-out' : ''}`}>{money(aging[dir][k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
