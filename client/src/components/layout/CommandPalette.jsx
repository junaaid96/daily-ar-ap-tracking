import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Search, CornerDownLeft, Moon, Coins } from 'lucide-react';
import { cx, Avatar } from '../ui/index.jsx';
import { NAV } from './nav.js';
import { QUICK_ACTIONS } from './QuickAdd.jsx';
import { useModals } from '../ModalHost.jsx';
import { useContacts, useGoals } from '../../lib/queries.js';
import { money } from '../../lib/format.js';

export default function CommandPalette({ open, onClose, toggleTheme, openCurrency }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const modals = useModals();
  const { data: contacts = [] } = useContacts();
  const { data: goals = [] } = useGoals();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [
      ...QUICK_ACTIONS.map((a) => ({ group: 'Create', label: `New ${a.label.toLowerCase()}`, hint: a.key.toUpperCase(), icon: a.icon, run: () => a.run(modals, goals.filter((g) => !g.completed)) })),
      ...NAV.map((n) => ({ group: 'Go to', label: n.label, icon: n.icon, run: () => navigate(n.to) })),
      ...contacts.map((c) => ({ group: 'Contacts', label: c.name, sub: c.net ? `${c.net > 0 ? 'owes you' : 'you owe'} ${money(Math.abs(c.net))}` : c.company, avatar: c.name, run: () => navigate(`/contacts/${c.id}`) })),
      { group: 'Preferences', label: 'Toggle dark mode', icon: Moon, run: toggleTheme },
      { group: 'Preferences', label: 'Change currency', icon: Coins, run: openCurrency },
    ];
    return s ? all.filter((i) => `${i.label} ${i.sub || ''} ${i.group}`.toLowerCase().includes(s)).slice(0, 30)
      : all.filter((i) => i.group !== 'Contacts').concat(all.filter((i) => i.group === 'Contacts').slice(0, 5));
  }, [q, contacts, goals, modals, navigate, toggleTheme, openCurrency]);

  useEffect(() => { listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;
  const run = (i) => { onClose(); i?.run(); };
  let lastGroup = null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-muted" />
          <input ref={inputRef} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search pages, people, or actions…" className="h-14 flex-1 bg-transparent text-[15px] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(items[active]); }
              else if (e.key === 'Escape') onClose();
            }} />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted">No results for “{q}”</p>}
          {items.map((i, idx) => {
            const header = i.group !== lastGroup ? (lastGroup = i.group) : null;
            return (
              <div key={`${i.group}-${i.label}-${idx}`}>
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <button type="button" data-i={idx} onMouseMove={() => setActive(idx)} onClick={() => run(i)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm cursor-pointer', idx === active && 'bg-surface-2')}>
                  {i.avatar ? <Avatar name={i.avatar} size="sm" /> : i.icon && <i.icon className="size-4 text-muted" />}
                  <span className="flex-1 truncate">{i.label}{i.sub && <span className="ml-2 text-xs text-muted">{i.sub}</span>}</span>
                  {i.hint && <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">{i.hint}</kbd>}
                  {idx === active && <CornerDownLeft className="size-3.5 text-muted" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
