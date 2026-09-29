import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  Gear, SignOut, ListDashes, Key, MagnifyingGlass, Plus, List, X, Briefcase, Airplane, Megaphone, CheckSquare,
} from '@phosphor-icons/react';
import { getStoredUser, clearSession } from '../../lib/session';
import { useAllTasks, useLeaves, useMe } from '../../hooks/api';
import { page, pageWipe, wipeEdge } from '../../lib/motion';
import { Avatar } from '../ui/primitives';
import { Menu, MenuItem, MenuDivider } from '../ui/Menu';
import { navFor, systemNavFor } from './nav';
import NotificationBell from './NotificationBell';
import { QuickActionsProvider, useQuickActions } from './QuickActions';
import CommandPalette from './CommandPalette';

/** Oturum yoksa login'e yönlendirir; varsa kalıcı iskeleti (sidebar + üst bar) çizer. */
export default function AppLayout() {
  if (!getStoredUser()) return <Navigate to="/login" replace />;
  return (
    <QuickActionsProvider>
      <Shell />
    </QuickActionsProvider>
  );
}

function Shell() {
  const location = useLocation();
  const outlet = useOutlet();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // Geçiş animasyonu bölüm değişince oynar; /docs/a → /docs/b gibi alt sayfalarda sayfa kendi içinde değişir.
  const section = location.pathname.split('/')[1] || 'home';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sayfa değişince: başa kaydır, mobil menüyü kapat, odağı içeriğe taşı.
  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-theme-cream">
      <aside className="hidden lg:flex w-72 shrink-0 bg-white border-r border-theme-light/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative z-20">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-[90]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-theme-text/30 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } }}
              exit={{ x: '-100%', transition: { duration: 0.18 } }}
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex"
            >
              <button onClick={() => setDrawerOpen(false)} aria-label="Menüyü kapat" className="icon-btn absolute top-6 right-4 z-10"><X size={20} weight="bold" /></button>
              <LayoutGroup id="drawer"><SidebarContent /></LayoutGroup>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} onOpenDrawer={() => setDrawerOpen(true)} />
        <main ref={mainRef} tabIndex={-1} id="main-scroll-container" className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-thin outline-none">
          <AnimatePresence mode="wait" initial={false}>
            {/* Tam genişlikte sarmalayıcı: açılma menünün kenarından başlar, ortalanmış içerikten değil. */}
            <motion.div key={section} variants={reduceMotion ? page : pageWipe} initial="hidden" animate="visible" exit="exit" className="relative min-h-full">
              {!reduceMotion && (
                <motion.span
                  variants={wipeEdge}
                  className="pointer-events-none absolute inset-y-0 w-40 -translate-x-full bg-gradient-to-r from-transparent via-theme-light/25 to-theme-light/60 z-10"
                  aria-hidden="true"
                />
              )}
              <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
                <PasswordNotice />
                {outlet}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function SidebarContent() {
  const me = useMe();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const { data: leaves } = useLeaves();
  const { data: tasks } = useAllTasks();

  const pendingLeaves = me.role === 'ADMIN' ? leaves?.filter(l => l.state === 'BEKLIYOR').length ?? 0 : 0;
  const myOpenTasks = tasks?.filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI').length ?? 0;
  const badges: Record<string, number> = { '/tasks': myOpenTasks, '/leaves': pendingLeaves };

  const logout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 p-5 overflow-y-auto overscroll-contain scrollbar-thin">
      <button onClick={() => navigate('/')} className="flex items-center gap-3 px-3 mb-10 mt-2 rounded-2xl" aria-label="DevHub ana sayfa">
        <div className="w-10 h-10 bg-theme-deep rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm">D</div>
        <span className="text-2xl font-bold tracking-tight text-theme-text">DevHub</span>
      </button>

      <p className="eyebrow px-4 mb-2">Menü</p>
      <nav className="space-y-1" aria-label="Ana menü">
        {navFor(me).map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="block rounded-2xl">
            {({ isActive }) => (
              <span className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${isActive ? 'text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-theme-lightest/50'}`}>
                {isActive && (
                  <motion.span layoutId="nav-active" className="absolute inset-0 bg-theme-lightest rounded-2xl" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                )}
                <item.icon size={22} weight={isActive ? 'fill' : 'duotone'} className="relative" aria-hidden="true" />
                <span className="relative flex-1">{item.label}</span>
                {badges[item.to] > 0 && (
                  <span className="relative text-[11px] font-bold tabular min-w-[22px] h-[22px] px-1.5 rounded-full bg-theme-deep text-white flex items-center justify-center" aria-label={`${badges[item.to]} bekleyen`}>
                    {badges[item.to]}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <p className="eyebrow px-4 mb-2 mt-8">Sistem</p>
      <div className="space-y-1">
        <button onClick={actions.openLogs} className="w-full flex items-center gap-3 px-4 py-3 text-theme-muted hover:text-theme-deep hover:bg-theme-lightest/50 font-medium rounded-2xl transition-colors">
          <ListDashes size={22} weight="duotone" aria-hidden="true" />
          <span>Loglar</span>
        </button>
        {systemNavFor(me).map(item => (
          <NavLink key={item.to} to={item.to} className="block rounded-2xl">
            {({ isActive }) => (
              <span className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${isActive ? 'text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-theme-lightest/50'}`}>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 bg-theme-lightest rounded-2xl" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <item.icon size={22} weight={isActive ? 'fill' : 'duotone'} className="relative" aria-hidden="true" />
                <span className="relative">{item.label}</span>
              </span>
            )}
          </NavLink>
        ))}
        <NavLink to="/settings" className="block rounded-2xl">
          {({ isActive }) => (
            <span className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${isActive ? 'text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-theme-lightest/50'}`}>
              {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 bg-theme-lightest rounded-2xl" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
              <Gear size={22} weight={isActive ? 'fill' : 'duotone'} className="relative" aria-hidden="true" />
              <span className="relative">Ayarlar</span>
            </span>
          )}
        </NavLink>
      </div>

      <div className="mt-auto pt-6 shrink-0">
        <div className="bg-theme-cream p-3 rounded-3xl flex items-center gap-3 border border-theme-light/40">
          <Avatar user={me} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-theme-text truncate">{me.fullName}</p>
            <p className="text-xs text-theme-muted font-medium truncate">{me.role === 'ADMIN' ? 'Yönetici' : me.jobTitle || 'Çalışan'}</p>
          </div>
          <button onClick={logout} className="icon-btn hover:text-[#9A3B1B] hover:bg-[#FBEDE5]" aria-label="Çıkış yap" title="Çıkış yap">
            <SignOut size={20} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Topbar({ onOpenPalette, onOpenDrawer }: { onOpenPalette: () => void; onOpenDrawer: () => void }) {
  const me = useMe();
  const actions = useQuickActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBtn, setNewBtn] = useState<HTMLButtonElement | null>(null);
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  return (
    <header className="h-[72px] shrink-0 flex items-center gap-3 px-4 sm:px-8 border-b border-theme-light/40 bg-theme-cream/80 backdrop-blur-md relative z-10">
      <button onClick={onOpenDrawer} className="icon-btn lg:hidden" aria-label="Menüyü aç"><List size={22} weight="bold" /></button>

      <button
        onClick={onOpenPalette}
        className="flex items-center gap-3 flex-1 max-w-md h-11 px-4 rounded-2xl bg-white border border-theme-light/60 text-theme-muted text-sm font-medium hover:border-theme-medium transition-colors shadow-soft"
      >
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="flex-1 text-left truncate">Kişi, proje veya işlem ara…</span>
        <kbd className="hidden sm:inline text-[11px] font-bold bg-theme-lightest text-theme-deep px-2 py-0.5 rounded-md">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={actions.openLogs} className="icon-btn hidden sm:inline-flex" aria-label="Sistem logları" title="Sistem logları">
          <ListDashes size={20} weight="bold" />
        </button>
        <NotificationBell />
        <button ref={setNewBtn} onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Yeni oluştur" className="btn-primary h-11 px-4">
          <motion.span animate={{ rotate: menuOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} className="flex">
            <Plus size={18} weight="bold" />
          </motion.span>
          <span className="hidden sm:inline">Yeni</span>
        </button>
        <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={newBtn} label="Yeni oluştur">
          <MenuItem icon={CheckSquare} onSelect={run(() => actions.newTask())}>{me.role === 'ADMIN' ? 'Görev ata' : 'Görev ekle'}</MenuItem>
          <MenuItem icon={Airplane} onSelect={run(() => actions.newLeave())}>İzin talebi</MenuItem>
          {me.role === 'ADMIN' && <>
            <MenuDivider />
            <MenuItem icon={Briefcase} onSelect={run(() => actions.newProject())}>Proje</MenuItem>
            <MenuItem icon={Megaphone} onSelect={run(actions.newAnnouncement)}>Duyuru</MenuItem>
          </>}
        </Menu>
      </div>
    </header>
  );
}

/** Yönetici şifreyi sıfırladıysa kullanıcı geçici şifreyle girmiştir: şifresini değiştirmesi istenir. */
function PasswordNotice() {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  if (!me.mustChangePassword || location.pathname === '/settings') return null;
  return (
    <div role="status" className="mb-6 flex items-center gap-3 p-4 rounded-3xl bg-[#FBEDE5] border border-[#E8C3AE] text-[#7A3E1F]">
      <Key size={22} weight="duotone" className="shrink-0" aria-hidden="true" />
      <p className="text-sm font-semibold flex-1">Geçici bir şifreyle giriş yaptınız. Hesabınızın güvenliği için şifrenizi değiştirin.</p>
      <button onClick={() => navigate('/settings')} className="btn-primary h-10 min-h-0 px-4 text-sm">Şifreyi değiştir</button>
    </div>
  );
}
