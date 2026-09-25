import { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Avatar, cx } from '../ui/index.jsx';
import { useContacts } from '../../lib/queries.js';
import { money } from '../../lib/format.js';

/**
 * Type-to-search contact field. Picking an existing contact sets contactId;
 * typing a new name sets contactName so the server creates the contact inline.
 */
export default function ContactPicker({ contactId, contactName, onChange, error, placeholder = 'Search or add a person' }) {
  const { data: contacts = [] } = useContacts();
  const selected = contacts.find((c) => c.id === contactId);
  const [text, setText] = useState(selected?.name || contactName || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);

  useEffect(() => { if (selected) setText(selected.name); }, [selected]);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = text.trim().toLowerCase();
  const matches = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)).slice(0, 6);
  const exact = contacts.some((c) => c.name.toLowerCase() === q);
  const options = [...matches.map((c) => ({ type: 'c', c })), ...(q && !exact ? [{ type: 'new' }] : [])];

  const choose = (o) => {
    if (!o) return;
    if (o.type === 'c') { setText(o.c.name); onChange({ contactId: o.c.id, contactName: undefined }); }
    else onChange({ contactId: undefined, contactName: text.trim() });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <input className="input" value={text} placeholder={placeholder} aria-invalid={error ? 'true' : undefined}
        role="combobox" aria-expanded={open} aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value); setOpen(true); setActive(0);
          const match = contacts.find((c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase());
          onChange(match ? { contactId: match.id } : { contactId: undefined, contactName: e.target.value.trim() || undefined });
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && open && options.length) { e.preventDefault(); choose(options[active]); }
        }} />
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl" role="listbox">
          {options.map((o, i) => (
            <button key={o.type === 'c' ? o.c.id : 'new'} type="button" role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
              className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm cursor-pointer', i === active && 'bg-surface-2')}>
              {o.type === 'c' ? (
                <>
                  <Avatar name={o.c.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.c.name}</span>
                    {o.c.company && <span className="block truncate text-xs text-muted">{o.c.company}</span>}
                  </span>
                  {o.c.net !== 0 && (
                    <span className={cx('text-xs num font-medium', o.c.net > 0 ? 'text-in' : 'text-out')}>
                      {o.c.net > 0 ? 'owes you ' : 'you owe '}{money(Math.abs(o.c.net))}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand"><UserPlus className="size-4" /></span>
                  <span>Add “<b>{text.trim()}</b>” as a new contact</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
