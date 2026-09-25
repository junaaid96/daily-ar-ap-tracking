import { useMemo } from 'react';
import { Link } from 'react-router';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ReferenceDot, ReferenceLine } from 'recharts';
import { Flame, TrendingUp, TriangleAlert, CalendarClock, Sparkles, ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet, Plus, Info, ChevronRight, Lightbulb } from 'lucide-react';
import { Card, CardHeader, Skeleton, Ring, Button, Empty, cx } from '../components/ui/index.jsx';
import { DueRow, TxRow, SeeAll } from '../components/Rows.jsx';
import { ChartTip, axis, grid, yMoney, Legend, RankedBars } from '../components/charts/index.jsx';
import { useDashboard, useReport } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { useAuth } from '../lib/auth.jsx';
import { money, fmtShort, fmtDate, fmtMonth, pct, moneyCompact } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Stat({ label, value, icon: I, tone, to, sub }) {
  const tones = { in: 'text-in bg-in-soft', out: 'text-out bg-out-soft', save: 'text-save bg-save-soft', brand: 'text-brand bg-brand-soft' };
  const body = (
    <div className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-surface-2">
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}><I className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold num leading-tight">{money(value)}</p>
        {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Insights() {
  const { data = [] } = useReport('insights');
  const tone = { positive: 'text-in bg-in-soft', warning: 'text-warn bg-warn-soft', danger: 'text-out bg-out-soft', neutral: 'text-brand bg-brand-soft' };
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader title="Insights" subtitle="What stands out this month" icon={Lightbulb} />
      <ul className="space-y-1 p-3">
        {data.slice(0, 5).map((i) => {
          const inner = (
            <div className="flex gap-3 rounded-xl p-2.5 hover:bg-surface-2">
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', tone[i.tone])}><Icon name={i.icon} className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{i.title}</p>
                <p className="text-xs text-muted">{i.body}{i.value?.date && ` on ${fmtDate(i.value.date)}`}{i.value?.amount !== undefined && <> · <b className="num text-ink">{money(i.value.amount)}</b></>}</p>
              </div>
            </div>
          );
          return <li key={i.title}>{i.link ? <Link to={i.link}>{inner}</Link> : inner}</li>;
        })}
      </ul>
    </Card>
  );
}

export default function Dashboard() {
  const { data: d, isLoading } = useDashboard();
  const { user } = useAuth();
  const modals = useModals();

  const forecast = useMemo(() => d?.forecast || [], [d]);
  if (isLoading || !d) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-48 lg:col-span-2" /><Skeleton className="h-48" /></div>
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
      </div>
    );
  }

  const spentChange = d.prevMonthToDate.expense > 0 ? (d.month.expense - d.prevMonthToDate.expense) / d.prevMonthToDate.expense : null;
  const low = d.forecastLow;
  const end = forecast[forecast.length - 1];
  const s2s = d.safeToSpend;
  const s2sUsed = s2s.perDay > 0 ? Math.min(d.todaySpend.spent / s2s.perDay, 1) : d.todaySpend.spent > 0 ? 1 : 0;
  const attention = [...d.dues.overdue, ...d.dues.upcoming];
  const isEmpty = d.recent.length === 0 && attention.length === 0 && d.goals.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{fmtDate(d.today)}</p>
          <h1 className="text-2xl font-bold sm:text-[28px]">{greeting()}, {user?.name?.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={ArrowDownLeft} onClick={() => modals.open('due', { direction: 'receivable' })}>Receivable</Button>
          <Button variant="secondary" icon={ArrowUpRight} onClick={() => modals.open('due', { direction: 'payable' })}>Payable</Button>
          <Button icon={Plus} onClick={() => modals.open('transaction', { kind: 'expense' })}>Expense</Button>
        </div>
      </div>

      {isEmpty && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-brand-soft to-transparent p-6 sm:flex-row sm:items-center">
            <Sparkles className="size-8 text-brand" />
            <div className="flex-1">
              <p className="font-semibold">Welcome to Ledgerly! Let’s set things up.</p>
              <p className="text-sm text-muted">Add your accounts with their current balances, then log today’s first expense or who owes you money.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => modals.open('account')}>Add account</Button>
              <Button onClick={() => modals.open('transaction', { kind: 'expense' })}>Log first expense</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Hero row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-1 px-5 pt-5">
            <p className="flex items-center gap-1.5 text-sm text-muted">Net position
              <span title="Cash in your accounts + money owed to you + savings − what you owe"><Info className="size-3.5" /></span>
            </p>
            <p className={cx('text-5xl font-bold tracking-tight', d.totals.netWorth < 0 && 'text-out')}>{money(d.totals.netWorth)}</p>
            <p className="text-sm text-muted">
              This month: <span className="text-in num font-medium">+{money(d.month.income)}</span> in, <span className="text-out num font-medium">−{money(d.month.expense)}</span> out
              {spentChange !== null && <span className={cx('ml-2 rounded-full px-2 py-0.5 text-xs font-semibold', spentChange > 0 ? 'bg-out-soft text-out' : 'bg-in-soft text-in')}>
                spending {spentChange > 0 ? '↑' : '↓'} {pct(Math.abs(spentChange))} vs last month
              </span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-4">
            <Stat label="Cash & bank" value={d.totals.cash} icon={Wallet} tone="brand" to="/accounts" sub={`${d.accounts.length} account${d.accounts.length === 1 ? '' : 's'}`} />
            <Stat label="To receive" value={d.totals.receivable} icon={ArrowDownLeft} tone="in" to="/receivables" sub={d.totals.overdueReceivable > 0 ? `${money(d.totals.overdueReceivable)} overdue` : 'nothing overdue'} />
            <Stat label="To pay" value={d.totals.payable} icon={ArrowUpRight} tone="out" to="/payables" sub={d.totals.overduePayable > 0 ? `${money(d.totals.overduePayable)} overdue` : 'nothing overdue'} />
            <Stat label="Saved" value={d.totals.savings} icon={PiggyBank} tone="save" to="/savings" sub={`${d.goals.length} goal${d.goals.length === 1 ? '' : 's'}`} />
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">Safe to spend today</p>
              <p className="mt-1 text-4xl font-bold num">{money(s2s.amount)}</p>
              <p className="mt-1 text-xs text-muted">
                {s2s.basis === 'budget' ? `From your budgets · ${d.month.daysLeft} days left` : 'From your cash after upcoming bills'}
              </p>
            </div>
            <Ring value={s2sUsed} size={68} color={s2sUsed >= 1 ? 'var(--out)' : s2sUsed > 0.75 ? 'var(--warn)' : 'var(--in)'}>
              {Math.round(s2sUsed * 100)}%
            </Ring>
          </div>
          <p className="mt-3 text-sm">Spent today <b className="num">{money(d.todaySpend.spent)}</b> of <span className="num">{money(s2s.perDay)}</span> daily allowance</p>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <div className="rounded-xl bg-surface-2/70 p-3">
              <p className="flex items-center gap-1 text-xs text-muted"><Flame className="size-3.5 text-warn" />Logging streak</p>
              <p className="mt-0.5 font-bold">{d.streak} day{d.streak === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-xl bg-surface-2/70 p-3">
              <p className="text-xs text-muted">No-spend days</p>
              <p className="mt-0.5 font-bold">{d.noSpendDays} this month</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Forecast + attention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader title="30-day cash forecast" icon={TrendingUp}
            subtitle={`Expected balance with upcoming bills, income and dues · ends at ${money(end?.balance)}`}
            action={low.balance < 0 ? <span className="flex items-center gap-1 rounded-full bg-out-soft px-2 py-1 text-xs font-semibold text-out"><TriangleAlert className="size-3.5" />Dips below zero {fmtShort(low.date)}</span> : null} />
          <div className="min-h-64 flex-1 px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...grid} />
                <XAxis dataKey="date" {...axis} tickFormatter={fmtShort} minTickGap={32} />
                <YAxis {...yMoney} domain={['auto', 'auto']} />
                {low.balance < 0 && <ReferenceLine y={0} stroke="var(--out)" strokeOpacity={0.5} />}
                <Tooltip cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.4 }}
                  content={<ChartTip rows={[{ key: 'balance', label: 'Balance', color: 'var(--brand)' }]}
                    footer={(p) => (p.items.length ? (
                      <div className="mt-1.5 border-t border-line pt-1.5 text-muted">
                        {p.inflow > 0 && <p className="text-in num">+{money(p.inflow)}</p>}
                        {p.outflow > 0 && <p className="text-out num">−{money(p.outflow)}</p>}
                        <p className="max-w-48 truncate">{p.items.join(', ')}</p>
                      </div>
                    ) : null)} />} />
                <Area type="monotone" dataKey="balance" stroke="var(--brand)" strokeWidth={2} fill="url(#fc)" animationDuration={500} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} />
                <ReferenceDot x={low.date} y={low.balance} r={5} fill={low.balance < 0 ? 'var(--out)' : 'var(--brand)'} stroke="var(--surface)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Needs attention" subtitle="Overdue and due in the next 14 days" icon={CalendarClock} action={<SeeAll to="/receivables" />} />
          <div className="flex-1 p-2">
            {attention.length === 0 ? (
              <Empty icon={CalendarClock} title="All clear" body="Nothing overdue or due soon." className="py-8" />
            ) : attention.slice(0, 6).map((due) => <DueRow key={due.id} due={due} compact />)}
          </div>
        </Card>
      </div>

      {/* This month */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader title={fmtMonth(d.month.key)} subtitle={`Net ${d.month.net >= 0 ? '+' : '−'}${money(Math.abs(d.month.net))} so far`}
            action={<Legend items={[{ label: 'Income', color: 'var(--in)' }, { label: 'Expense', color: 'var(--out)' }]} />} />
          <div className="min-h-60 flex-1 px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.daily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="date" {...axis} tickFormatter={(v) => Number(v.slice(8))} minTickGap={8} />
                <YAxis {...yMoney} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip rows={[{ key: 'income', label: 'Income', color: 'var(--in)' }, { key: 'expense', label: 'Expense', color: 'var(--out)' }]} />} />
                <ReferenceLine x={d.today} stroke="var(--muted)" strokeOpacity={0.4} />
                <Bar dataKey="income" fill="var(--in)" radius={[4, 4, 0, 0]} maxBarSize={12} animationDuration={500} />
                <Bar dataKey="expense" fill="var(--out)" radius={[4, 4, 0, 0]} maxBarSize={12} animationDuration={500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Where it went" subtitle={`${money(d.month.expense)} spent this month`} action={<SeeAll to="/reports">Reports</SeeAll>} />
          <div className="p-5">
            {d.byCategory.length ? <RankedBars items={d.byCategory} total={d.month.expense} /> : <Empty title="No spending yet" body="Expenses you log show up here." className="py-6" />}
            {d.budget.total > 0 && (
              <Link to="/budgets" className="mt-5 flex items-center justify-between rounded-xl bg-surface-2/70 p-3 text-sm hover:bg-surface-2">
                <span>Budget used <b className="num">{pct(Math.min(d.budget.spent / d.budget.total, 9.99))}</b> · <span className="num text-muted">{money(d.budget.remaining)} left</span></span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Savings goals" icon={PiggyBank} action={<SeeAll to="/savings" />} />
          <div className="space-y-4 p-5">
            {d.goals.length === 0 ? (
              <Empty icon={PiggyBank} title="No goals yet" body="Set a target and watch it fill up." action={<Button size="sm" variant="save" onClick={() => modals.open('goal')}>Create a goal</Button>} className="py-4" />
            ) : d.goals.slice(0, 4).map((g) => (
              <button key={g.id} type="button" onClick={() => modals.open('contribution', { goal: g })} className="flex w-full items-center gap-3 text-left cursor-pointer group">
                <Ring value={g.progress} size={46} stroke={5} color={g.color}><Icon name={g.icon} className="size-4" style={{ color: g.color }} /></Ring>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium group-hover:underline">{g.name}</span><span className="num text-muted">{pct(g.progress)}</span></div>
                  <p className="text-xs text-muted num">{money(g.saved)} of {moneyCompact(g.targetAmount)}{g.monthlyNeeded > 0 && ` · ${money(g.monthlyNeeded)}/mo needed`}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" action={<SeeAll to="/daily" />} />
          <div className="p-2">
            {d.recent.length === 0 ? <Empty title="Nothing logged yet" className="py-8" /> : d.recent.slice(0, 6).map((t) => <TxRow key={t.id} tx={t} />)}
          </div>
          {d.upcomingRecurring.length > 0 && (
            <div className="border-t border-line p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Coming up</p>
              {d.upcomingRecurring.slice(0, 3).map((r) => (
                <Link to="/recurring" key={`${r.id}${r.date}`} className="flex items-center justify-between py-1 text-sm hover:underline">
                  <span className="truncate">{r.name} <span className="text-xs text-muted">· {fmtShort(r.date)}</span></span>
                  <span className={cx('num font-medium', r.kind === 'income' ? 'text-in' : '')}>{r.kind === 'income' ? '+' : ''}{money(r.amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Insights />
      </div>
    </div>
  );
}
