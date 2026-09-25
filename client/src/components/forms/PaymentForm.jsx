import { Button, Field, Input, MoneyInput } from '../ui/index.jsx';
import { useSave } from '../../lib/queries.js';
import { api } from '../../lib/api.js';
import { currencySymbol, money, todayISO } from '../../lib/format.js';
import { useFormState, parseAmount, DateQuick, AccountSelect, Chips } from './kit.jsx';
import { useAccounts } from '../../lib/queries.js';

export default function PaymentForm({ due, onDone }) {
  const { data: accounts = [] } = useAccounts();
  const isR = due.direction === 'receivable';
  const { values: v, set, errors, fail } = useFormState({
    amount: String(due.outstanding), paidOn: todayISO(), accountId: '', note: '',
  });
  const accountId = v.accountId || accounts[0]?.id || '';
  const amount = parseAmount(v.amount);
  const save = useSave((body) => api.post(`/dues/${due.id}/payments`, body), {
    success: (d) => (d.outstanding === 0 ? `Fully settled with ${d.contact.name} 🎉` : `${money(amount)} recorded · ${money(d.outstanding)} left`),
    onSuccess: (d) => onDone?.(d),
  });
  const presets = [
    { value: String(due.outstanding), label: `Full · ${money(due.outstanding)}` },
    { value: String(Math.round(due.outstanding * 50) / 100), label: 'Half' },
    { value: String(Math.round(due.outstanding * 25) / 100), label: 'Quarter' },
  ];
  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      save.mutate({ amount, paidOn: v.paidOn, accountId: accountId || null, note: v.note }, { onError: fail });
    }}>
      <div className="rounded-2xl bg-surface-2/60 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">{isR ? 'Still owed to you' : 'You still owe'}</span><b className="num">{money(due.outstanding)}</b></div>
        <div className="mt-1 flex justify-between text-muted"><span>of {money(due.amount)} · {due.contact.name}</span><span>{due.title}</span></div>
      </div>
      <Field error={errors.amount}>
        <MoneyInput symbol={currencySymbol()} tone={isR ? 'in' : 'out'} value={v.amount} onChange={set('amount')} autoFocus error={errors.amount} />
      </Field>
      <Chips options={presets} value={v.amount} onChange={set('amount')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isR ? 'Received into' : 'Paid from'}><AccountSelect value={accountId} onChange={set('accountId')} /></Field>
        <Field label="Date" error={errors.paidOn}><Input type="date" value={v.paidOn} onChange={set('paidOn')} /></Field>
      </div>
      <DateQuick value={v.paidOn} onChange={set('paidOn')} />
      <Field label="Note"><Input value={v.note} onChange={set('note')} placeholder="e.g. Bank transfer, cash" maxLength={300} /></Field>
      <div className="flex justify-end">
        <Button type="submit" size="lg" variant={isR ? 'in' : 'out'} loading={save.isPending}
          disabled={!Number.isFinite(amount) || amount <= 0 || amount > due.outstanding + 0.001}>
          {isR ? 'Record money received' : 'Record payment made'}
        </Button>
      </div>
    </form>
  );
}
