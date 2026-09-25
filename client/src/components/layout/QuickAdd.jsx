import { ArrowDownLeft, ArrowUpRight, HandCoins, Receipt, PiggyBank, ArrowLeftRight } from 'lucide-react';
import { Modal, cx } from '../ui/index.jsx';
import { useModals } from '../ModalHost.jsx';
import { useGoals } from '../../lib/queries.js';

export const QUICK_ACTIONS = [
  { key: 'e', label: 'Expense', desc: 'Money spent', icon: ArrowUpRight, cls: 'bg-out-soft text-out', run: (m) => m.open('transaction', { kind: 'expense' }) },
  { key: 'i', label: 'Income', desc: 'Money earned', icon: ArrowDownLeft, cls: 'bg-in-soft text-in', run: (m) => m.open('transaction', { kind: 'income' }) },
  { key: 'r', label: 'Receivable', desc: 'Someone owes me', icon: HandCoins, cls: 'bg-in-soft text-in', run: (m) => m.open('due', { direction: 'receivable' }) },
  { key: 'p', label: 'Payable', desc: 'I owe someone', icon: Receipt, cls: 'bg-out-soft text-out', run: (m) => m.open('due', { direction: 'payable' }) },
  { key: 's', label: 'Savings', desc: 'Put money aside', icon: PiggyBank, cls: 'bg-save-soft text-save', run: (m, goals) => (goals?.[0] ? m.open('contribution', { goal: goals[0] }) : m.open('goal')) },
  { key: 't', label: 'Transfer', desc: 'Between accounts', icon: ArrowLeftRight, cls: 'bg-brand-soft text-brand', run: (m) => m.open('transfer') },
];

export default function QuickAdd({ open, onClose }) {
  const modals = useModals();
  const { data: goals } = useGoals();
  return (
    <Modal open={open} onClose={onClose} title="Quick add" subtitle="What would you like to record?" size="sm">
      <div className="grid grid-cols-2 gap-2.5 pb-2">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.key} type="button" onClick={() => { onClose(); a.run(modals, goals?.filter((g) => !g.archived && !g.completed)); }}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-line p-4 text-left transition hover:border-transparent hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
            <span className={cx('grid size-10 place-items-center rounded-xl', a.cls)}><a.icon className="size-5" /></span>
            <span>
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-xs text-muted">{a.desc}</span>
            </span>
            <kbd className="hidden sm:block ml-auto -mt-8 rounded border border-line px-1.5 text-[10px] text-muted">{a.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>
    </Modal>
  );
}
