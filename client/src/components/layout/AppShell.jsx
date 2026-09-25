import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Plus, Search, Sun, Moon, LogOut, Settings, ArrowDownLeft, ArrowUpRight, FlaskConical, Coins } from 'lucide-react';
import { cx, IconButton, Menu, Avatar, Button } from '../ui/index.jsx';
import { NAV, MOBILE_NAV } from './nav.js';
import QuickAdd, { QUICK_ACTIONS } from './QuickAdd.jsx';
import CommandPalette from './CommandPalette.jsx';
import { useModals } from '../ModalHost.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useTheme } from '../../lib/theme.js';
import { useGoals } from '../../lib/queries.js';
import { CurrencyButton, CurrencyPickerModal } from '../CurrencyPicker.jsx';

export function Logo({ className }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="font-display text-lg font-extrabold tracking-tight">Ledgerly</span>
    </div>
  );
}

function SideNav() {
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}
          className={({ isActive }) => cx('group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
            isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
          <n.icon className={cx('size-[18px]', n.tone === 'in' && 'text-in', n.tone === 'out' && 'text-out')} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [dark, toggleTheme] = useTheme();
  const [quick, setQuick] = useState(false);
  const [palette, setPalette] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const modals = useModals();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: goals } = useGoals();

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); return; }
      if (e.key === 'n') { e.preventDefault(); setQuick(true); return; }
      const a = QUICK_ACTIONS.find((x) => x.key === e.key);
      if (a) { e.preventDefault(); a.run(modals, goals?.filter((g) => !g.completed && !g.archived)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modals, goals]);

  const mobile = MOBILE_NAV.map((to) => (to ? NAV.find((n) => n.to === to) : null));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pb-4 pt-5"><Logo /></div>
        <div className="px-3 pb-3">
          <Button className="w-full" icon={Plus} onClick={() => setQuick(true)}>Quick add <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[10px]">N</kbd></Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => modals.open('transaction', { kind: 'expense' })} className="flex items-center justify-center gap-1.5 rounded-xl bg-out-soft py-2 text-xs font-semibold text-out cursor-pointer hover:brightness-95">
              <ArrowUpRight className="size-3.5" />Expense
            </button>
            <button onClick={() => modals.open('transaction', { kind: 'income' })} className="flex items-center justify-center gap-1.5 rounded-xl bg-in-soft py-2 text-xs font-semibold text-in cursor-pointer hover:brightness-95">
              <ArrowDownLeft className="size-3.5" />Income
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4"><SideNav /></div>
        <div className="border-t border-line p-3">
          <Menu align="left" trigger={
            <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2 cursor-pointer">
              <Avatar name={user?.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{user?.name}</span>
                <span className="block truncate text-xs text-muted">{user?.email}</span>
              </span>
            </button>
          } items={[
            { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
            { label: `Currency · ${user?.currency}`, icon: Coins, onClick: () => setCurrencyOpen(true) },
            { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? Sun : Moon, onClick: toggleTheme },
            { label: 'Sign out', icon: LogOut, onClick: logout, danger: true },
          ]} />
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Logo className="lg:hidden" />
          <button onClick={() => setPalette(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted hover:text-ink sm:w-72 lg:ml-0 cursor-pointer">
            <Search className="size-4" /><span className="hidden sm:inline">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1 lg:ml-auto">
            {user?.isDemo && <span className="hidden items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn sm:flex"><FlaskConical className="size-3.5" />Demo sandbox</span>}
            <CurrencyButton className="hidden sm:flex" />
            <IconButton icon={dark ? Sun : Moon} label="Toggle theme" onClick={toggleTheme} />
            <div className="lg:hidden">
              <Menu trigger={<button className="ml-1 cursor-pointer" aria-label="Account menu"><Avatar name={user?.name} size="sm" /></button>} items={[
                { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
                { label: `Currency · ${user?.currency}`, icon: Coins, onClick: () => setCurrencyOpen(true) },
                ...NAV.filter((n) => !MOBILE_NAV.includes(n.to) && n.to !== '/settings').map((n) => ({ label: n.label, icon: n.icon, onClick: () => navigate(n.to) })),
                { label: 'Sign out', icon: LogOut, onClick: logout, danger: true },
              ]} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {mobile.map((n, i) => (n ? (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand' : 'text-muted')}>
              <n.icon className="size-5" />{n.label.split(' ')[0]}
            </NavLink>
          ) : (
            <div key={i} className="flex justify-center">
              <button onClick={() => setQuick(true)} aria-label="Quick add"
                className="-mt-5 grid size-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 active:scale-95 transition dark:text-slate-900 cursor-pointer">
                <Plus className="size-7" />
              </button>
            </div>
          )))}
        </div>
      </nav>

      <QuickAdd open={quick} onClose={() => setQuick(false)} />
      <CurrencyPickerModal open={currencyOpen} onClose={() => setCurrencyOpen(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} toggleTheme={toggleTheme} openCurrency={() => setCurrencyOpen(true)} />
    </div>
  );
}
