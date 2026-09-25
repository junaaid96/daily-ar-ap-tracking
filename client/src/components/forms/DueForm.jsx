import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Field, Input, MoneyInput, Segmented, Textarea, cx } from '../ui/index.jsx';
import { useSave } from '../../lib/queries.js';
import { api } from '../../lib/api.js';
import { currencySymbol, money, todayISO } from '../../lib/format.js';
import { useFormState, parseAmount, DateQuick, AccountSelect } from './kit.jsx';
import ContactPicker from './ContactPicker.jsx';

export default function DueForm({ direction: initialDirection = 'receivable', due, contactId: presetContact, onDone }) {
  const editing = Boolean(due);
  const { values: v, set, setValues, errors, fail } = useFormState({
    direction: due?.direction || initialDirection,
    contactId: due?.contact?.id || presetContact,
    contactName: undefined,
    title: due?.title || '',
    amount: due ? String(due.amount) : '',
    issueDate: due?.issueDate || todayISO(),
    dueDate: due?.dueDate || '',
    moved: Boolean(due?.accountId),
    accountId: due?.accountId || '',
    reference: due?.reference || '',
    notes: due?.notes || '',
  });
  const [more, setMore] = useState(Boolean(due?.reference || due?.notes || due?.accountId));
  const isR = v.direction === 'receivable';
  const amount = parseAmount(v.amount);

  const save = useSave(
    (body) => (editing ? api.patch(`/dues/${due.id}`, body) : api.post('/dues', body)),
    { success: editing ? 'Saved' : (d) => `${d.direction === 'receivable' ? 'Receivable' : 'Payable'} of ${money(d.amount)} recorded`, onSuccess: (d) => onDone?.(d) },
  );

  const submit = (e) => {
    e.preventDefault();
    const body = {
      title: v.title || (isR ? 'Money owed to me' : 'Money I owe'),
      amount, issueDate: v.issueDate, dueDate: v.dueDate || null,
      accountId: v.moved ? v.accountId || null : null,
      reference: v.reference, notes: v.notes,
    };
    if (v.contactId) body.contactId = v.contactId;
    if (!editing) { body.direction = v.direction; if (!v.contactId) body.contactName = v.contactName; }
    save.mutate(body, { onError: fail });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {!editing && (
        <Segmented value={v.direction} onChange={set('direction')} className="w-full [&>button]:flex-1"
          options={[{ value: 'receivable', label: 'They owe me' }, { value: 'payable', label: 'I owe them' }]} />
      )}
      <Field error={errors.amount}>
        <MoneyInput symbol={currencySymbol()} tone={isR ? 'in' : 'out'} value={v.amount} onChange={set('amount')} autoFocus error={errors.amount} />
      </Field>
      <Field label={isR ? 'Who owes you?' : 'Who do you owe?'} error={errors.contactId || errors.contactName}>
        <ContactPicker contactId={v.contactId} contactName={v.contactName}
          onChange={(c) => setValues((s) => ({ ...s, contactId: c.contactId, contactName: c.contactName }))} error={errors.contactId} />
      </Field>
      <Field label="What for?" error={errors.title}>
        <Input value={v.title} onChange={set('title')} placeholder={isR ? 'e.g. Invoice #1042, lent for rent' : 'e.g. Supplier bill, borrowed for trip'} maxLength={160} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.issueDate}><Input type="date" value={v.issueDate} onChange={set('issueDate')} /></Field>
        <Field label="Due date" error={errors.dueDate}><Input type="date" value={v.dueDate || ''} min={v.issueDate} onChange={set('dueDate')} /></Field>
      </div>
      <DateQuick mode="future" value={v.dueDate} onChange={set('dueDate')} />

      <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-sm font-medium text-brand cursor-pointer">
        <ChevronDown className={cx('size-4 transition', more && 'rotate-180')} /> More options
      </button>
      {more && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface-2/40 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={v.moved} onChange={set('moved')} className="mt-0.5 size-4 accent-[var(--brand)]" />
            <span className="text-sm">
              <span className="font-medium">{isR ? 'I handed over cash (a loan)' : 'I received cash (borrowed)'}</span>
              <span className="block text-muted text-xs mt-0.5">
                {isR ? 'Deducts the amount from an account now. Leave off for invoices / sales on credit.' : 'Adds the amount to an account now. Leave off for bills and purchases on credit.'}
              </span>
            </span>
          </label>
          {v.moved && <Field label={isR ? 'From account' : 'Into account'}><AccountSelect value={v.accountId} onChange={set('accountId')} allowNone noneLabel="Choose account" /></Field>}
          <Field label="Reference" hint="Invoice / bill number"><Input value={v.reference} onChange={set('reference')} maxLength={80} /></Field>
          <Field label="Notes"><Textarea value={v.notes} onChange={set('notes')} maxLength={2000} /></Field>
        </div>
      )}
      <div className="flex justify-end pt-1">
        <Button type="submit" size="lg" variant={isR ? 'in' : 'out'} loading={save.isPending}
          disabled={!Number.isFinite(amount) || amount <= 0 || (!v.contactId && !v.contactName)}>
          {editing ? 'Save changes' : isR ? 'Add receivable' : 'Add payable'}
        </Button>
      </div>
    </form>
  );
}
