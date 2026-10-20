import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { useAppStore } from './store/useAppStore';
import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Approval = lazy(() => import('./pages/Approval'));
const Karyawan = lazy(() => import('./pages/Karyawan'));
const Kalender = lazy(() => import('./pages/Kalender'));
const Rekap = lazy(() => import('./pages/Rekap'));

function AppRoutes() {
  const fetchAll = useAppStore((s) => s.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <Suspense fallback={<div className="empty">Memuat...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/approval" element={<Approval />} />
        <Route path="/karyawan" element={<Karyawan />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/rekap" element={<Rekap />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Layout>
          <AppRoutes />
        </Layout>
      </HashRouter>
    </ToastProvider>
  );
}
