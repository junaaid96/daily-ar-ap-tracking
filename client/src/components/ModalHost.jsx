import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Spinner } from './ui/index.jsx';
import { useCategories } from '../lib/queries.js';

const loaders = {
  transaction: () => import('./forms/TransactionForm.jsx'),
  due: () => import('./forms/DueForm.jsx'),
  payment: () => import('./forms/PaymentForm.jsx'),
  detail: () => import('./DueDetail.jsx'),
  simple: () => import('./forms/SimpleForms.jsx'),
};
const TransactionForm = lazy(loaders.transaction);
const DueForm = lazy(loaders.due);
const PaymentForm = lazy(loaders.payment);
const DueDetail = lazy(loaders.detail);
const Simple = {
  contact: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.ContactForm }))),
  goal: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.GoalForm }))),
  contribution: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.ContributionForm }))),
  account: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.AccountForm }))),
  transfer: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.TransferForm }))),
  category: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.CategoryForm }))),
  budget: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.BudgetForm }))),
  recurring: lazy(() => import('./forms/SimpleForms.jsx').then((m) => ({ default: m.RecurringForm }))),
};

const Ctx = createContext(null);
export const useModals = () => useContext(Ctx);

function meta(type, p) {
  switch (type) {
    case 'transaction': return { title: p.tx ? 'Edit entry' : 'New entry', subtitle: 'Log what came in or went out', tone: (p.tx?.kind || p.kind) === 'income' ? 'in' : 'out' };
    case 'due': return p.due
      ? { title: 'Edit record', tone: p.due.direction === 'receivable' ? 'in' : 'out' }
      : { title: p.direction === 'payable' ? 'New payable' : 'New receivable', subtitle: p.direction === 'payable' ? 'Money you owe someone' : 'Money someone owes you', tone: p.direction === 'payable' ? 'out' : 'in' };
    case 'payment': return { title: p.due.direction === 'receivable' ? 'Record money received' : 'Record a payment', tone: p.due.direction === 'receivable' ? 'in' : 'out', size: 'md' };
    case 'dueDetail': return { title: 'Details', size: 'md' };
    case 'contact': return { title: p.contact ? 'Edit contact' : 'New contact' };
    case 'goal': return { title: p.goal ? 'Edit goal' : 'New savings goal', tone: 'save' };
    case 'contribution': return { title: p.goal.name, subtitle: 'Move money in or out of this goal', tone: 'save' };
    case 'account': return { title: p.account ? 'Edit account' : 'New account', subtitle: 'Cash, bank, mobile wallet or card' };
    case 'transfer': return { title: 'Move money', subtitle: 'Between your own accounts' };
    case 'category': return { title: p.category ? 'Edit category' : 'New category' };
    case 'budget': return { title: `Budget · ${p.item.name}`, subtitle: 'Monthly spending limit', size: 'sm' };
    case 'recurring': return { title: p.rule ? 'Edit recurring item' : 'New recurring item', subtitle: 'Bills, subscriptions and regular income' };
    default: return { title: '' };
  }
}

export function ModalHost({ children }) {
  // A small stack so e.g. "record payment" can open on top of the detail sheet.
  const [stack, setStack] = useState([]);
  const { data: categories = [] } = useCategories();
  // Warm the form chunks once the app is idle so the first "E" press opens instantly.
  useEffect(() => {
    const t = setTimeout(() => Object.values(loaders).forEach((load) => load().catch(() => {})), 1200);
    return () => clearTimeout(t);
  }, []);
  const open = useCallback((type, props = {}) => setStack((s) => [...s, { type, props, key: Date.now() + Math.random() }]), []);
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  const top = stack[stack.length - 1];
  let body = null;
  if (top) {
    const p = { ...top.props, onDone: close, onClose: close };
    const t = top.type;
    body = t === 'transaction' ? <TransactionForm {...p} />
      : t === 'due' ? <DueForm {...p} />
        : t === 'payment' ? <PaymentForm {...p} />
          : t === 'dueDetail' ? <DueDetail {...p} />
            : Simple[t] ? (() => { const C = Simple[t]; return <C {...p} categories={categories} />; })() : null;
  }
  const m = top ? meta(top.type, top.props) : {};
  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={Boolean(top)} onClose={close} title={m.title} subtitle={m.subtitle} tone={m.tone} size={m.size} key={top?.key}>
        <Suspense fallback={<div className="grid h-40 place-items-center"><Spinner /></div>}>{body}</Suspense>
      </Modal>
    </Ctx.Provider>
  );
}
