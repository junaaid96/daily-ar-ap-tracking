import { useState } from 'react';
import { cx, Select } from '../ui/index.jsx';
import { useAccounts } from '../../lib/queries.js';
import { todayISO, addDaysISO } from '../../lib/format.js';

export function useFormState(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => {
    const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const fail = (err) => setErrors(err?.fields || {});
  return { values, setValues, set, errors, setErrors, fail };
}

/** Parse "1,234.50" or "12+8" style amounts. Simple arithmetic keeps split bills quick. */
export function parseAmount(s) {
  if (typeof s === 'number') return s;
  const clean = String(s || '').replace(/[,\s]/g, '');
  if (!clean) return NaN;
  if (/^[\d.+\-*/()]+$/.test(clean) && /[+\-*/]/.test(clean.slice(1))) {
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${clean})`)();
      return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
    } catch { return NaN; }
  }
  return Number(clean);
}

export function Chips({ options, value, onChange, className }) {
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer',
            value === o.value ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:text-ink hover:border-muted/40')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DateQuick({ value, onChange, mode = 'past' }) {
  const t = todayISO();
  const opts = mode === 'past'
    ? [{ value: t, label: 'Today' }, { value: addDaysISO(t, -1), label: 'Yesterday' }, { value: addDaysISO(t, -2), label: '2 days ago' }]
    : [{ value: addDaysISO(t, 7), label: '1 week' }, { value: addDaysISO(t, 14), label: '2 weeks' }, { value: addDaysISO(t, 30), label: '30 days' }, { value: '', label: 'No due date' }];
  return <Chips options={opts} value={value} onChange={onChange} />;
}

export function AccountSelect({ value, onChange, allowNone, noneLabel = 'No account', ...props }) {
  const { data = [] } = useAccounts();
  return (
    <Select value={value || ''} onChange={onChange} {...props}>
      {allowNone && <option value="">{noneLabel}</option>}
      {data.filter((a) => !a.archived || a.id === value).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </Select>
  );
}
