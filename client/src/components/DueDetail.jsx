import { useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, HandCoins, Pencil, Trash2, Send, Ban, Undo2, Copy, MessageCircle, Mail, Smartphone, X, Share2 } from 'lucide-react';
import { Button, Progress, StatusBadge, Avatar, Skeleton, IconButton, useConfirm, cx } from './ui/index.jsx';
import { useDue, useSave } from '../lib/queries.js';
import { api } from '../lib/api.js';
import { money, fmtDate, relativeDue } from '../lib/format.js';
import { useModals } from './ModalHost.jsx';
import { useAuth } from '../lib/auth.jsx';
import { toast } from 'sonner';

export function reminderText(due, senderName) {
  const when = due.dueDate ? (due.daysOverdue > 0 ? ` was due on ${fmtDate(due.dueDate)}` : ` is due on ${fmtDate(due.dueDate)}`) : '';
  const ref = due.reference ? ` (${due.reference})` : '';
  return `Hi ${due.contact.name.split(' ')[0]}, a friendly reminder that ${money(due.outstanding)} for “${due.title}”${ref}${when}. `
    + `${due.paidAmount > 0 ? `Thanks for the ${money(due.paidAmount)} already paid! ` : ''}Please let me know when you can settle it. — ${senderName}`;
}

function ReminderPanel({ due, onClose }) {
  const { user } = useAuth();
  const [text, setText] = useState(() => reminderText(due, user?.name || ''));
  const phone = (due.contact.phone || '').replace(/[^\d+]/g, '');
  const enc = encodeURIComponent(text);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('Reminder copied'); } catch { toast.error('Copy failed'); }
  };
  const links = [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/${phone.replace('+', '')}?text=${enc}`, color: '#25D366' },
    phone && { label: 'SMS', icon: Smartphone, href: `sms:${phone}?&body=${enc}`, color: '#0ea5e9' },
    due.contact.email && { label: 'Email', icon: Mail, href: `mailto:${due.contact.email}?subject=${encodeURIComponent(`Reminder: ${due.title}`)}&body=${enc}`, color: '#6366f1' },
  ].filter(Boolean);
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4 space-y-3 animate-pop">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Send a friendly reminder</p>
        <IconButton icon={X} label="Close reminder" size="sm" onClick={onClose} />
      </div>
      <textarea className="input text-sm" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white" style={{ background: l.color }}>
            <l.icon className="size-4" />{l.label}
          </a>
        ))}
        {navigator.share && <Button size="sm" variant="secondary" icon={Share2} onClick={() => navigator.share({ text }).catch(() => {})}>Share…</Button>}
        <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copy</Button>
      </div>
    </div>
  );
}

export default function DueDetail({ id, onClose }) {
  const { data: due, isLoading } = useDue(id);
  const modals = useModals();
  const confirm = useConfirm();
  const [remind, setRemind] = useState(false);
  const settle = useSave(() => api.post(`/dues/${id}/settle`, {}), { success: 'Marked as fully settled 🎉' });
  const writeOff = useSave((v) => api.patch(`/dues/${id}`, { writtenOff: v }), { success: (_, v) => (v ? 'Written off' : 'Restored') });
  const remove = useSave(() => api.del(`/dues/${id}`), { success: 'Deleted', onSuccess: onClose });
  const removePayment = useSave((pid) => api.del(`/dues/${id}/payments/${pid}`), { success: 'Payment removed' });

  if (isLoading || !due) return <div className="space-y-3 pb-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  const isR = due.direction === 'receivable';
  const done = due.outstanding === 0;
  const tone = isR ? 'in' : 'out';

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center gap-3">
        <Avatar name={due.contact.name} />
        <div className="min-w-0 flex-1">
          <Link to={`/contacts/${due.contact.id}`} onClick={onClose} className="font-semibold hover:underline">{due.contact.name}</Link>
          <p className="text-sm text-muted truncate">{due.title}{due.reference ? ` · ${due.reference}` : ''}</p>
        </div>
        <StatusBadge status={due.status} />
      </div>

      <div className={cx('rounded-2xl p-5', isR ? 'bg-in-soft' : 'bg-out-soft')}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{done ? 'Settled' : isR ? 'They still owe you' : 'You still owe'}</p>
        <p className={cx('mt-1 text-4xl font-bold num', isR ? 'text-in' : 'text-out')}>{money(done ? due.amount : due.outstanding)}</p>
        <Progress value={due.paidAmount / due.amount} tone={tone} className="mt-4 bg-surface/70" />
        <div className="mt-2 flex justify-between text-xs text-muted num">
          <span>{money(due.paidAmount)} paid of {money(due.amount)}</span>
          <span className={cx(due.daysOverdue > 0 && !done && 'text-out font-semibold')}>{done ? `Last paid ${fmtDate(due.lastPaidOn)}` : relativeDue(due.daysUntilDue)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Issued</p><p className="font-medium">{fmtDate(due.issueDate)}</p></div>
        <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Due</p><p className="font-medium">{fmtDate(due.dueDate)}</p></div>
      </div>
      {due.notes && <p className="rounded-xl bg-surface-2/60 p-3 text-sm text-muted whitespace-pre-wrap">{due.notes}</p>}

      {!done && !due.writtenOff && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant={tone} icon={HandCoins} onClick={() => modals.open('payment', { due })}>{isR ? 'Record received' : 'Record payment'}</Button>
          <Button variant="secondary" icon={CircleCheck} loading={settle.isPending}
            onClick={async () => { if (await confirm({ title: 'Mark as fully settled?', body: `Records a final payment of ${money(due.outstanding)}.`, confirmLabel: 'Settle' })) settle.mutate(); }}>
            Settle in full
          </Button>
          {isR && <Button variant="secondary" icon={Send} className="col-span-2" onClick={() => setRemind((r) => !r)}>Send reminder</Button>}
        </div>
      )}
      {remind && <ReminderPanel due={due} onClose={() => setRemind(false)} />}

      <div>
        <p className="mb-2 text-sm font-semibold">Payment history</p>
        {due.payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">No payments yet</p>
        ) : (
          <ol className="relative space-y-1 border-l-2 border-line pl-4 ml-2">
            {due.payments.map((p) => (
              <li key={p.id} className="group relative flex items-center justify-between gap-3 rounded-xl py-2 pr-1">
                <span className={cx('absolute -left-[23px] size-3 rounded-full ring-4 ring-surface', isR ? 'bg-in' : 'bg-out')} />
                <div className="min-w-0">
                  <p className="text-sm font-medium num">{money(p.amount)}</p>
                  <p className="text-xs text-muted truncate">{fmtDate(p.paidOn)}{p.accountName ? ` · ${p.accountName}` : ''}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
                <IconButton icon={Trash2} label="Remove payment" size="sm" className="opacity-60 sm:opacity-0 group-hover:opacity-100"
                  onClick={async () => { if (await confirm({ title: 'Remove this payment?', body: 'The balance will go back up.', danger: true, confirmLabel: 'Remove' })) removePayment.mutate(p.id); }} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => modals.open('due', { due })}>Edit</Button>
        {!done || due.writtenOff ? (
          <Button variant="ghost" size="sm" icon={due.writtenOff ? Undo2 : Ban} onClick={async () => {
            if (due.writtenOff || await confirm({ title: 'Write this off?', body: 'Use this when the money won’t be recovered. It stops counting toward your totals, and you can restore it later.', confirmLabel: 'Write off' })) writeOff.mutate(!due.writtenOff);
          }}>{due.writtenOff ? 'Restore' : 'Write off'}</Button>
        ) : null}
        <Button variant="ghost" size="sm" icon={Trash2} className="text-out ml-auto" onClick={async () => {
          if (await confirm({ title: 'Delete this record?', body: 'This also deletes its payment history. This can’t be undone.', danger: true, confirmLabel: 'Delete' })) remove.mutate();
        }}>Delete</Button>
      </div>
    </div>
  );
}
