import { LayoutDashboard, ArrowDownLeft, ArrowUpRight, Users, CalendarDays, Target, PiggyBank, Repeat, ChartColumn, Wallet, Settings } from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/daily', label: 'Daily log', icon: CalendarDays },
  { to: '/receivables', label: 'Receivables', icon: ArrowDownLeft, tone: 'in' },
  { to: '/payables', label: 'Payables', icon: ArrowUpRight, tone: 'out' },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/recurring', label: 'Bills & recurring', icon: Repeat },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const MOBILE_NAV = ['/', '/daily', null, '/receivables', '/savings'];
