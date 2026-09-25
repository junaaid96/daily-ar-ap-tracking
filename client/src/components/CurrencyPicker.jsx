import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Input, cx } from './ui/index.jsx';
import { allCurrencies, POPULAR, symbolFor } from '../lib/currencies.js';
import { useAuth } from '../lib/auth.jsx';

function Row({ c, active, onPick }) {
  return (
    <button type="button" onClick={() => onPick(c.code)} role="option" aria-selected={active}
      className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition cursor-pointer',
        active ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2')}>
      <span className="grid h-8 min-w-10 place-items-center rounded-lg bg-surface-2 px-1.5 text-sm font-semibold text-ink">{c.symbol}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{c.name}</span>
        <span className="block text-xs text-muted">{c.code}</span>
      </span>
      {active && <Check className="size-4" />}
    </button>
  );
}

/** Searchable currency list. Selecting saves it to the profile immediately. */
export function CurrencyPickerModal({ open, onClose }) {
  const { user, updateProfile } = useAuth();
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(null);
  const all = useMemo(() => allCurrencies(), []);
  const s = q.trim().toLowerCase();
  const matches = s ? all.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.symbol.toLowerCase() === s) : all;
  const popular = s ? [] : POPULAR.map((code) => all.find((c) => c.code === code)).filter(Boolean);

  const pick = async (code) => {
    if (code === user.currency) return onClose();
    setSaving(code);
    try {
      await updateProfile({ currency: code });
      toast.success(`Now showing amounts in ${code} (${symbolFor(code)})`, {
        description: 'Only the display currency changed — your recorded amounts stay the same.',
      });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open={open} onClose={() => { setQ(''); onClose(); }} title="Currency" subtitle="Choose how amounts are displayed across the app" size="sm">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code or symbol" className="pl-9" />
      </div>
      <div className={cx('max-h-[55vh] overflow-y-auto pb-2', saving && 'pointer-events-none opacity-60')} role="listbox" aria-label="Currencies">
        {popular.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Popular</p>
            {popular.map((c) => <Row key={`p-${c.code}`} c={c} active={c.code === user.currency} onPick={pick} />)}
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">All currencies</p>
          </>
        )}
        {matches.map((c) => <Row key={c.code} c={c} active={c.code === user.currency} onPick={pick} />)}
        {matches.length === 0 && <p className="p-6 text-center text-sm text-muted">No currency matches “{q}”</p>}
      </div>
    </Modal>
  );
}

/** Compact top-bar button showing the active currency. */
export function CurrencyButton({ className }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Change currency" aria-label={`Currency: ${user.currency}. Change currency`}
        className={cx('flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-sm font-semibold hover:bg-surface-2 cursor-pointer', className)}>
        <span className="text-brand">{symbolFor(user.currency)}</span>
        <span className="text-xs text-muted">{user.currency}</span>
      </button>
      <CurrencyPickerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Plain <select> version for forms (sign-up), with popular currencies first. */
export function CurrencySelect({ value, onChange, id }) {
  const all = useMemo(() => allCurrencies(), []);
  return (
    <select id={id} className="input" value={value} onChange={onChange}>
      <optgroup label="Popular">
        {POPULAR.map((code) => { const c = all.find((x) => x.code === code); return c && <option key={`p-${code}`} value={code}>{code} — {c.name}</option>; })}
      </optgroup>
      <optgroup label="All currencies">
        {all.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
      </optgroup>
    </select>
  );
}
