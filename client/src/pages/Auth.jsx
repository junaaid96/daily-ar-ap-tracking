import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeOff, HandCoins, PiggyBank, CalendarDays, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input } from '../components/ui/index.jsx';
import { Logo } from '../components/layout/AppShell.jsx';
import { useAuth } from '../lib/auth.jsx';
import { CurrencySelect } from '../components/CurrencyPicker.jsx';

const guessCurrency = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const map = { 'Asia/Dhaka': 'BDT', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Karachi': 'PKR', 'Europe/London': 'GBP', 'Asia/Dubai': 'AED',
    'Asia/Riyadh': 'SAR', 'Asia/Kuala_Lumpur': 'MYR', 'Asia/Singapore': 'SGD', 'Asia/Tokyo': 'JPY', 'Africa/Lagos': 'NGN', 'Africa/Nairobi': 'KES', 'Asia/Jakarta': 'IDR' };
  if (map[tz]) return map[tz];
  if (tz.startsWith('Europe/')) return 'EUR';
  if (tz.startsWith('Australia/')) return 'AUD';
  return 'USD';
};

const FEATURES = [
  { icon: HandCoins, title: 'Receivables & payables', body: 'Who owes you, who you owe, partial payments and aging at a glance.' },
  { icon: CalendarDays, title: 'Daily expense log', body: 'Two-tap entry, smart suggestions, budgets that warn you early.' },
  { icon: PiggyBank, title: 'Savings goals', body: 'See exactly how much to set aside each month to hit your target.' },
  { icon: TrendingUp, title: '30-day cash forecast', body: 'Upcoming bills, dues and income projected onto your balance.' },
];

export default function Auth({ mode }) {
  const isLogin = mode === 'login';
  const { login, register, demo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', currency: guessCurrency() });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [show, setShow] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const go = () => navigate(location.state?.from || '/', { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form);
      toast.success(isLogin ? 'Welcome back!' : 'Your account is ready 🎉');
      go();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const tryDemo = async () => {
    setDemoBusy(true);
    try { await demo(form.currency); toast.success('Loaded a private demo sandbox with sample data'); go(); } catch (err) { toast.error(err.message); } finally { setDemoBusy(false); }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-muted">{isLogin ? 'Sign in to see where your money stands today.' : 'Free, private, and yours alone. Takes 20 seconds.'}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {!isLogin && (
              <Field label="Your name" error={errors.name} htmlFor="name">
                <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} required maxLength={120} error={errors.name} />
              </Field>
            )}
            <Field label="Email" error={errors.email} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required error={errors.email} />
            </Field>
            <Field label="Password" error={errors.password} hint={!isLogin ? 'At least 8 characters' : undefined} htmlFor="password">
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={form.password} onChange={set('password')} required minLength={isLogin ? undefined : 8} className="pr-10" error={errors.password} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-ink cursor-pointer">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {!isLogin && (
              <Field label="Currency" hint="You can change this later in Settings" htmlFor="currency">
                <CurrencySelect id="currency" value={form.currency} onChange={set('currency')} />
              </Field>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {isLogin ? 'Sign in' : 'Create account'} <ArrowRight className="size-4" />
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <Button variant="secondary" size="lg" className="w-full" icon={Sparkles} loading={demoBusy} onClick={tryDemo}>Explore with sample data</Button>
          <p className="mt-8 text-center text-sm text-muted">
            {isLogin ? 'New to Ledgerly? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-semibold text-brand hover:underline">
              {isLogin ? 'Create an account' : 'Sign in'}
            </Link>
          </p>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" />Every account's data is private. No admins, no sharing.</p>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-200">Money in · Money out · In view</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight">Know what you’re owed, what you owe, and what’s safe to spend today.</h2>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-sm"><span className="text-teal-100">Safe to spend today</span><span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-200">on track</span></div>
            <p className="mt-1 text-4xl font-bold num">$48.20</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl bg-white/5 p-3"><p className="text-teal-200">To receive</p><p className="mt-1 text-base font-semibold num">$2,660</p></div>
              <div className="rounded-2xl bg-white/5 p-3"><p className="text-teal-200">To pay</p><p className="mt-1 text-base font-semibold num">$687</p></div>
              <div className="rounded-2xl bg-white/5 p-3"><p className="text-teal-200">Saved</p><p className="mt-1 text-base font-semibold num">$2,480</p></div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="size-5 text-teal-200" />
                <p className="mt-2 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-teal-100/80">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
