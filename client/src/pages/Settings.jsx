import { useState } from 'react';
import { Plus, Pencil, Trash2, Sun, Moon, Keyboard, ShieldAlert, UserRound, Shapes, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, PageHeader, Button, Field, Input, Select, Segmented, IconButton, CategoryDot, useConfirm } from '../components/ui/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.js';
import { useCategories, useSave } from '../lib/queries.js';
import { useModals } from '../components/ModalHost.jsx';
import { api } from '../lib/api.js';
import { CURRENCIES, money } from '../lib/format.js';
import { Icon } from '../lib/icons.jsx';

function Profile() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title="Profile" icon={UserRound} subtitle={user.email} />
      <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await updateProfile({ name, currency }); toast.success('Profile saved'); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
      }}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="Currency" hint={`Amounts display like ${money(1234.5)}`}>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy} disabled={!name.trim()}>Save profile</Button></div>
      </form>
    </Card>
  );
}

function Password() {
  const { user } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const save = useSave((b) => api.post('/auth/password', b), { keys: [], success: 'Password updated', onSuccess: () => setF({ currentPassword: '', newPassword: '' }) });
  if (user.isDemo) return null;
  return (
    <Card>
      <CardHeader title="Password" />
      <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(f, { onError: (err) => setErrors(err.fields || {}) }); }}>
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
        <Field label="New password" error={errors.newPassword} hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex justify-end"><Button type="submit" variant="secondary" loading={save.isPending} disabled={!f.currentPassword || f.newPassword.length < 8}>Change password</Button></div>
      </form>
    </Card>
  );
}

function Categories() {
  const { data = [] } = useCategories();
  const [kind, setKind] = useState('expense');
  const modals = useModals();
  const confirm = useConfirm();
  const remove = useSave((id) => api.del(`/categories/${id}`), { success: 'Category deleted' });
  return (
    <Card>
      <CardHeader title="Categories" icon={Shapes} subtitle="Organise your daily log and budgets"
        action={<Button size="sm" icon={Plus} onClick={() => modals.open('category', { kind })}>Add</Button>} />
      <div className="px-5 pt-4"><Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} /></div>
      <div className="grid gap-1 p-3 sm:grid-cols-2">
        {data.filter((c) => c.kind === kind).map((c) => (
          <div key={c.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <CategoryDot color={c.color} icon={<Icon name={c.icon} className="size-4" />} size="sm" />
            <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
            {c.monthlyBudget != null && <span className="text-xs text-muted num">{money(c.monthlyBudget)}/mo</span>}
            <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => modals.open('category', { category: c })} />
            <IconButton icon={Trash2} label="Delete" size="sm" onClick={async () => {
              if (await confirm({ title: `Delete “${c.name}”?`, body: 'Entries in this category become uncategorized.', danger: true, confirmLabel: 'Delete' })) remove.mutate(c.id);
            }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

const SHORTCUTS = [['N', 'Quick add menu'], ['E', 'New expense'], ['I', 'New income'], ['R', 'New receivable'], ['P', 'New payable'], ['S', 'Add to savings'], ['T', 'Transfer'], ['/ or Ctrl K', 'Search & commands']];

export default function Settings() {
  const { logout, user } = useAuth();
  const [dark, toggle] = useTheme();
  const confirm = useConfirm();
  const deleteAccount = useSave(() => api.del('/auth/me'), { keys: [], success: 'Your account and all data were deleted', onSuccess: logout });
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Your profile, preferences and data" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Profile />
          <Password />
          <Card>
            <CardHeader title="Appearance" icon={Palette} />
            <div className="flex items-center justify-between p-5">
              <span className="text-sm">Theme</span>
              <Segmented value={dark ? 'dark' : 'light'} onChange={(v) => (v === 'dark') !== dark && toggle()}
                options={[{ value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" />Light</span> }, { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" />Dark</span> }]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Keyboard shortcuts" icon={Keyboard} />
            <div className="grid grid-cols-2 gap-2 p-5 text-sm">
              {SHORTCUTS.map(([k, label]) => (
                <div key={k} className="flex items-center gap-2"><kbd className="min-w-7 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-center text-xs font-semibold">{k}</kbd><span className="text-muted">{label}</span></div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Categories />
          <Card className="border-out/30">
            <CardHeader title="Danger zone" icon={ShieldAlert} subtitle="Your data is private to your account. Deleting is permanent." />
            <div className="flex justify-end p-5">
              <Button variant="danger" loading={deleteAccount.isPending} onClick={async () => {
                if (await confirm({ title: 'Delete your account?', body: `This permanently deletes ${user.email} and every record, payment, goal and entry in it.`, danger: true, confirmLabel: 'Delete everything' })) deleteAccount.mutate();
              }}>Delete account</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
