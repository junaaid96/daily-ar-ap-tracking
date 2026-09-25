import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Pencil, Trash2, Phone, Mail, ArrowDownLeft, ArrowUpRight, Building2, MessageCircle } from 'lucide-react';
import { Card, Button, Avatar, Skeleton, Empty, Segmented, IconButton, useConfirm, cx } from '../components/ui/index.jsx';
import { DueRow } from '../components/Rows.jsx';
import { useContact, useSave } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { api } from '../lib/api.js';
import { money, fmtDate } from '../lib/format.js';

export default function ContactDetail() {
  const { id } = useParams();
  const { data: c, isLoading, error } = useContact(id);
  const [tab, setTab] = useState('records');
  const modals = useModals();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const remove = useSave(() => api.del(`/contacts/${id}`, { force: 'true' }), { success: 'Contact deleted', onSuccess: () => navigate('/contacts') });

  if (error) return <Empty title="Contact not found" action={<Link to="/contacts" className="text-brand">Back to contacts</Link>} />;
  if (isLoading || !c) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const phone = (c.phone || '').replace(/[^\d]/g, '');
  return (
    <div className="space-y-4">
      <Link to="/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Contacts</Link>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={c.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {c.company && <span className="flex items-center gap-1"><Building2 className="size-3.5" />{c.company}</span>}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-ink"><Phone className="size-3.5" />{c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-ink"><Mail className="size-3.5" />{c.email}</a>}
              {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink"><MessageCircle className="size-3.5" />WhatsApp</a>}
            </div>
            {c.notes && <p className="mt-2 text-sm text-muted">{c.notes}</p>}
          </div>
          <div className="flex gap-1 self-start">
            <IconButton icon={Pencil} label="Edit contact" onClick={() => modals.open('contact', { contact: c })} />
            <IconButton icon={Trash2} label="Delete contact" onClick={async () => {
              if (await confirm({ title: `Delete ${c.name}?`, body: c.dues.length ? `This also deletes ${c.dues.length} receivable/payable record(s) and their payments.` : 'This can’t be undone.', danger: true, confirmLabel: 'Delete' })) remove.mutate();
            }} />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className={cx('rounded-2xl p-4', c.net > 0 ? 'bg-in-soft' : c.net < 0 ? 'bg-out-soft' : 'bg-surface-2')}>
            <p className="text-xs font-medium text-muted">{c.net > 0 ? `${c.name.split(' ')[0]} owes you` : c.net < 0 ? `You owe ${c.name.split(' ')[0]}` : 'Balance'}</p>
            <p className={cx('mt-1 text-3xl font-bold num', c.net > 0 ? 'text-in' : c.net < 0 ? 'text-out' : '')}>{c.net === 0 ? 'Settled up' : money(Math.abs(c.net))}</p>
          </div>
          <div className="rounded-2xl border border-line p-4"><p className="text-xs text-muted">Receivable</p><p className="mt-1 text-xl font-bold num text-in">{money(c.receivable)}</p></div>
          <div className="rounded-2xl border border-line p-4"><p className="text-xs text-muted">Payable</p><p className="mt-1 text-xl font-bold num text-out">{money(c.payable)}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="in" icon={ArrowDownLeft} onClick={() => modals.open('due', { direction: 'receivable', contactId: c.id })}>They owe me</Button>
          <Button variant="out" icon={ArrowUpRight} onClick={() => modals.open('due', { direction: 'payable', contactId: c.id })}>I owe them</Button>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line p-4">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'records', label: 'Records', count: c.dues.length }, { value: 'statement', label: 'Statement' }]} />
        </div>
        {tab === 'records' ? (
          <div className="divide-y divide-line/60 p-2">
            {c.dues.length === 0 ? <Empty title="No records yet" body="Add what they owe you or what you owe them." /> : c.dues.map((d) => <DueRow key={d.id} due={d} showContact={false} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {c.ledger.length === 0 ? <Empty title="No activity yet" /> : (
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line"><th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Details</th>
                    <th className="px-3 py-3 text-right font-medium">Change</th><th className="px-5 py-3 text-right font-medium">Balance</th></tr>
                </thead>
                <tbody>
                  {c.ledger.map((e) => {
                    const sign = (e.type === 'due' ? 1 : -1) * (e.direction === 'receivable' ? 1 : -1);
                    return (
                      <tr key={`${e.type}${e.id}`} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50 cursor-pointer" onClick={() => modals.open('dueDetail', { id: e.dueId })}>
                        <td className="whitespace-nowrap px-5 py-3 text-muted">{fmtDate(e.date)}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{e.label}</p>
                          <p className="text-xs text-muted">{e.type === 'due' ? (e.direction === 'receivable' ? 'They borrowed / were billed' : 'You borrowed / were billed') : (e.direction === 'receivable' ? 'They paid you' : 'You paid them')}</p>
                        </td>
                        <td className={cx('px-3 py-3 text-right font-semibold num', sign > 0 ? 'text-in' : 'text-out')}>{sign > 0 ? '+' : '−'}{money(e.amount)}</td>
                        <td className="px-5 py-3 text-right num">
                          <span className={cx('font-semibold', e.balance > 0 ? 'text-in' : e.balance < 0 ? 'text-out' : 'text-muted')}>{money(Math.abs(e.balance))}</span>
                          <span className="block text-[11px] text-muted">{e.balance > 0 ? 'owes you' : e.balance < 0 ? 'you owe' : 'even'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
