import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Download, CalendarDays } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Segmented, Skeleton, Empty, IconButton, cx } from '../components/ui/index.jsx';
import { TxRow } from '../components/Rows.jsx';
import { useTransactions, useCategories } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { money, fmtMonth, dayLabel, todayISO } from '../lib/format.js';
import { download } from '../lib/api.js';

const monthBounds = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}`, days: last };
};
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default function Daily() {
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const modals = useModals();
  const { data: categories = [] } = useCategories();
  const { from, to, days } = monthBounds(month);
  const params = { from, to, kind: kind || undefined, q: q.trim() || undefined, categoryId: categoryId || undefined, limit: 500 };
  const { data, isLoading } = useTransactions(params);

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of data?.items || []) {
      const g = map.get(t.occurredOn) || { date: t.occurredOn, items: [], expense: 0, income: 0 };
      g.items.push(t);
      g[t.kind] += t.amount;
      map.set(t.occurredOn, g);
    }
    return [...map.values()];
  }, [data]);

  const isCurrent = month === today.slice(0, 7);
  const elapsed = isCurrent ? Number(today.slice(8, 10)) : days;
  const avg = data ? data.expense / Math.max(elapsed, 1) : 0;

  return (
    <div>
      <PageHeader title="Daily log" subtitle="Every expense and income, day by day"
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => download('/transactions/export.csv', { ...params, limit: undefined }, 'transactions.csv')}>Export CSV</Button>
          <Button variant="in" icon={Plus} onClick={() => modals.open('transaction', { kind: 'income' })}>Income</Button>
          <Button variant="out" icon={Plus} onClick={() => modals.open('transaction', { kind: 'expense' })}>Expense</Button>
        </>} />

      <div className="mb-4 flex items-center gap-2">
        <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} />
        <h2 className="min-w-44 text-center text-lg font-bold">{fmtMonth(month)}</h2>
        <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrent} className={isCurrent ? 'opacity-30 pointer-events-none' : ''} />
        {!isCurrent && <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>This month</Button>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Income</p><p className="text-xl font-bold text-in num">{money(data?.income || 0)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Expenses</p><p className="text-xl font-bold text-out num">{money(data?.expense || 0)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Net</p><p className={cx('text-xl font-bold num', (data?.income || 0) - (data?.expense || 0) < 0 && 'text-out')}>{money((data?.income || 0) - (data?.expense || 0))}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Avg spend / day</p><p className="text-xl font-bold num">{money(avg)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Segmented value={kind} onChange={setKind} options={[{ value: '', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
          <div className="flex flex-1 gap-2 lg:justify-end">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-auto max-w-48" aria-label="Category">
              <option value="">All categories</option>
              {categories.filter((c) => !kind || c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-9" />
            </div>
          </div>
        </div>
        {isLoading ? <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          : groups.length === 0 ? (
            <Empty icon={CalendarDays} title={q || categoryId || kind ? 'No matching entries' : 'Nothing logged this month'}
              body="Tip: press E anywhere to add an expense, I for income."
              action={<Button icon={Plus} onClick={() => modals.open('transaction', { kind: 'expense' })}>Add expense</Button>} />
          ) : (
            <div className="p-2">
              {groups.map((g) => (
                <section key={g.date} className="mb-2">
                  <div className="sticky top-14 z-10 flex items-center justify-between bg-surface/95 px-3 py-2 backdrop-blur">
                    <p className={cx('text-sm font-semibold', g.date === today && 'text-brand')}>{dayLabel(g.date)}</p>
                    <p className="text-xs text-muted num">
                      {g.income > 0 && <span className="text-in">+{money(g.income)}</span>}
                      {g.income > 0 && g.expense > 0 && ' · '}
                      {g.expense > 0 && <span>−{money(g.expense)}</span>}
                    </p>
                  </div>
                  {g.items.map((t) => <TxRow key={t.id} tx={t} onClick={() => modals.open('transaction', { tx: t })} />)}
                </section>
              ))}
              {data?.hasMore && <p className="p-4 text-center text-xs text-muted">Showing first 500 entries — narrow the filters to see more.</p>}
            </div>
          )}
      </Card>
    </div>
  );
}
