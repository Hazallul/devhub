import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Team from './pages/Team';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Leaves from './pages/Leaves';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Monitoring from './pages/Monitoring';
import Logs from './pages/Logs';
import Docs from './pages/Docs';
import DocReview from './pages/DocReview';
import AppLayout from './components/layout/AppLayout';
import { ToastProvider } from './components/ui/Toast';

// Doküman editörü (TipTap/ProseMirror) büyük; yalnızca düzenleme sayfası açılınca yüklenir.
const DocEdit = lazy(() => import('./pages/DocEdit'));
const docEdit = <Suspense fallback={null}><DocEdit /></Suspense>;

function App() {
  return (
    // 'user': işletim sistemindeki "hareketi azalt" ayarına uyar.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/team" element={<Team />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/logs" element={<Logs />} />
              {/* Kişisel alan: AppLayout bu adreste tam ekran TodoSpace katmanını açar */}
              <Route path="/todo" element={null} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/yeni" element={docEdit} />
              <Route path="/docs/oneri/:id" element={<DocReview />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="/docs/:slug/duzenle" element={docEdit} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </MotionConfig>
  );
}

export default App;
