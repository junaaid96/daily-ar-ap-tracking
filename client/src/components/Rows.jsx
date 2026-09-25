import { Link } from 'react-router';
import { Avatar, CategoryDot, StatusBadge, Amount, Progress, cx } from './ui/index.jsx';
import { Icon } from '../lib/icons.jsx';
import { money, fmtShort, relativeDue, dayLabel } from '../lib/format.js';
import { useModals } from './ModalHost.jsx';

export function DueRow({ due, showContact = true, compact }) {
  const modals = useModals();
  const isR = due.direction === 'receivable';
  const done = due.outstanding === 0;
  return (
    <button type="button" onClick={() => modals.open('dueDetail', { id: due.id })}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-surface-2 cursor-pointer">
      {showContact ? <Avatar name={due.contact.name} size={compact ? 'sm' : 'md'} /> : (
        <CategoryDot color={isR ? 'var(--in)' : 'var(--out)'} icon={<Icon name={isR ? 'hand-coins' : 'receipt'} className="size-4" />} size={compact ? 'sm' : 'md'} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{showContact ? due.contact.name : due.title}</p>
          {!compact && <StatusBadge status={due.status} />}
        </div>
        <p className="truncate text-xs text-muted">
          {showContact && <>{due.title} · </>}
          <span className={cx(due.status === 'overdue' && 'text-out font-medium')}>{done ? `Settled ${fmtShort(due.lastPaidOn)}` : relativeDue(due.daysUntilDue)}</span>
        </p>
        {!compact && due.paidAmount > 0 && !done && <Progress value={due.paidAmount / due.amount} tone={isR ? 'in' : 'out'} className="mt-2 h-1.5 max-w-48" />}
      </div>
      <div className="text-right">
        <Amount value={done ? due.amount : due.outstanding} tone={done ? 'muted' : isR ? 'in' : 'out'} className="text-sm" />
        {due.paidAmount > 0 && !done && <p className="text-[11px] text-muted num">of {money(due.amount)}</p>}
      </div>
    </button>
  );
}

export function TxRow({ tx, onClick }) {
  const isIn = tx.kind === 'income';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2 cursor-pointer">
      <CategoryDot color={tx.categoryColor || '#94a3b8'} icon={<Icon name={tx.categoryIcon || 'circle'} className="size-4" />} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.note || tx.categoryName || (isIn ? 'Income' : 'Expense')}</p>
        <p className="truncate text-xs text-muted">{[tx.note && tx.categoryName, tx.accountName, onClick ? null : dayLabel(tx.occurredOn)].filter(Boolean).join(' · ') || '—'}</p>
      </div>
      <Amount value={tx.amount} tone={isIn ? 'in' : undefined} sign={isIn ? 'in' : 'out'} className="text-sm" />
    </button>
  );
}

export function SeeAll({ to, children = 'See all' }) {
  return <Link to={to} className="text-xs font-semibold text-brand hover:underline">{children}</Link>;
}
