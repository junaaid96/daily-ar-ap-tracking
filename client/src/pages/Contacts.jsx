import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Users, Phone } from 'lucide-react';
import { Card, PageHeader, Button, Input, Avatar, Skeleton, Empty, Segmented, Badge, cx } from '../components/ui/index.jsx';
import { useContacts } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { money } from '../lib/format.js';

export default function Contacts() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const { data = [], isLoading } = useContacts(q.trim());
  const modals = useModals();
  const list = data.filter((c) => filter === 'all' || (filter === 'owe-me' ? c.net > 0 : filter === 'i-owe' ? c.net < 0 : c.net === 0));
  const owedToMe = data.reduce((s, c) => s + Math.max(c.net, 0), 0);
  const iOwe = data.reduce((s, c) => s + Math.max(-c.net, 0), 0);

  return (
    <div>
      <PageHeader title="Contacts" subtitle="Everyone you lend to, borrow from, invoice or get billed by"
        actions={<Button icon={Plus} onClick={() => modals.open('contact')}>New contact</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="p-4"><p className="text-xs text-muted">People owe you</p><p className="text-xl font-bold text-in num">{money(owedToMe)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">You owe people</p><p className="text-xl font-bold text-out num">{money(iOwe)}</p></Card>
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All' }, { value: 'owe-me', label: 'Owe me' }, { value: 'i-owe', label: 'I owe' }, { value: 'settled', label: 'Settled' }]} />
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" className="pl-9" />
          </div>
        </div>
        {isLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : list.length === 0 ? <Empty icon={Users} title={q ? 'No matches' : 'No contacts yet'} body="Contacts are also created automatically when you add a receivable or payable."
            action={!q && <Button icon={Plus} onClick={() => modals.open('contact')}>Add contact</Button>} />
            : (
              <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((c) => (
                  <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:border-brand/40 hover:shadow-md">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        {c.company || (c.phone && <><Phone className="size-3" />{c.phone}</>) || `${c.openCount} open`}
                      </p>
                      {c.overdueCount > 0 && <Badge tone="out" className="mt-1">{c.overdueCount} overdue</Badge>}
                    </div>
                    <div className="text-right">
                      {c.net === 0 ? <p className="text-xs text-muted">Settled up</p> : (
                        <>
                          <p className={cx('font-bold num', c.net > 0 ? 'text-in' : 'text-out')}>{money(Math.abs(c.net))}</p>
                          <p className="text-[11px] text-muted">{c.net > 0 ? 'owes you' : 'you owe'}</p>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
      </Card>
    </div>
  );
}
