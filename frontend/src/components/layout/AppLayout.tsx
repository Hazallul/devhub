import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  ListDashes, ListChecks, ArrowUpRight, House, MagnifyingGlass, Plus, List, X, Briefcase, Airplane, Megaphone, CheckSquare, Headset, ChartPieSlice,
} from '@phosphor-icons/react';
import { getStoredUser } from '../../lib/session';
import { useLeaves, useMe, usePendingProfileCount, usePendingPasswordResetCount } from '../../hooks/api';
import { useDocPendingCount } from '../../hooks/docs';
import { usePendingSurveyCount } from '../../hooks/surveys';
import { useTickets } from '../../hooks/tickets';
import { page } from '../../lib/motion';
import { Menu, MenuItem, MenuDivider } from '../ui/Menu';
import { groupsFor, HOME_ITEM, HOME_TILE } from './nav';
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
      <aside inert={isTodo} className="hidden lg:flex w-64 shrink-0 bg-surface border-r border-theme-light relative z-20">
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
              className="absolute inset-y-0 left-0 w-64 max-w-[85vw] bg-surface shadow-float flex"
            >
              <button onClick={() => setDrawerOpen(false)} aria-label="Menüyü kapat" className="icon-btn absolute top-4 right-3 z-10"><X size={18} /></button>
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
            <motion.div key={shownSection} variants={page} initial="hidden" animate="visible" exit="exit" className="relative min-h-full">
              <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
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

/**
 * Kenar çubuğu: üstte Genel Bakış ve Yapılacaklarım, sonra İş / Ekip / Yönetim grupları, en altta kullanıcı kartı
 * (durum seçici + ayarlar menüsü). Sayı rozetleri yalnızca bekleyen onaylar için. Ev karosu kişisel alandaki (TodoSpace)
 * ev düğmesiyle aynı ölçüde ve konumda (px-2 h-12, 2.25rem karo); ikisini birlikte değiştirin.
 */
function SidebarContent() {
  const me = useMe();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const isAdmin = me.role === 'ADMIN';
  const { data: leaves } = useLeaves();
  const todoUnseen = useTodoUnseen().data?.count ?? 0;
  const pendingProfiles = usePendingProfileCount(isAdmin).data?.count ?? 0;
  const pendingResets = usePendingPasswordResetCount(isAdmin).data?.count ?? 0;
  const pendingLeaves = isAdmin ? leaves?.filter(l => l.state === 'BEKLIYOR').length ?? 0 : 0;
  const pendingDocs = useDocPendingCount(isAdmin).data?.count ?? 0;
  const pendingSurveys = usePendingSurveyCount().data?.count ?? 0;
  // Talepler: bende iş bekleyenler. Bana atanan açık talepler, yöneticide atanmamışlar,
  // açtığım talepte benden yanıt bekleniyorsa o da.
  const waitingTickets = useTickets().data?.filter(t =>
    ((t.assigneeId === me.id || (isAdmin && t.assigneeId === null)) && (t.status === 'YENI' || t.status === 'INCELENIYOR'))
    || (t.requesterId === me.id && t.status === 'YANIT_BEKLENIYOR')).length ?? 0;
  const badges: Record<string, number> = { '/leaves': pendingLeaves, '/users': pendingProfiles + pendingResets, '/docs': pendingDocs, '/surveys': pendingSurveys, '/tickets': waitingTickets };

  return (
    <div className="flex flex-col w-full h-full min-h-0 p-3 overflow-y-auto overscroll-contain scrollbar-hover">
      <button onClick={() => navigate('/')} className={`group ${HOME_TILE.row} rounded-xl text-left`} aria-label="DevHub: Genel Bakış'a git" title="Genel Bakış">
        <span className={`${HOME_TILE.tile} group-hover:bg-accent-hover transition-colors`}>
          <House size={HOME_TILE.icon} weight="fill" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight text-theme-text">DevHub</span>
      </button>

      <nav aria-label="Ana menü" className="flex-1">
        <div className="space-y-0.5 mb-5">
          <NavRow to={HOME_ITEM.to} icon={HOME_ITEM.icon} label={HOME_ITEM.label} end />
          <button
            type="button"
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              navigate('/todo', { state: { origin: { x: Math.round(r.left + 20), y: Math.round(r.top + r.height / 2) } } });
            }}
            className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm text-theme-text/80 hover:bg-theme-lightest hover:text-theme-text transition-colors"
          >
            <ListChecks size={19} aria-hidden="true" />
            <span className="flex-1 text-left">Yapılacaklarım</span>
            {todoUnseen > 0
              ? <Count n={todoUnseen} label={`${todoUnseen} yeni kart`} />
              : <ArrowUpRight size={15} className="text-theme-muted" aria-hidden="true" />}
          </button>
        </div>

        {groupsFor(me).map(g => (
          <div key={g.label} className="mb-5">
            <p className="px-3 mb-1.5 text-xs font-medium text-theme-muted">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map(item => <NavRow key={item.to} to={item.to} icon={item.icon} label={item.label} badge={badges[item.to]} />)}
              {/* Çalışan ekip akışını (son işlemler) pencerede görür; yönetici için "Loglar" bir sayfadır. */}
              {g.label === 'Ekip' && !isAdmin && (
                <button onClick={actions.openLogs} className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm text-theme-text/80 hover:bg-theme-lightest hover:text-theme-text transition-colors">
                  <ListDashes size={19} aria-hidden="true" />
                  <span>Ekip akışı</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="pt-3 shrink-0">
        <UserCard />
      </div>
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="relative text-[0.6875rem] font-semibold tabular min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent text-white flex items-center justify-center" aria-label={label}>
      {n}
    </span>
  );
}

function NavRow({ to, icon: IconCmp, label, end, badge }: { to: string; icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' | 'bold' | 'duotone'; className?: string; 'aria-hidden'?: boolean | 'true' }>; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end} className="block rounded-xl">
      {({ isActive }) => (
        <span className={`relative flex items-center gap-3 h-10 px-3 rounded-xl text-sm transition-colors ${isActive ? 'text-theme-text font-semibold' : 'text-theme-text/80 hover:bg-theme-lightest hover:text-theme-text'}`}>
          {isActive && (
            <motion.span layoutId="nav-active" className="absolute inset-0 bg-theme-medium/15 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
          )}
          <IconCmp size={19} weight={isActive ? 'bold' : 'regular'} className="relative" aria-hidden="true" />
          <span className="relative flex-1 truncate">{label}</span>
          {!!badge && badge > 0 && <Count n={badge} label={`${badge} bekleyen`} />}
        </span>
      )}
    </NavLink>
  )
}

/**
 * Üst bar: yalnızca her sayfada gereken üç şey: arama (Ctrl+K), bildirimler ve "Yeni".
 * Tema seçimi Ayarlar'da ve Ctrl+K'da; yöneticinin logları kenar çubuğunda.
 */
function Topbar({ onOpenPalette, onOpenDrawer }: { onOpenPalette: () => void; onOpenDrawer: () => void }) {
  const me = useMe();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBtn, setNewBtn] = useState<HTMLButtonElement | null>(null);

  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 px-4 sm:px-6 border-b border-theme-light bg-surface/80 backdrop-blur-md relative z-10">
      <button onClick={onOpenDrawer} className="icon-btn lg:hidden" aria-label="Menüyü aç"><List size={20} /></button>

      <button
        onClick={onOpenPalette}
        className="group flex items-center gap-2.5 flex-1 max-w-sm h-9 px-3 rounded-lg bg-theme-lightest/70 border border-transparent text-theme-muted text-sm hover:border-theme-light hover:bg-surface transition-colors"
      >
        <MagnifyingGlass size={16} aria-hidden="true" />
        <span className="flex-1 text-left truncate">Ara: kişi, görev, proje, doküman</span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <LiveStatus />
        <NotificationBell />
        <button ref={setNewBtn} onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Yeni oluştur" className="btn-primary min-h-0 h-9 px-3 ml-1">
          <Plus size={16} weight="bold" />
          <span className="hidden sm:inline">Yeni</span>
        </button>
        <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={newBtn} label="Yeni oluştur">
          <MenuItem icon={CheckSquare} onSelect={run(() => actions.newTask())}>{me.role === 'ADMIN' ? 'Görev ata' : 'Görev ekle'}</MenuItem>
          <MenuItem icon={Airplane} onSelect={run(() => actions.newLeave())}>İzin talebi</MenuItem>
          <MenuItem icon={Headset} onSelect={run(() => navigate('/tickets?yeni=1'))}>Destek talebi</MenuItem>
          {me.role === 'ADMIN' && <>
            <MenuDivider />
            <MenuItem icon={Briefcase} onSelect={run(() => actions.newProject())}>Proje</MenuItem>
            <MenuItem icon={Megaphone} onSelect={run(actions.newAnnouncement)}>Duyuru</MenuItem>
            <MenuItem icon={ChartPieSlice} onSelect={run(() => navigate('/surveys/yeni'))}>Anket</MenuItem>
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
        <div className="card p-5">
          <p className="eyebrow mb-1">Hoş geldiniz, {me.fullName.split(' ')[0]}</p>
          <h2 id="gate-title" className="text-lg font-semibold tracking-tight">Önce kendi şifrenizi belirleyin</h2>
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
