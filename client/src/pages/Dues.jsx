import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Search, Download, HandCoins, Receipt } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Segmented, Skeleton, Empty, cx } from '../components/ui/index.jsx';
import { DueRow } from '../components/Rows.jsx';
import { useAging, useDues } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { money } from '../lib/format.js';
import { download } from '../lib/api.js';

// Severity ramps from amber (just late) to red (long overdue).
const BUCKETS = [
  ['current', 'Not yet due', null],
  ['d1_30', '1–30 days', 'var(--warn)'],
  ['d31_60', '31–60 days', 'color-mix(in oklab, var(--out) 45%, var(--warn))'],
  ['d61_90', '61–90 days', 'color-mix(in oklab, var(--out) 75%, var(--warn))'],
  ['d90_plus', '90+ days', 'var(--out)'],
];

function AgingBar({ aging, isR }) {
  const base = isR ? 'var(--in)' : 'var(--out)';
  const total = aging.total || 0;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2">
        {total > 0 && BUCKETS.map(([k, label, strength]) => aging[k] > 0 && (
          <div key={k} title={`${label}: ${money(aging[k])}`} style={{ width: `${(aging[k] / total) * 100}%`, background: strength || base }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {BUCKETS.map(([k, label, strength]) => (
          <div key={k} className="text-xs">
            <p className="flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: strength || base }} />{label}
            </p>
            <p className="mt-0.5 font-semibold num text-sm">{money(aging[k])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dues({ direction }) {
  const isR = direction === 'receivable';
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'active';
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('due');
  const modals = useModals();
  const { data: agingAll } = useAging();
  const { data: dues, isLoading } = useDues({ direction, status, q: q.trim() || undefined, sort });
  const aging = agingAll?.[direction];

  const counts = useMemo(() => ({ overdue: (aging?.total || 0) - (aging?.current || 0) }), [aging]);

  return (
    <div>
      <PageHeader
        title={isR ? 'Receivables' : 'Payables'}
        subtitle={isR ? 'Money other people and businesses owe you' : 'Money you owe to other people and businesses'}
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => download('/reports/aging', { format: 'csv' }, 'aging.csv')}>Export</Button>
          <Button variant={isR ? 'in' : 'out'} icon={Plus} onClick={() => modals.open('due', { direction })}>{isR ? 'New receivable' : 'New payable'}</Button>
        </>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={cx('p-5', isR ? 'bg-gradient-to-br from-in-soft to-surface' : 'bg-gradient-to-br from-out-soft to-surface')}>
          <p className="text-sm text-muted">{isR ? 'Total to collect' : 'Total to pay'}</p>
          <p className={cx('mt-1 text-4xl font-bold num', isR ? 'text-in' : 'text-out')}>{aging ? money(aging.total) : '—'}</p>
          <p className="mt-2 text-sm text-muted">
            across <b className="text-ink">{aging?.count ?? 0}</b> open record{aging?.count === 1 ? '' : 's'}
            {counts.overdue > 0 && <> · <span className="font-semibold text-out num">{money(counts.overdue)} overdue</span></>}
          </p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold">Aging <span className="font-normal text-muted">— how long outstanding amounts have been past due</span></p>
          {aging ? <AgingBar aging={aging} isR={isR} /> : <Skeleton className="h-16" />}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Segmented value={status} onChange={(s) => setParams(s === 'active' ? {} : { status: s }, { replace: true })}
            className="overflow-x-auto scrollbar-none max-w-full"
            options={[
              { value: 'active', label: 'Open' }, { value: 'overdue', label: 'Overdue' }, { value: 'partial', label: 'Partly paid' },
              { value: 'paid', label: 'Settled' }, { value: 'written_off', label: 'Written off' }, { value: 'all', label: 'All' },
            ]} />
          <div className="flex flex-1 gap-2 lg:justify-end">
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, title, ref…" className="pl-9" />
            </div>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto" aria-label="Sort">
              <option value="due">Due soonest</option><option value="overdue">Most overdue</option>
              <option value="amount">Largest</option><option value="newest">Newest</option>
            </Select>
          </div>
        </div>
        <div className="divide-y divide-line/60 p-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="m-2 h-14" />)}
          {dues?.length === 0 && (
            <Empty icon={isR ? HandCoins : Receipt}
              title={q ? 'No matches' : status === 'active' ? (isR ? 'Nobody owes you money' : 'You don’t owe anyone') : 'Nothing here'}
              body={!q && status === 'active' ? (isR ? 'Track invoices, loans to friends, or anything you’re waiting to collect.' : 'Track bills, loans or purchases on credit so nothing slips.') : undefined}
              action={!q && status === 'active' && <Button variant={isR ? 'in' : 'out'} icon={Plus} onClick={() => modals.open('due', { direction })}>{isR ? 'Add receivable' : 'Add payable'}</Button>} />
          )}
          {dues?.map((d) => <DueRow key={d.id} due={d} />)}
        </div>
      </Card>
    </div>
  );
}
