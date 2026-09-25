import { Plus, Repeat, MoreHorizontal, Pencil, Trash2, Pause, Play, SkipForward, Check, Zap, Hand } from 'lucide-react';
import { Card, PageHeader, Button, Skeleton, Empty, Menu, IconButton, Badge, CategoryDot, useConfirm, cx } from '../components/ui/index.jsx';
import { useRecurring, useSave, useCategories } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { api } from '../lib/api.js';
import { money, fmtDate, diffDays, todayISO } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

const freqLabel = (r) => {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.frequency];
  return r.every === 1 ? `Every ${unit}` : `Every ${r.every} ${unit}s`;
};

function RuleRow({ r }) {
  const modals = useModals();
  const confirm = useConfirm();
  const { data: categories = [] } = useCategories();
  const post = useSave(() => api.post(`/recurring/${r.id}/post`), { success: `${r.name} logged` });
  const skip = useSave(() => api.post(`/recurring/${r.id}/skip`), { success: 'Skipped this one' });
  const toggle = useSave(() => api.patch(`/recurring/${r.id}`, { active: !r.active }), { success: r.active ? 'Paused' : 'Resumed' });
  const remove = useSave(() => api.del(`/recurring/${r.id}`), { success: 'Deleted' });
  const days = diffDays(todayISO(), r.nextDate);
  const due = r.active && !r.autoPost && days <= 0;
  return (
    <div className={cx('flex items-center gap-3 px-4 py-3.5 sm:px-5', !r.active && 'opacity-60')}>
      <CategoryDot color={r.categoryColor || (r.kind === 'income' ? 'var(--in)' : '#64748b')} icon={<Icon name={r.categoryIcon || 'receipt'} className="size-4" />} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{r.name}</p>
          {!r.active ? <Badge>Paused</Badge> : r.autoPost ? <Badge tone="brand" icon={Zap}>Auto</Badge> : <Badge tone="warn" icon={Hand}>Confirm</Badge>}
        </div>
        <p className="truncate text-xs text-muted">
          {freqLabel(r)} · {r.active ? <>next <span className={cx(due && 'font-semibold text-out')}>{days === 0 ? 'today' : days < 0 ? `${-days}d overdue` : fmtDate(r.nextDate)}</span></> : 'paused'}
          {r.accountName && ` · ${r.accountName}`}
        </p>
      </div>
      <div className="text-right">
        <p className={cx('font-semibold num', r.kind === 'income' && 'text-in')}>{r.kind === 'income' ? '+' : ''}{money(r.amount)}</p>
        {r.frequency !== 'monthly' || r.every !== 1 ? <p className="text-[11px] text-muted num">≈ {money(r.monthlyAmount)}/mo</p> : null}
      </div>
      {due && <Button size="sm" variant="primary" icon={Check} loading={post.isPending} onClick={() => post.mutate()} className="hidden sm:inline-flex">Log it</Button>}
      <Menu trigger={<IconButton icon={MoreHorizontal} label="Options" size="sm" />} items={[
        r.active && { label: 'Log now', icon: Check, onClick: () => post.mutate() },
        r.active && { label: 'Skip next', icon: SkipForward, onClick: () => skip.mutate() },
        { label: 'Edit', icon: Pencil, onClick: () => modals.open('recurring', { rule: r, categories }) },
        { label: r.active ? 'Pause' : 'Resume', icon: r.active ? Pause : Play, onClick: () => toggle.mutate() },
        { label: 'Delete', icon: Trash2, danger: true, onClick: async () => { if (await confirm({ title: `Delete “${r.name}”?`, body: 'Past entries stay in your log.', danger: true, confirmLabel: 'Delete' })) remove.mutate(); } },
      ]} />
    </div>
  );
}

export default function Recurring() {
  const { data = [], isLoading } = useRecurring();
  const modals = useModals();
  const active = data.filter((r) => r.active);
  const monthlyOut = active.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.monthlyAmount, 0);
  const monthlyIn = active.filter((r) => r.kind === 'income').reduce((s, r) => s + r.monthlyAmount, 0);
  const expenses = data.filter((r) => r.kind === 'expense');
  const incomes = data.filter((r) => r.kind === 'income');
  return (
    <div>
      <PageHeader title="Bills & recurring" subtitle="Rent, subscriptions and salary — logged automatically or confirmed by you"
        actions={<Button icon={Plus} onClick={() => modals.open('recurring')}>New recurring</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <Card className="p-4"><p className="text-xs text-muted">Bills per month</p><p className="text-xl font-bold num text-out">{money(monthlyOut)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Per year</p><p className="text-xl font-bold num">{money(monthlyOut * 12)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Regular income / mo</p><p className="text-xl font-bold num text-in">{money(monthlyIn)}</p></Card>
      </div>
      {isLoading ? <Skeleton className="h-64" /> : data.length === 0 ? (
        <Card><Empty icon={Repeat} title="No recurring items yet" body="Add rent, subscriptions or your salary once and Ledgerly logs them on schedule — and includes them in your cash forecast."
          action={<Button icon={Plus} onClick={() => modals.open('recurring')}>Add recurring item</Button>} /></Card>
      ) : (
        <div className="space-y-4">
          {[['Bills & subscriptions', expenses], ['Income', incomes]].map(([title, list]) => list.length > 0 && (
            <Card key={title}>
              <p className="border-b border-line px-5 py-3 text-sm font-semibold">{title}</p>
              <div className="divide-y divide-line/60">{list.map((r) => <RuleRow key={r.id} r={r} />)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
