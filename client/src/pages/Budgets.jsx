import { useState } from 'react';
import { ChevronLeft, ChevronRight, Target, TriangleAlert, CircleCheck, Plus } from 'lucide-react';
import { Card, PageHeader, Button, Progress, Skeleton, Empty, IconButton, Badge, Ring, CategoryDot, cx } from '../components/ui/index.jsx';
import { useBudgets } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { money, fmtMonth, todayISO, pct } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

const shift = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };

export default function Budgets() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data, isLoading } = useBudgets(month);
  const modals = useModals();
  const budgeted = data?.items.filter((i) => i.budget !== null) || [];
  const others = data?.items.filter((i) => i.budget === null) || [];
  const used = data?.totalBudget ? data.budgetedSpent / data.totalBudget : 0;
  const timeUsed = data ? data.elapsed / data.days : 0;

  return (
    <div>
      <PageHeader title="Budgets" subtitle="Monthly limits per category, with early warnings when you’re pacing over"
        actions={<Button variant="secondary" icon={Plus} onClick={() => modals.open('category', { kind: 'expense' })}>New category</Button>} />
      <div className="mb-4 flex items-center gap-2">
        <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth((m) => shift(m, -1))} />
        <h2 className="min-w-44 text-center text-lg font-bold">{fmtMonth(month)}</h2>
        <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth((m) => shift(m, 1))} />
      </div>
      {isLoading || !data ? <Skeleton className="h-64" /> : (
        <>
          <Card className="mb-4 p-5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Ring value={used} size={110} stroke={10} color={used > 1 ? 'var(--out)' : used > timeUsed + 0.1 ? 'var(--warn)' : 'var(--in)'}>
                <span className="text-center"><span className="block text-xl font-bold">{pct(Math.min(used, 9.99))}</span><span className="text-[10px] font-normal text-muted">used</span></span>
              </Ring>
              <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-muted">Total budget</p><p className="text-xl font-bold num">{money(data.totalBudget)}</p></div>
                <div><p className="text-xs text-muted">Spent (budgeted)</p><p className="text-xl font-bold num">{money(data.budgetedSpent)}</p></div>
                <div><p className="text-xs text-muted">Remaining</p><p className={cx('text-xl font-bold num', data.totalBudget - data.budgetedSpent < 0 && 'text-out')}>{money(data.totalBudget - data.budgetedSpent)}</p></div>
                <div><p className="text-xs text-muted">Daily allowance</p><p className="text-xl font-bold num text-brand">{data.dailyAllowance !== null ? money(data.dailyAllowance) : '—'}</p>
                  <p className="text-[11px] text-muted">{data.daysLeft} day{data.daysLeft === 1 ? '' : 's'} left</p></div>
              </div>
            </div>
            {data.totalBudget > 0 && (
              <div className="mt-5">
                <div className="relative"><Progress value={used} tone={used > 1 ? 'out' : used > timeUsed + 0.1 ? 'warn' : 'in'} className="h-3" />
                  <div className="absolute top-[-4px] h-5 w-0.5 rounded bg-ink/50" style={{ left: `${timeUsed * 100}%` }} title="Today" /></div>
                <p className="mt-1.5 text-xs text-muted">The marker shows how far through the month you are — stay left of it to finish under budget.</p>
              </div>
            )}
          </Card>

          <Card>
            {budgeted.length === 0 ? (
              <Empty icon={Target} title="No budgets set" body="Tap any category below to give it a monthly limit. We’ll warn you when you’re pacing over." />
            ) : (
              <div className="divide-y divide-line/60">
                {budgeted.map((i) => (
                  <button key={i.id} type="button" onClick={() => modals.open('budget', { item: i })} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface-2/50 cursor-pointer">
                    <CategoryDot color={i.color} icon={<Icon name={i.icon} className="size-4" />} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{i.name}</p>
                        <p className="shrink-0 text-sm num"><b>{money(i.spent)}</b> <span className="text-muted">/ {money(i.budget)}</span></p>
                      </div>
                      <Progress value={i.pct} tone={i.state === 'over' ? 'out' : i.state === 'at-risk' ? 'warn' : undefined} color={i.state === 'ok' ? i.color : undefined} className="mt-2" />
                      <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                        <span>{i.remaining >= 0 ? `${money(i.remaining)} left` : `${money(-i.remaining)} over`}</span>
                        {i.state === 'over' ? <Badge tone="out" icon={TriangleAlert}>Over budget</Badge>
                          : i.state === 'at-risk' ? <Badge tone="warn" icon={TriangleAlert}>On pace for {money(i.projected)}</Badge>
                            : <Badge tone="in" icon={CircleCheck}>On track</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {others.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-muted">Without a budget</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((i) => (
                  <button key={i.id} type="button" onClick={() => modals.open('budget', { item: i })}
                    className="card flex items-center gap-3 p-3 text-left hover:border-brand/40 cursor-pointer">
                    <CategoryDot color={i.color} icon={<Icon name={i.icon} className="size-4" />} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{i.name}</span>
                    <span className="text-sm num text-muted">{money(i.spent)}</span>
                    <span className="text-xs font-semibold text-brand">Set</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
