import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, LoaderCircle, Inbox } from 'lucide-react';
import { money, initials, avatarColor } from '../../lib/format.js';

export const cx = clsx;

const BTN = {
  primary: 'bg-brand text-white dark:text-slate-900 hover:brightness-110 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-out text-white hover:brightness-110',
  in: 'bg-in text-white dark:text-slate-900 hover:brightness-110',
  out: 'bg-out text-white dark:text-slate-900 hover:brightness-110',
  save: 'bg-save text-white dark:text-slate-900 hover:brightness-110',
};
const SIZE = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, icon: IconC, className, children, disabled, ...props }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer', BTN[variant], SIZE[size], className)}
      {...props}>
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : IconC ? <IconC className="size-4 shrink-0" /> : null}
      {children}
    </button>
  );
});

export function IconButton({ icon: IconC, label, className, size = 'md', ...props }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx('inline-flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-surface-2 transition cursor-pointer', size === 'sm' ? 'size-8' : 'size-10', className)} {...props}>
      <IconC className={size === 'sm' ? 'size-4' : 'size-5'} />
    </button>
  );
}

export function Field({ label, error, hint, children, className, htmlFor }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink/80">{label}</label>}
      {children}
      {error ? <p className="text-xs text-out">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return <input ref={ref} aria-invalid={error ? 'true' : undefined} className={cx('input', className)} {...props} />;
});
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={cx('input', className)} {...props}>{children}</select>;
});
export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('input', className)} rows={3} {...props} />;
});

/** Big, friendly amount entry with the currency symbol baked in. */
export const MoneyInput = forwardRef(function MoneyInput({ symbol, tone = 'ink', error, className, ...props }, ref) {
  const tones = { ink: 'text-ink', in: 'text-in', out: 'text-out', save: 'text-save' };
  return (
    <div className={cx('flex items-center rounded-2xl border bg-surface-2/60 px-4 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-[var(--ring)]', error ? 'border-out' : 'border-line', className)}>
      <span className="text-xl font-semibold text-muted mr-2">{symbol}</span>
      <input ref={ref} inputMode="decimal" autoComplete="off" placeholder="0.00"
        className={cx('h-16 w-full bg-transparent text-3xl font-bold num outline-none placeholder:text-muted/40', tones[tone])} {...props} />
    </div>
  );
});

export function Card({ className, children, ...props }) {
  return <div className={cx('card', className)} {...props}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon: IconC }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
        {IconC && <IconC className="size-4 text-muted shrink-0" />}
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const BADGE = {
  neutral: 'bg-surface-2 text-muted', in: 'bg-in-soft text-in', out: 'bg-out-soft text-out', warn: 'bg-warn-soft text-warn',
  save: 'bg-save-soft text-save', brand: 'bg-brand-soft text-brand',
};
export function Badge({ tone = 'neutral', className, children, icon: IconC }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap', BADGE[tone], className)}>
      {IconC && <IconC className="size-3" />}{children}
    </span>
  );
}

export const STATUS = {
  open: { tone: 'brand', label: 'Open' },
  partial: { tone: 'warn', label: 'Partial' },
  overdue: { tone: 'out', label: 'Overdue' },
  paid: { tone: 'in', label: 'Settled' },
  written_off: { tone: 'neutral', label: 'Written off' },
};
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone}>{STATUS[status]?.label || status}</Badge>;

export function Progress({ value, color, className, tone }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const toneColor = { in: 'var(--in)', out: 'var(--out)', warn: 'var(--warn)', save: 'var(--save)', brand: 'var(--brand)' }[tone];
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v * 100}%`, background: color || toneColor || 'var(--brand)' }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--brand)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold num">{children}</div>
    </div>
  );
}

export function Empty({ icon: IconC = Inbox, title, body, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><IconC className="size-6" /></div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-lg bg-surface-2', className)} />;

export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-lg font-medium transition cursor-pointer whitespace-nowrap', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {o.label}{o.count !== undefined && <span className="ml-1.5 text-xs text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Amount({ value, tone, sign, className, compact }) {
  const tones = { in: 'text-in', out: 'text-out', save: 'text-save', muted: 'text-muted' };
  const prefix = sign === 'in' ? '+' : sign === 'out' ? '−' : '';
  return <span className={cx('num font-semibold', tones[tone], className)}>{prefix}{money(Math.abs(value))}{compact}</span>;
}

export function Avatar({ name, size = 'md', className }) {
  const s = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }[size];
  return (
    <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', s, className)} style={{ background: avatarColor(name) }}>
      {initials(name)}
    </div>
  );
}

export function CategoryDot({ icon: IconC, color, size = 'md' }) {
  const s = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-2xl' }[size];
  return (
    <div className={cx('grid shrink-0 place-items-center', s)} style={{ background: `${color}1f`, color }}>
      {IconC}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const Spinner = ({ className }) => <LoaderCircle className={cx('size-5 animate-spin text-muted', className)} />;

// ---------------------------------------------------------------------------
// Modal: centered dialog on desktop, bottom sheet on phones.
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', tone }) {
  const titleId = useId();
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Fields using autoFocus win; otherwise focus the first control so keyboard users land inside.
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      panel.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea, button')?.focus();
    }, 60);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  const bar = { in: 'bg-in', out: 'bg-out', save: 'bg-save', brand: 'bg-brand' }[tone];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div ref={panelRef}
        className={cx('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl animate-sheet sm:animate-pop sm:rounded-3xl border border-line', widths[size])}>
        {bar && <div className={cx('h-1 w-full', bar)} />}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-2" />
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Promise-based confirm dialog: `if (await confirm({...})) doIt()`
const ConfirmCtx = createContext(() => Promise.resolve(false));
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={Boolean(state)} onClose={() => close(false)} title={state?.title} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmLabel || 'Confirm'}</Button>
        </>}>
        <p className="text-sm text-muted">{state?.body}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---------------------------------------------------------------------------
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger}</div>
      {open && (
        <div className={cx('absolute z-30 mt-1 min-w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl animate-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {items.filter(Boolean).map((it) => (
            <button key={it.label} type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer', it.danger && 'text-out')}>
              {it.icon && <it.icon className="size-4" />}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ColorPicker({ value, onChange, colors }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button key={c} type="button" aria-label={c} onClick={() => onChange(c)}
          className={cx('size-7 rounded-full transition cursor-pointer', value === c ? 'ring-2 ring-offset-2 ring-offset-surface' : 'hover:scale-110')}
          style={{ background: c, '--tw-ring-color': c }} />
      ))}
    </div>
  );
}
