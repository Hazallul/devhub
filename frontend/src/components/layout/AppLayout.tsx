import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  Gear, Sun, Moon, ListDashes, ListChecks, ArrowUpRight, House, MagnifyingGlass, Plus, List, X, Briefcase, Airplane, Megaphone, CheckSquare,
} from '@phosphor-icons/react';
import { getStoredUser } from '../../lib/session';
import { setThemePref, useTheme } from '../../lib/theme';
import { useAllTasks, useLeaves, useMe, usePendingProfileCount } from '../../hooks/api';
import { useDocPendingCount } from '../../hooks/docs';
import { page, pageWipe, wipeEdge } from '../../lib/motion';
import { Menu, MenuItem, MenuDivider } from '../ui/Menu';
import { navFor, systemNavFor } from './nav';
import TodoSpace from '../todo/TodoSpace';
import { useTodoUnseen } from '../../hooks/todos';
import NotificationBell from './NotificationBell';
import Realtime, { LiveStatus } from './Realtime';
import { QuickActionsProvider, useQuickActions } from './QuickActions';
import CommandPalette from './CommandPalette';
import UserCard, { useLogout } from './UserCard';
import PasswordCard from '../settings/PasswordCard';
import { ContextMenuProvider } from './ContextMenu';

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
  const navigate = useNavigate();
  const outlet = useOutlet();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // Geçiş animasyonu bölüm değişince oynar; /docs/a → /docs/b gibi alt sayfalarda sayfa kendi içinde değişir.
  const section = location.pathname.split('/')[1] || 'home';

  // Kişisel alan (/todo) uygulamanın üstünde tam ekran bir katmandır: altta kullanıcının kaldığı sayfa olduğu gibi durur
  // (kaydırma konumu dahil) ve ev düğmesi oraya geri döner.
  const isTodo = section === 'todo';
  const behind = useRef({ outlet, section, path: '/' });
  const wasTodo = useRef(isTodo);
  useEffect(() => {
    if (!isTodo) behind.current = { outlet, section, path: location.pathname + location.search };
  });
  const shownOutlet = isTodo ? behind.current.outlet : outlet;
  const shownSection = isTodo ? behind.current.section : section;
  const todoOrigin = (location.state as { origin?: { x: number; y: number } } | null)?.origin;

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
    const returning = wasTodo.current;
    wasTodo.current = isTodo;
    if (isTodo || returning) return; // kişisel alana girip çıkarken alttaki sayfa yerinde kalsın
    mainRef.current?.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <ContextMenuProvider onSearch={() => setPaletteOpen(true)}>
    <div className="relative flex h-[100dvh] overflow-hidden bg-theme-cream">
      <aside inert={isTodo} className="hidden lg:flex w-72 shrink-0 bg-surface border-r border-theme-light/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative z-20">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-[90]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } }}
              exit={{ x: '-100%', transition: { duration: 0.18 } }}
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl flex"
            >
              <button onClick={() => setDrawerOpen(false)} aria-label="Menüyü kapat" className="icon-btn absolute top-6 right-4 z-10"><X size={20} weight="bold" /></button>
              <LayoutGroup id="drawer"><SidebarContent /></LayoutGroup>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div inert={isTodo} className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} onOpenDrawer={() => setDrawerOpen(true)} />
        {/* layoutScroll: içindeki layout/layoutId animasyonları kaydırma konumunu hesaba katar (yoksa sayfa boyu değişince "aşağıdan uçar") */}
        <motion.main layoutScroll ref={mainRef} tabIndex={-1} id="main-scroll-container" className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-thin outline-none">
          <AnimatePresence mode="wait" initial={false}>
            {/* Tam genişlikte sarmalayıcı: açılma menünün kenarından başlar, ortalanmış içerikten değil. */}
            <motion.div key={shownSection} variants={reduceMotion ? page : pageWipe} initial="hidden" animate="visible" exit="exit" className="relative min-h-full">
              {!reduceMotion && (
                <motion.span
                  variants={wipeEdge}
                  className="pointer-events-none absolute inset-y-0 w-40 -translate-x-full bg-gradient-to-r from-transparent via-theme-light/25 to-theme-light/60 z-10"
                  aria-hidden="true"
                />
              )}
              <div className="max-w-[1760px] mx-auto px-4 sm:px-8 2xl:px-12 py-8 lg:py-10">
                                {shownOutlet}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>

      <AnimatePresence>
        {isTodo && <TodoSpace key="todo" origin={todoOrigin} onHome={() => navigate(behind.current.path)} />}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PasswordGate />
      <Realtime />
    </div>
    </ContextMenuProvider>
  );
}

function SidebarContent() {
  const me = useMe();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const { data: leaves } = useLeaves();
  const { data: tasks } = useAllTasks();
  const todoUnseen = useTodoUnseen().data?.count ?? 0;
  const pendingProfiles = usePendingProfileCount(me.role === 'ADMIN').data?.count ?? 0;

  const pendingLeaves = me.role === 'ADMIN' ? leaves?.filter(l => l.state === 'BEKLIYOR').length ?? 0 : 0;
  const myOpenTasks = tasks?.filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI').length ?? 0;
  const pendingDocs = useDocPendingCount(me.role === 'ADMIN').data?.count ?? 0;
  const badges: Record<string, number> = { '/tasks': myOpenTasks, '/leaves': pendingLeaves, '/users': pendingProfiles, '/docs': pendingDocs };


  return (
    <div className="flex flex-col w-full h-full min-h-0 p-5 overflow-y-auto overscroll-contain scrollbar-hover">
      {/* Ev karosu: kişisel alandaki (TodoSpace) ev düğmesiyle aynı konum ve boyutta durur; iki ekran arasında geçerken kaymaz. */}
      <button onClick={() => navigate('/')} className="group flex items-center gap-3 px-3 mb-8 mt-2 h-10 rounded-2xl text-left" aria-label="DevHub: Genel Bakış'a git" title="Genel Bakış">
        <span className="w-10 h-10 shrink-0 bg-accent rounded-2xl flex items-center justify-center text-white shadow-soft group-hover:bg-ink transition-colors">
          <House size={20} weight="fill" aria-hidden="true" />
        </span>
        <span className="text-2xl font-bold tracking-tight text-theme-text leading-none">DevHub</span>
      </button>

      <p className="eyebrow px-4 mb-2">Kişisel</p>
      <button
        type="button"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          navigate('/todo', { state: { origin: { x: Math.round(r.left + 34), y: Math.round(r.top + r.height / 2) } } });
        }}
        className="group flex items-center gap-3 p-2.5 mb-8 rounded-2xl bg-theme-cream border border-theme-light/50 hover:border-theme-medium hover:bg-theme-lightest/60 transition-colors text-left"
      >
        <span className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shrink-0"><ListChecks size={20} weight="bold" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-theme-text">Yapılacaklarım</span>
          <span className="block text-xs text-theme-muted font-medium truncate">{todoUnseen ? `${todoUnseen} yeni kart geldi` : 'Kişisel alan'}</span>
        </span>
        {todoUnseen > 0
          ? <span className="text-[0.6875rem] font-bold tabular min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-danger-solid text-white flex items-center justify-center" aria-hidden="true">{todoUnseen}</span>
          : <ArrowUpRight size={16} weight="bold" className="text-theme-muted group-hover:text-theme-deep group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />}
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
                  <span className="relative text-[0.6875rem] font-bold tabular min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-accent text-white flex items-center justify-center" aria-label={`${badges[item.to]} bekleyen`}>
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
        {/* Yönetici için "Loglar" bir sayfadır (Sistem bölümündeki bağlantı); çalışan ekip akışını pencerede görür. */}
        {me.role !== 'ADMIN' && (
          <button onClick={actions.openLogs} className="w-full flex items-center gap-3 px-4 py-3 text-theme-muted hover:text-theme-deep hover:bg-theme-lightest/50 font-medium rounded-2xl transition-colors">
            <ListDashes size={22} weight="duotone" aria-hidden="true" />
            <span>Ekip akışı</span>
          </button>
        )}
        {systemNavFor(me).map(item => (
          <NavLink key={item.to} to={item.to} className="block rounded-2xl">
            {({ isActive }) => (
              <span className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${isActive ? 'text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-theme-lightest/50'}`}>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 bg-theme-lightest rounded-2xl" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <item.icon size={22} weight={isActive ? 'fill' : 'duotone'} className="relative" aria-hidden="true" />
                <span className="relative flex-1">{item.label}</span>
                {badges[item.to] > 0 && (
                  <span className="relative text-[0.6875rem] font-bold tabular min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-accent text-white flex items-center justify-center" aria-label={`${badges[item.to]} bekleyen`}>
                    {badges[item.to]}
                  </span>
                )}
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
        <UserCard />
      </div>
    </div>
  );
}

/** Üst barda açık/koyu tema düğmesi (Ayarlar > Görünüm'de "Sistem" seçeneği de var). */
function ThemeToggle() {
  const [, dark] = useTheme();
  const reduce = useReducedMotion();
  const label = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
  return (
    <button type="button" onClick={() => setThemePref(dark ? 'light' : 'dark')} className="icon-btn" aria-label={label} title={label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'moon' : 'sun'} className="flex"
          initial={reduce ? false : { rotate: -60, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={reduce ? undefined : { rotate: 60, opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
          {dark ? <Moon size={20} weight="bold" /> : <Sun size={20} weight="bold" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Topbar({ onOpenPalette, onOpenDrawer }: { onOpenPalette: () => void; onOpenDrawer: () => void }) {
  const me = useMe();
  const actions = useQuickActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBtn, setNewBtn] = useState<HTMLButtonElement | null>(null);

  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  return (
    <header className="h-[4.5rem] shrink-0 flex items-center gap-3 px-4 sm:px-8 border-b border-theme-light/40 bg-theme-cream/80 backdrop-blur-md relative z-10">
      <button onClick={onOpenDrawer} className="icon-btn lg:hidden" aria-label="Menüyü aç"><List size={22} weight="bold" /></button>

      <button
        onClick={onOpenPalette}
        className="flex items-center gap-3 flex-1 max-w-md h-11 px-4 rounded-2xl bg-surface border border-theme-light/60 text-theme-muted text-sm font-medium hover:border-theme-medium transition-colors shadow-soft"
      >
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="flex-1 text-left truncate">Kişi, proje veya işlem ara…</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <button onClick={actions.openLogs} className="icon-btn hidden sm:inline-flex" aria-label="Sistem logları" title="Sistem logları">
          <ListDashes size={20} weight="bold" />
        </button>
        <LiveStatus />
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
/**
 * Geçici (yöneticinin verdiği) şifreyle giren kişi, yeni şifresini belirlemeden uygulamayı kullanamaz:
 * tüm ekranı kaplayan, kapatılamayan bir pencere açılır. Şifre değişince kendiliğinden kalkar.
 */
function PasswordGate() {
  const me = useMe();
  const logout = useLogout();
  if (!me.mustChangePassword) return null;
  return (
    <div className="fixed inset-0 z-[140] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="w-full max-w-md space-y-4 my-auto">
        <div className="card p-6">
          <p className="eyebrow mb-1">Hoş geldiniz, {me.fullName.split(' ')[0]}</p>
          <h2 id="gate-title" className="text-xl font-bold tracking-tight">Önce kendi şifrenizi belirleyin</h2>
          <p className="text-sm text-theme-muted font-medium mt-1.5 leading-relaxed">
            Hesabınız yöneticinin verdiği başlangıç şifresiyle açıldı. Güvenliğiniz için bu şifreyi şimdi değiştirmeniz gerekiyor;
            "Mevcut şifre" alanına size verilen başlangıç şifresini yazın.
          </p>
        </div>
        <PasswordCard />
        <button type="button" onClick={logout} className="btn-ghost w-full">Çıkış yap</button>
      </div>
    </div>
  );
}
