import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ComponentType } from 'react';
import AppLayout from './components/layout/AppLayout';
import { ToastProvider } from './components/ui/Toast';

/**
 * Sayfalar ayrı dosyalar halinde, açıldıklarında yüklenir: ilk açılışta indirilen paket küçük kalır.
 * Uygulama açıldıktan sonra tarayıcı boşta kalınca hepsi önceden indirilir, sayfa geçişlerinde bekleme olmaz.
 * Doküman editörü (TipTap/ProseMirror) büyük olduğu için önceden indirilmez; yalnızca düzenleme sayfası açılınca yüklenir.
 */
const pages = {
  Login: () => import('./pages/Login'),
  Overview: () => import('./pages/Overview'),
  Team: () => import('./pages/Team'),
  Projects: () => import('./pages/Projects'),
  Tasks: () => import('./pages/Tasks'),
  Leaves: () => import('./pages/Leaves'),
  Settings: () => import('./pages/Settings'),
  Reports: () => import('./pages/Reports'),
  Users: () => import('./pages/Users'),
  Monitoring: () => import('./pages/Monitoring'),
  Logs: () => import('./pages/Logs'),
  Docs: () => import('./pages/Docs'),
  DocReview: () => import('./pages/DocReview'),
};

function page(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return <Suspense fallback={null}><Page /></Suspense>;
}

const idle = (fn: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn) : setTimeout(fn, 1500));
idle(() => Object.values(pages).forEach(load => { load().catch(() => undefined); }));

const login = page(pages.Login);
const overview = page(pages.Overview);
const team = page(pages.Team);
const projects = page(pages.Projects);
const tasks = page(pages.Tasks);
const leaves = page(pages.Leaves);
const settings = page(pages.Settings);
const reports = page(pages.Reports);
const users = page(pages.Users);
const monitoring = page(pages.Monitoring);
const logs = page(pages.Logs);
const docs = page(pages.Docs);
const docReview = page(pages.DocReview);
const docEdit = page(() => import('./pages/DocEdit'));

function App() {
  return (
    // 'user': işletim sistemindeki "hareketi azalt" ayarına uyar.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={login} />
            <Route element={<AppLayout />}>
              <Route path="/" element={overview} />
              <Route path="/team" element={team} />
              <Route path="/projects" element={projects} />
              <Route path="/tasks" element={tasks} />
              <Route path="/leaves" element={leaves} />
              <Route path="/settings" element={settings} />
              <Route path="/reports" element={reports} />
              <Route path="/users" element={users} />
              <Route path="/monitoring" element={monitoring} />
              <Route path="/logs" element={logs} />
              {/* Kişisel alan: AppLayout bu adreste tam ekran TodoSpace katmanını açar */}
              <Route path="/todo" element={null} />
              <Route path="/docs" element={docs} />
              <Route path="/docs/yeni" element={docEdit} />
              <Route path="/docs/oneri/:id" element={docReview} />
              <Route path="/docs/:slug" element={docs} />
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
