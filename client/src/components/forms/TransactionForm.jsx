import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { Button, Field, Input, MoneyInput, Segmented, cx, useConfirm } from '../ui/index.jsx';
import { useCategories, useSave, useSuggestions, useAccounts } from '../../lib/queries.js';
import { api } from '../../lib/api.js';
import { currencySymbol, money, todayISO } from '../../lib/format.js';
import { Icon } from '../../lib/icons.jsx';
import { useFormState, parseAmount, DateQuick, AccountSelect } from './kit.jsx';

export default function TransactionForm({ kind: initialKind = 'expense', tx, onDone }) {
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: suggestions = [] } = useSuggestions();
  const editing = Boolean(tx);
  const lastAccount = (() => { try { return localStorage.getItem('ledgerly-last-account'); } catch { return null; } })();
  const { values: v, set, setValues, errors, fail } = useFormState({
    kind: tx?.kind || initialKind,
    amount: tx ? String(tx.amount) : '',
    categoryId: tx?.categoryId || '',
    accountId: tx?.accountId || lastAccount || '',
    occurredOn: tx?.occurredOn || todayISO(),
    note: tx?.note || '',
  });
  const [addAnother, setAddAnother] = useState(false);
  const accountId = v.accountId && accounts.some((a) => a.id === v.accountId) ? v.accountId : accounts[0]?.id || '';
  const cats = categories.filter((c) => c.kind === v.kind);
  const amount = parseAmount(v.amount);
  const showsMath = /[+\-*/]/.test(String(v.amount).slice(1)) && Number.isFinite(amount);

  const save = useSave(
    (body) => (editing ? api.patch(`/transactions/${tx.id}`, body) : api.post('/transactions', body)),
    {
      success: editing ? 'Saved' : (d) => `${d.kind === 'income' ? 'Income' : 'Expense'} of ${money(d.amount)} added`,
      onSuccess: () => {
        try { localStorage.setItem('ledgerly-last-account', accountId); } catch { /* ignore */ }
        if (addAnother && !editing) setValues((s) => ({ ...s, amount: '', note: '' }));
        else onDone?.();
      },
    },
  );

  const confirm = useConfirm();
  const remove = useSave(() => api.del(`/transactions/${tx.id}`), { success: 'Entry deleted', onSuccess: onDone });
  const quick = useMemo(() => suggestions.filter((s) => s.kind === v.kind).slice(0, 6), [suggestions, v.kind]);

  const submit = (e) => {
    e.preventDefault();
    save.mutate({ kind: v.kind, amount, categoryId: v.categoryId || null, accountId: accountId || null, occurredOn: v.occurredOn, note: v.note },
      { onError: fail });
  };

  const tone = v.kind === 'income' ? 'in' : 'out';
  return (
    <form onSubmit={submit} className="space-y-5">
      <Segmented value={v.kind} onChange={(k) => setValues((s) => ({ ...s, kind: k, categoryId: '' }))} className="w-full [&>button]:flex-1"
        options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      <Field error={errors.amount} hint={showsMath ? `= ${money(amount)}` : 'Tip: type 12+8.5 to add up a split bill'}>
        <MoneyInput symbol={currencySymbol()} tone={tone} value={v.amount} onChange={set('amount')} autoFocus error={errors.amount} />
      </Field>

      {quick.length > 0 && !editing && (
        <div className="-mt-2 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {quick.map((s) => (
            <button type="button" key={s.note + s.categoryId}
              onClick={() => setValues((x) => ({ ...x, note: s.note, categoryId: s.categoryId || x.categoryId, amount: x.amount || String(s.typicalAmount) }))}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink hover:border-brand cursor-pointer">
              {s.note} · {money(s.typicalAmount)}
            </button>
          ))}
        </div>
      )}

      <Field label="Category" error={errors.categoryId}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {cats.map((c) => (
            <button key={c.id} type="button" onClick={() => set('categoryId')(v.categoryId === c.id ? '' : c.id)}
              className={cx('flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] leading-tight transition cursor-pointer',
                v.categoryId === c.id ? 'border-transparent ring-2' : 'border-line hover:bg-surface-2')}
              style={v.categoryId === c.id ? { '--tw-ring-color': c.color, background: `${c.color}14` } : undefined}>
              <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${c.color}1f`, color: c.color }}>
                <Icon name={c.icon} className="size-4" />
              </span>
              <span className="line-clamp-2 text-center">{c.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={v.kind === 'income' ? 'Into account' : 'Paid from'}>
          <AccountSelect value={accountId} onChange={set('accountId')} />
        </Field>
        <Field label="Date" error={errors.occurredOn}>
          <Input type="date" value={v.occurredOn} onChange={set('occurredOn')} max="2100-12-31" />
        </Field>
      </div>
      <DateQuick value={v.occurredOn} onChange={set('occurredOn')} />
      <Field label="Note" error={errors.note}>
        <Input value={v.note} onChange={set('note')} placeholder={v.kind === 'income' ? 'e.g. Freelance project' : 'e.g. Lunch with team'} maxLength={300} />
      </Field>

      <div className="flex items-center justify-between gap-3 pt-1">
        {!editing ? (
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
            <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            Add another
          </label>
        ) : (
          <Button type="button" variant="ghost" icon={Trash2} className="text-out" loading={remove.isPending}
            onClick={async () => { if (await confirm({ title: 'Delete this entry?', body: 'This can’t be undone.', danger: true, confirmLabel: 'Delete' })) remove.mutate(); }}>
            Delete
          </Button>
        )}
        <Button type="submit" variant={tone} size="lg" loading={save.isPending} icon={v.kind === 'income' ? ArrowDownLeft : ArrowUpRight}
          disabled={!Number.isFinite(amount) || amount <= 0}>
          {editing ? 'Save changes' : `Add ${v.kind}`}
        </Button>
      </div>
    </form>
  );
}
