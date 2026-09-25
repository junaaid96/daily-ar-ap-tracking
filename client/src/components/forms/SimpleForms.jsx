import { Button, Field, Input, MoneyInput, Select, Textarea, ColorPicker, Segmented, cx } from '../ui/index.jsx';
import { useSave, useAccounts } from '../../lib/queries.js';
import { api } from '../../lib/api.js';
import { currencySymbol, money, todayISO, addDaysISO } from '../../lib/format.js';
import { COLORS, ICON_CHOICES, Icon, ACCOUNT_ICONS } from '../../lib/icons.jsx';
import { useFormState, parseAmount, AccountSelect, Chips, DateQuick } from './kit.jsx';

function IconPicker({ value, onChange, color }) {
  return (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
      {ICON_CHOICES.map((name) => (
        <button key={name} type="button" onClick={() => onChange(name)} aria-label={name}
          className={cx('grid aspect-square place-items-center rounded-lg transition cursor-pointer', value === name ? 'ring-2' : 'hover:bg-surface-2 text-muted')}
          style={value === name ? { color, background: `${color}1f`, '--tw-ring-color': color } : undefined}>
          <Icon name={name} className="size-4" />
        </button>
      ))}
    </div>
  );
}

export function ContactForm({ contact, onDone }) {
  const { values: v, set, errors, fail } = useFormState({
    name: contact?.name || '', phone: contact?.phone || '', email: contact?.email || '', company: contact?.company || '', notes: contact?.notes || '',
  });
  const save = useSave((b) => (contact ? api.patch(`/contacts/${contact.id}`, b) : api.post('/contacts', b)), {
    success: contact ? 'Contact updated' : 'Contact added', onSuccess: onDone,
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(v, { onError: fail }); }}>
      <Field label="Name" error={errors.name}><Input value={v.name} onChange={set('name')} autoFocus maxLength={120} placeholder="Person or business" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" hint="Used for WhatsApp / SMS reminders"><Input type="tel" value={v.phone} onChange={set('phone')} placeholder="+8801…" /></Field>
        <Field label="Email" error={errors.email}><Input type="email" value={v.email} onChange={set('email')} /></Field>
      </div>
      <Field label="Company"><Input value={v.company} onChange={set('company')} /></Field>
      <Field label="Notes"><Textarea value={v.notes} onChange={set('notes')} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!v.name.trim()}>{contact ? 'Save' : 'Add contact'}</Button></div>
    </form>
  );
}

export function GoalForm({ goal, onDone }) {
  const { values: v, set, errors, fail } = useFormState({
    name: goal?.name || '', targetAmount: goal ? String(goal.targetAmount) : '', targetDate: goal?.targetDate || '',
    icon: goal?.icon || 'piggy-bank', color: goal?.color || '#8b5cf6', initialAmount: '', accountId: '',
  });
  const save = useSave((b) => (goal ? api.patch(`/goals/${goal.id}`, b) : api.post('/goals', b)), {
    success: goal ? 'Goal updated' : 'Goal created — you got this!', onSuccess: onDone,
  });
  const target = parseAmount(v.targetAmount);
  const t = todayISO();
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const body = { name: v.name, targetAmount: target, targetDate: v.targetDate || null, icon: v.icon, color: v.color };
      if (!goal && v.initialAmount) { body.initialAmount = parseAmount(v.initialAmount); body.accountId = v.accountId || null; }
      save.mutate(body, { onError: fail });
    }}>
      <Field label="Goal name" error={errors.name}><Input value={v.name} onChange={set('name')} autoFocus placeholder="e.g. Emergency fund, New phone" /></Field>
      <Field label="Target amount" error={errors.targetAmount}>
        <MoneyInput symbol={currencySymbol()} tone="save" value={v.targetAmount} onChange={set('targetAmount')} />
      </Field>
      <Field label="Target date (optional)" hint="We'll tell you how much to save each month">
        <Input type="date" value={v.targetDate} min={t} onChange={set('targetDate')} />
      </Field>
      <Chips value={v.targetDate} onChange={set('targetDate')} options={[
        { value: addDaysISO(t, 91), label: '3 months' }, { value: addDaysISO(t, 182), label: '6 months' },
        { value: addDaysISO(t, 365), label: '1 year' }, { value: '', label: 'No deadline' }]} />
      <Field label="Icon"><IconPicker value={v.icon} onChange={set('icon')} color={v.color} /></Field>
      <Field label="Color"><ColorPicker value={v.color} onChange={set('color')} colors={COLORS} /></Field>
      {!goal && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-line p-4">
          <Field label="Starting amount (optional)"><Input inputMode="decimal" value={v.initialAmount} onChange={set('initialAmount')} placeholder="0" /></Field>
          <Field label="Taken from"><AccountSelect value={v.accountId} onChange={set('accountId')} allowNone noneLabel="Not from an account" /></Field>
        </div>
      )}
      <div className="flex justify-end"><Button type="submit" variant="save" loading={save.isPending} disabled={!v.name.trim() || !(target > 0)}>{goal ? 'Save' : 'Create goal'}</Button></div>
    </form>
  );
}

export function ContributionForm({ goal, type: initialType = 'deposit', onDone }) {
  const { data: accounts = [] } = useAccounts();
  const { values: v, set, errors, fail } = useFormState({ type: initialType, amount: '', accountId: '', date: todayISO(), note: '' });
  const accountId = v.accountId === 'none' ? null : v.accountId || accounts[0]?.id || null;
  const amount = parseAmount(v.amount);
  const save = useSave((b) => api.post(`/goals/${goal.id}/contributions`, b), {
    success: (g) => (g.completed ? `🎉 ${g.name} is fully funded!` : v.type === 'deposit' ? `Saved ${money(amount)} toward ${g.name}` : `Withdrew ${money(amount)}`),
    onSuccess: onDone,
  });
  const presets = goal.monthlyNeeded ? [{ value: String(goal.monthlyNeeded), label: `Monthly target · ${money(goal.monthlyNeeded)}` }] : [];
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ type: v.type, amount, accountId, date: v.date, note: v.note }, { onError: fail }); }}>
      <Segmented value={v.type} onChange={set('type')} className="w-full [&>button]:flex-1"
        options={[{ value: 'deposit', label: 'Add money' }, { value: 'withdraw', label: 'Withdraw' }]} />
      <Field error={errors.amount}><MoneyInput symbol={currencySymbol()} tone="save" value={v.amount} onChange={set('amount')} autoFocus /></Field>
      {v.type === 'deposit' && presets.length > 0 && <Chips options={presets} value={v.amount} onChange={set('amount')} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={v.type === 'deposit' ? 'Move from account' : 'Return to account'}>
          <Select value={v.accountId || accounts[0]?.id || ''} onChange={set('accountId')}>
            {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.balance)}</option>)}
            <option value="none">Outside of tracked accounts</option>
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={v.date} onChange={set('date')} /></Field>
      </div>
      <Field label="Note"><Input value={v.note} onChange={set('note')} /></Field>
      <div className="flex justify-end"><Button type="submit" variant="save" loading={save.isPending} disabled={!(amount > 0)}>{v.type === 'deposit' ? 'Save money' : 'Withdraw'}</Button></div>
    </form>
  );
}

export function AccountForm({ account, onDone }) {
  const { values: v, set, errors, fail } = useFormState({
    name: account?.name || '', kind: account?.kind || 'bank', color: account?.color || '#6366f1',
    openingBalance: account ? String(account.openingBalance) : '',
  });
  const save = useSave((b) => (account ? api.patch(`/accounts/${account.id}`, b) : api.post('/accounts', b)), {
    success: account ? 'Account updated' : 'Account added', onSuccess: onDone,
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...v, openingBalance: parseAmount(v.openingBalance) || 0 }, { onError: fail }); }}>
      <Field label="Account name" error={errors.name}><Input value={v.name} onChange={set('name')} autoFocus placeholder="e.g. City Bank, bKash, Wallet" /></Field>
      <Field label="Type">
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(ACCOUNT_ICONS).map(([k, icon]) => (
            <button key={k} type="button" onClick={() => set('kind')(k)}
              className={cx('flex flex-col items-center gap-1 rounded-xl border p-2 text-xs capitalize cursor-pointer', v.kind === k ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted')}>
              <Icon name={icon} className="size-5" />{k}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Opening balance" hint="What's in this account right now, before tracking">
        <Input inputMode="decimal" value={v.openingBalance} onChange={set('openingBalance')} placeholder="0" />
      </Field>
      <Field label="Color"><ColorPicker value={v.color} onChange={set('color')} colors={COLORS} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!v.name.trim()}>{account ? 'Save' : 'Add account'}</Button></div>
    </form>
  );
}

export function TransferForm({ onDone }) {
  const { data: accounts = [] } = useAccounts();
  const active = accounts.filter((a) => !a.archived);
  const { values: v, set, errors, fail } = useFormState({ fromAccountId: '', toAccountId: '', amount: '', date: todayISO(), note: '' });
  const from = v.fromAccountId || active[0]?.id || '';
  const to = v.toAccountId || active.find((a) => a.id !== from)?.id || '';
  const amount = parseAmount(v.amount);
  const save = useSave((b) => api.post('/accounts/transfers', b), { success: 'Transfer recorded', onSuccess: onDone });
  if (active.length < 2) return <p className="text-sm text-muted pb-4">Add a second account first to move money between them.</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ fromAccountId: from, toAccountId: to, amount, date: v.date, note: v.note }, { onError: fail }); }}>
      <Field error={errors.amount}><MoneyInput symbol={currencySymbol()} value={v.amount} onChange={set('amount')} autoFocus /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From"><Select value={from} onChange={set('fromAccountId')}>{active.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.balance)}</option>)}</Select></Field>
        <Field label="To" error={errors.toAccountId}><Select value={to} onChange={set('toAccountId')}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      </div>
      <Field label="Date"><Input type="date" value={v.date} onChange={set('date')} /></Field>
      <DateQuick value={v.date} onChange={set('date')} />
      <Field label="Note"><Input value={v.note} onChange={set('note')} placeholder="e.g. ATM withdrawal" /></Field>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!(amount > 0) || from === to}>Move money</Button></div>
    </form>
  );
}

export function CategoryForm({ category, kind = 'expense', onDone }) {
  const { values: v, set, errors, fail } = useFormState({
    name: category?.name || '', kind: category?.kind || kind, icon: category?.icon || 'circle', color: category?.color || '#0ea5e9',
    monthlyBudget: category?.monthlyBudget != null ? String(category.monthlyBudget) : '',
  });
  const save = useSave((b) => (category ? api.patch(`/categories/${category.id}`, b) : api.post('/categories', b)), {
    success: category ? 'Category updated' : 'Category added', onSuccess: onDone,
  });
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      save.mutate({ ...v, monthlyBudget: v.kind === 'expense' && v.monthlyBudget !== '' ? parseAmount(v.monthlyBudget) : null }, { onError: fail });
    }}>
      {!category && <Segmented value={v.kind} onChange={set('kind')} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />}
      <Field label="Name" error={errors.name}><Input value={v.name} onChange={set('name')} autoFocus maxLength={60} /></Field>
      {v.kind === 'expense' && (
        <Field label="Monthly budget (optional)" error={errors.monthlyBudget}>
          <Input inputMode="decimal" value={v.monthlyBudget} onChange={set('monthlyBudget')} placeholder="No limit" />
        </Field>
      )}
      <Field label="Icon"><IconPicker value={v.icon} onChange={set('icon')} color={v.color} /></Field>
      <Field label="Color"><ColorPicker value={v.color} onChange={set('color')} colors={COLORS} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!v.name.trim()}>{category ? 'Save' : 'Add category'}</Button></div>
    </form>
  );
}

export function BudgetForm({ item, onDone }) {
  const { values: v, set, fail } = useFormState({ amount: item.budget != null ? String(item.budget) : '' });
  const save = useSave((b) => api.patch(`/categories/${item.id}`, b), { success: 'Budget saved', onSuccess: onDone });
  const suggested = Math.ceil((item.projected || item.spent || 0) / 10) * 10;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ monthlyBudget: v.amount === '' ? null : parseAmount(v.amount) }, { onError: fail }); }}>
      <MoneyInput symbol={currencySymbol()} value={v.amount} onChange={set('amount')} autoFocus />
      {suggested > 0 && <Chips value={v.amount} onChange={set('amount')} options={[{ value: String(suggested), label: `Your pace · ${money(suggested)}` }, { value: '', label: 'No budget' }]} />}
      <p className="text-xs text-muted">Spent so far this month: <b className="num">{money(item.spent)}</b></p>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save budget</Button></div>
    </form>
  );
}

export function RecurringForm({ rule, onDone, categories = [] }) {
  const { values: v, set, setValues, errors, fail } = useFormState({
    kind: rule?.kind || 'expense', name: rule?.name || '', amount: rule ? String(rule.amount) : '', categoryId: rule?.categoryId || '',
    accountId: rule?.accountId || '', frequency: rule?.frequency || 'monthly', every: String(rule?.every || 1),
    nextDate: rule?.nextDate || todayISO(), endDate: rule?.endDate || '', autoPost: rule?.autoPost ?? true,
  });
  const save = useSave((b) => (rule ? api.patch(`/recurring/${rule.id}`, b) : api.post('/recurring', b)), {
    success: rule ? 'Saved' : 'Recurring item added', onSuccess: onDone,
  });
  const amount = parseAmount(v.amount);
  const cats = categories.filter((c) => c.kind === v.kind);
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[v.frequency];
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      save.mutate({ ...v, amount, every: Number(v.every) || 1, categoryId: v.categoryId || null, accountId: v.accountId || null, endDate: v.endDate || null }, { onError: fail });
    }}>
      <Segmented value={v.kind} onChange={(k) => setValues((s) => ({ ...s, kind: k, categoryId: '' }))} className="w-full [&>button]:flex-1"
        options={[{ value: 'expense', label: 'Bill / subscription' }, { value: 'income', label: 'Regular income' }]} />
      <Field label="Name" error={errors.name}><Input value={v.name} onChange={set('name')} autoFocus placeholder={v.kind === 'expense' ? 'e.g. Rent, Netflix, Internet' : 'e.g. Salary'} /></Field>
      <Field error={errors.amount}><MoneyInput symbol={currencySymbol()} tone={v.kind === 'income' ? 'in' : 'out'} value={v.amount} onChange={set('amount')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeats every">
          <div className="flex gap-2">
            <Input type="number" min={1} max={365} value={v.every} onChange={set('every')} className="w-20" />
            <Select value={v.frequency} onChange={set('frequency')}>
              <option value="daily">day{v.every > 1 ? 's' : ''}</option><option value="weekly">week{v.every > 1 ? 's' : ''}</option>
              <option value="monthly">month{v.every > 1 ? 's' : ''}</option><option value="yearly">year{v.every > 1 ? 's' : ''}</option>
            </Select>
          </div>
        </Field>
        <Field label={rule ? 'Next date' : 'First date'} error={errors.nextDate}><Input type="date" value={v.nextDate} onChange={set('nextDate')} /></Field>
        <Field label="Category">
          <Select value={v.categoryId} onChange={set('categoryId')}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Account"><AccountSelect value={v.accountId} onChange={set('accountId')} allowNone /></Field>
        <Field label="Ends (optional)" error={errors.endDate}><Input type="date" value={v.endDate} min={v.nextDate} onChange={set('endDate')} /></Field>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-line p-3 cursor-pointer">
        <input type="checkbox" checked={v.autoPost} onChange={set('autoPost')} className="mt-0.5 size-4 accent-[var(--brand)]" />
        <span className="text-sm"><span className="font-medium">Log automatically</span>
          <span className="block text-xs text-muted mt-0.5">Adds the {v.kind} on each date. Turn off to confirm each {unit} yourself (useful for variable bills).</span></span>
      </label>
      <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!v.name.trim() || !(amount > 0)}>{rule ? 'Save' : 'Add'}</Button></div>
    </form>
  );
}
