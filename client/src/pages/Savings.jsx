import { useState } from 'react';
import { Plus, PiggyBank, MoreHorizontal, Pencil, Archive, Trash2, History, CircleCheck, TriangleAlert, Minus } from 'lucide-react';
import { Card, PageHeader, Button, Ring, Skeleton, Empty, Menu, IconButton, Badge, useConfirm, cx } from '../components/ui/index.jsx';
import { useGoals, useGoal, useSave } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { api } from '../lib/api.js';
import { money, fmtDate, fmtShort, pct } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

function HistoryList({ id }) {
  const { data } = useGoal(id);
  if (!data) return <Skeleton className="h-16" />;
  if (!data.contributions.length) return <p className="text-sm text-muted">No contributions yet.</p>;
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto">
      {data.contributions.map((c) => (
        <li key={c.id} className="flex justify-between text-sm">
          <span className="text-muted">{fmtShort(c.date)}{c.accountName ? ` · ${c.accountName}` : ''}{c.note ? ` · ${c.note}` : ''}</span>
          <span className={cx('num font-medium', c.amount < 0 ? 'text-out' : 'text-save')}>{c.amount > 0 ? '+' : '−'}{money(Math.abs(c.amount))}</span>
        </li>
      ))}
    </ul>
  );
}

function GoalCard({ g }) {
  const modals = useModals();
  const confirm = useConfirm();
  const [showHistory, setShowHistory] = useState(false);
  const archive = useSave(() => api.patch(`/goals/${g.id}`, { archived: !g.archived }), { success: g.archived ? 'Goal restored' : 'Goal archived' });
  const remove = useSave(() => api.del(`/goals/${g.id}`), { success: 'Goal deleted' });
  return (
    <Card className={cx('flex flex-col p-5', g.archived && 'opacity-70')}>
      <div className="flex items-start gap-4">
        <Ring value={g.progress} size={76} stroke={8} color={g.color}>
          <Icon name={g.icon} className="size-6" style={{ color: g.color }} />
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-lg font-bold">{g.name}</p>
            <Menu trigger={<IconButton icon={MoreHorizontal} label="Goal options" size="sm" />} items={[
              { label: 'Edit', icon: Pencil, onClick: () => modals.open('goal', { goal: g }) },
              { label: 'History', icon: History, onClick: () => setShowHistory((s) => !s) },
              { label: g.archived ? 'Restore' : 'Archive', icon: Archive, onClick: () => archive.mutate() },
              { label: 'Delete', icon: Trash2, danger: true, onClick: async () => { if (await confirm({ title: `Delete “${g.name}”?`, body: 'Its contribution history is deleted too. Money set aside returns to the accounts it came from.', danger: true, confirmLabel: 'Delete' })) remove.mutate(); } },
            ]} />
          </div>
          <p className="text-2xl font-bold num">{money(g.saved)}</p>
          <p className="text-sm text-muted num">of {money(g.targetAmount)} · {pct(g.progress)}</p>
        </div>
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        {g.completed ? <Badge tone="in" icon={CircleCheck}>Goal reached 🎉</Badge> : (
          <>
            {g.targetDate && (
              <p className="flex justify-between"><span className="text-muted">Target date</span><span>{fmtDate(g.targetDate)}{g.daysLeft >= 0 ? ` · ${g.daysLeft}d` : ' · passed'}</span></p>
            )}
            {g.monthlyNeeded > 0 && <p className="flex justify-between"><span className="text-muted">Save per month</span><b className="num">{money(g.monthlyNeeded)}</b></p>}
            <p className="flex justify-between"><span className="text-muted">Still needed</span><span className="num">{money(g.remaining)}</span></p>
            {g.projectedDate && <p className="flex justify-between"><span className="text-muted">At your pace</span><span>{fmtDate(g.projectedDate)}</span></p>}
            {g.targetDate && !g.onTrack && <Badge tone="warn" icon={TriangleAlert} className="mt-1">Behind schedule</Badge>}
          </>
        )}
      </div>
      {showHistory && <div className="mt-4 rounded-xl bg-surface-2/60 p-3"><HistoryList id={g.id} /></div>}
      {!g.archived && (
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-5">
          <Button variant="save" icon={Plus} onClick={() => modals.open('contribution', { goal: g })}>Add money</Button>
          <Button variant="secondary" icon={Minus} onClick={() => modals.open('contribution', { goal: g, type: 'withdraw' })} disabled={g.saved <= 0} aria-label="Withdraw" />
        </div>
      )}
    </Card>
  );
}

export default function Savings() {
  const { data = [], isLoading } = useGoals();
  const modals = useModals();
  const active = data.filter((g) => !g.archived);
  const archived = data.filter((g) => g.archived);
  const saved = active.reduce((s, g) => s + g.saved, 0);
  const target = active.reduce((s, g) => s + g.targetAmount, 0);
  const monthly = active.reduce((s, g) => s + (g.monthlyNeeded || 0), 0);
  return (
    <div>
      <PageHeader title="Savings" subtitle="Set money aside for what matters and see exactly what it takes to get there"
        actions={<Button variant="save" icon={Plus} onClick={() => modals.open('goal')}>New goal</Button>} />
      {active.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
          <Card className="p-4"><p className="text-xs text-muted">Total saved</p><p className="text-xl font-bold text-save num">{money(saved)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted">Combined target</p><p className="text-xl font-bold num">{money(target)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted">Needed / month</p><p className="text-xl font-bold num">{money(monthly)}</p></Card>
        </div>
      )}
      {isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>
        : active.length === 0 ? (
          <Card><Empty icon={PiggyBank} title="Start your first savings goal" body="An emergency fund, a trip, a new laptop — give it a target and a date, and we’ll work out the monthly amount."
            action={<Button variant="save" icon={Plus} onClick={() => modals.open('goal')}>Create a goal</Button>} /></Card>
        ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{active.map((g) => <GoalCard key={g.id} g={g} />)}</div>}
      {archived.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 text-sm font-semibold text-muted">Archived</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{archived.map((g) => <GoalCard key={g.id} g={g} />)}</div>
        </>
      )}
    </div>
  );
}
