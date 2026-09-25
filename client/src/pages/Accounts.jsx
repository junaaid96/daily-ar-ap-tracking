import { Plus, ArrowLeftRight, MoreHorizontal, Pencil, Archive, Trash2, ArrowRight, Wallet } from 'lucide-react';
import { Card, PageHeader, Button, Skeleton, Empty, Menu, IconButton, Badge, useConfirm, cx } from '../components/ui/index.jsx';
import { useAccounts, useTransfers, useSave } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { api } from '../lib/api.js';
import { money, fmtShort } from '../lib/format.js';
import { Icon, ACCOUNT_ICONS } from '../lib/icons.jsx';

function AccountCard({ a }) {
  const modals = useModals();
  const confirm = useConfirm();
  const archive = useSave(() => api.patch(`/accounts/${a.id}`, { archived: !a.archived }), { success: a.archived ? 'Restored' : 'Archived' });
  const remove = useSave(() => api.del(`/accounts/${a.id}`), { success: 'Account deleted' });
  return (
    <Card className={cx('relative overflow-hidden p-5', a.archived && 'opacity-60')}>
      <div className="absolute -right-8 -top-8 size-28 rounded-full opacity-15" style={{ background: a.color }} />
      <div className="relative flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-xl text-white" style={{ background: a.color }}><Icon name={ACCOUNT_ICONS[a.kind]} className="size-5" /></span>
        <Menu trigger={<IconButton icon={MoreHorizontal} label="Account options" size="sm" />} items={[
          { label: 'Edit', icon: Pencil, onClick: () => modals.open('account', { account: a }) },
          { label: a.archived ? 'Restore' : 'Archive', icon: Archive, onClick: () => archive.mutate() },
          { label: 'Delete', icon: Trash2, danger: true, onClick: async () => { if (await confirm({ title: `Delete ${a.name}?`, body: 'Entries stay but will no longer be linked to this account. Transfers involving it are removed.', danger: true, confirmLabel: 'Delete' })) remove.mutate(); } },
        ]} />
      </div>
      <p className="relative mt-4 text-sm text-muted">{a.name} {a.archived && <Badge>Archived</Badge>}</p>
      <p className={cx('relative text-3xl font-bold num', a.balance < 0 && 'text-out')}>{money(a.balance)}</p>
      <p className="relative mt-1 text-xs capitalize text-muted">{a.kind} · opened with {money(a.openingBalance)}</p>
    </Card>
  );
}

export default function Accounts() {
  const { data = [], isLoading } = useAccounts();
  const { data: transfers = [] } = useTransfers();
  const modals = useModals();
  const confirm = useConfirm();
  const removeTransfer = useSave((id) => api.del(`/accounts/transfers/${id}`), { success: 'Transfer removed' });
  const total = data.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);
  return (
    <div>
      <PageHeader title="Accounts" subtitle="Where your money actually lives — balances update from every entry automatically"
        actions={<>
          <Button variant="secondary" icon={ArrowLeftRight} onClick={() => modals.open('transfer')}>Move money</Button>
          <Button icon={Plus} onClick={() => modals.open('account')}>New account</Button>
        </>} />
      <Card className="mb-4 flex items-center gap-4 p-5">
        <Wallet className="size-8 text-brand" />
        <div><p className="text-sm text-muted">Total across accounts</p><p className="text-3xl font-bold num">{money(total)}</p></div>
      </Card>
      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((a) => <AccountCard key={a.id} a={a} />)}</div>
      )}
      <Card className="mt-6">
        <p className="border-b border-line px-5 py-3 text-sm font-semibold">Recent transfers</p>
        {transfers.length === 0 ? <Empty icon={ArrowLeftRight} title="No transfers yet" body="Record ATM withdrawals, wallet top-ups or card payments here." /> : (
          <div className="divide-y divide-line/60">
            {transfers.map((t) => (
              <div key={t.id} className="group flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted">{fmtShort(t.date)}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium">{t.fromName}</span><ArrowRight className="size-3.5 shrink-0 text-muted" /><span className="truncate font-medium">{t.toName}</span>
                  {t.note && <span className="hidden truncate text-muted sm:inline">· {t.note}</span>}
                </span>
                <span className="num font-semibold">{money(t.amount)}</span>
                <IconButton icon={Trash2} label="Delete transfer" size="sm" className="sm:opacity-0 group-hover:opacity-100"
                  onClick={async () => { if (await confirm({ title: 'Delete this transfer?', danger: true, confirmLabel: 'Delete' })) removeTransfer.mutate(t.id); }} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
