import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './lib/auth.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { ModalHost } from './components/ModalHost.jsx';
import { ConfirmProvider, Spinner } from './components/ui/index.jsx';

const Auth = lazy(() => import('./pages/Auth.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Dues = lazy(() => import('./pages/Dues.jsx'));
const Contacts = lazy(() => import('./pages/Contacts.jsx'));
const ContactDetail = lazy(() => import('./pages/ContactDetail.jsx'));
const Daily = lazy(() => import('./pages/Daily.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const Savings = lazy(() => import('./pages/Savings.jsx'));
const Recurring = lazy(() => import('./pages/Recurring.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

const Loading = () => <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner className="size-7" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <ConfirmProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth mode="login" />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Auth mode="register" />} />
          <Route element={<Protected><ModalHost><AppShell /></ModalHost></Protected>}>
            <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
            <Route path="daily" element={<Suspense fallback={<Loading />}><Daily /></Suspense>} />
            <Route path="receivables" element={<Suspense fallback={<Loading />}><Dues direction="receivable" /></Suspense>} />
            <Route path="payables" element={<Suspense fallback={<Loading />}><Dues direction="payable" /></Suspense>} />
            <Route path="contacts" element={<Suspense fallback={<Loading />}><Contacts /></Suspense>} />
            <Route path="contacts/:id" element={<Suspense fallback={<Loading />}><ContactDetail /></Suspense>} />
            <Route path="budgets" element={<Suspense fallback={<Loading />}><Budgets /></Suspense>} />
            <Route path="savings" element={<Suspense fallback={<Loading />}><Savings /></Suspense>} />
            <Route path="recurring" element={<Suspense fallback={<Loading />}><Recurring /></Suspense>} />
            <Route path="accounts" element={<Suspense fallback={<Loading />}><Accounts /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<Loading />}><Reports /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<Loading />}><Settings /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </ConfirmProvider>
  );
}
