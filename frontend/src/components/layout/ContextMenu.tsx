import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Icon } from '@phosphor-icons/react';
import {
  MagnifyingGlass, ArrowLeft, ArrowsClockwise, LinkSimple, ListChecks, House, Plus, Airplane, Megaphone, Briefcase, Copy, ArrowSquareOut,
} from '@phosphor-icons/react';
import { Menu, MenuItem, MenuDivider, MenuLabel } from '../ui/Menu';
import type { MenuPoint } from '../ui/Menu';
import { useToast } from '../ui/Toast';
import { useMe } from '../../hooks/api';
import { useQuickActions } from './QuickActions';
import { NAV_ITEMS, SYSTEM_ITEMS } from './nav';

/*
 * Sağ tık menüsü. KURAL: uygulamanın her sayfasında sağ tık çalışır.
 *  - Bir öğenin (kart, satır…) kendine özel işlemleri varsa: `const menu = useContextMenu()` ve
 *    `onContextMenu={e => menu(e, { label, items })}`.
 *  - Sayfanın genel işlemleri varsa: `usePageMenu([...])`.
 *  - Hiçbiri yoksa bile boş alana sağ tıklanınca sayfa işlemleri + ortak işlemler (ara, geri, yenile…) açılır.
 * Yazı alanlarında (input/textarea) tarayıcının kendi menüsü kalır: yapıştır, yazım denetimi vb. için gereklidir.
 */

export type ContextEntry =
  | { label: string; icon?: Icon; onSelect: () => void; tone?: 'danger'; disabled?: boolean }
  | 'divider'
  | false | null | undefined;

interface OpenOptions {
  /** Menünün başlığı, ör. "Görev" */
  label?: string;
  items: ContextEntry[];
}

interface Api {
  open: (e: { clientX: number; clientY: number; preventDefault: () => void; defaultPrevented: boolean }, options: OpenOptions) => void;
  register: (get: () => ContextEntry[]) => () => void;
}

const Ctx = createContext<Api | null>(null);

interface State { point: MenuPoint; label?: string; items: ContextEntry[]; link?: string; selection?: string }

const PAGE_NAMES: Record<string, string> = {
  ...Object.fromEntries([...NAV_ITEMS, ...SYSTEM_ITEMS].map(n => [n.to.slice(1) || 'home', n.label])),
  settings: 'Ayarlar',
  todo: 'Yapılacaklarım',
};

export function ContextMenuProvider({ children, onSearch }: { children: ReactNode; onSearch: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const pageItems = useRef(new Set<() => ContextEntry[]>());
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const actions = useQuickActions();
  const qc = useQueryClient();
  const toast = useToast();
  const section = location.pathname.split('/')[1] || 'home';
  const isAdmin = me.role === 'ADMIN';

  const api = useMemo<Api>(() => ({
    open: (e, options) => {
      if (e.defaultPrevented) return; // içteki bir öğe kendi menüsünü açtı
      e.preventDefault();
      setState({ point: { x: e.clientX, y: e.clientY }, ...options });
    },
    register: get => {
      pageItems.current.add(get);
      return () => { pageItems.current.delete(get); };
    },
  }), []);

  // Hiçbir öğenin sahiplenmediği sağ tık: sayfa menüsü.
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if (e.defaultPrevented || e.shiftKey) return; // Shift + sağ tık: tarayıcının kendi menüsü
      const target = e.target as HTMLElement | null;
      if (!target?.closest || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setState({
        point: { x: e.clientX, y: e.clientY },
        items: [],
        link: target.closest<HTMLAnchorElement>('a[href]')?.href,
        selection: window.getSelection()?.toString().trim() || undefined,
      });
    };
    document.addEventListener('contextmenu', onContext);
    return () => document.removeEventListener('contextmenu', onContext);
  }, []);

  const close = useCallback(() => setState(null), []);
  useEffect(close, [location.pathname, close]);

  const copy = (text: string, done: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(done), () => toast.error('Panoya kopyalanamadı.'));
  };

  // Sayfaya göre işlemler (sayfanın usePageMenu ile eklediklerinden önce gelir).
  const routeItems: ContextEntry[] = !state ? [] : [
    ['home', 'team', 'projects', 'tasks'].includes(section) && { label: isAdmin ? 'Yeni görev ata' : 'Kendime görev ekle', icon: Plus, onSelect: () => actions.newTask() },
    section === 'projects' && isAdmin && { label: 'Yeni proje', icon: Briefcase, onSelect: () => actions.newProject() },
    ['home', 'leaves'].includes(section) && { label: 'İzin talebi oluştur', icon: Airplane, onSelect: () => actions.newLeave() },
    section === 'home' && isAdmin && { label: 'Duyuru yayınla', icon: Megaphone, onSelect: () => actions.newAnnouncement() },
  ];
  const registered = state ? [...pageItems.current].flatMap(get => get()) : [];
  const page = [...routeItems, ...registered].filter(Boolean);
  const own = (state?.items ?? []).filter(Boolean);

  const render = (entries: ContextEntry[]) => entries.map((entry, i) => {
    if (!entry) return null;
    if (entry === 'divider') return <MenuDivider key={i} />;
    return (
      <MenuItem key={i} icon={entry.icon} tone={entry.tone} disabled={entry.disabled} onSelect={() => { close(); entry.onSelect(); }}>
        {entry.label}
      </MenuItem>
    );
  });

  return (
    <Ctx.Provider value={api}>
      {children}
      <Menu open={state !== null} onClose={close} point={state?.point} width={248} label="Sağ tık menüsü">
        {own.length > 0 && <>
          {state?.label && <MenuLabel>{state.label}</MenuLabel>}
          {render(own)}
          <MenuDivider />
        </>}
        {state?.selection && <>
          <MenuItem icon={Copy} onSelect={() => { close(); copy(state.selection!, 'Seçim kopyalandı'); }}>Seçimi kopyala</MenuItem>
          <MenuDivider />
        </>}
        {state?.link && <>
          <MenuItem icon={ArrowSquareOut} onSelect={() => { close(); window.open(state.link, '_blank', 'noopener'); }}>Bağlantıyı yeni sekmede aç</MenuItem>
          <MenuItem icon={LinkSimple} onSelect={() => { close(); copy(state.link!, 'Bağlantı kopyalandı'); }}>Bağlantı adresini kopyala</MenuItem>
          <MenuDivider />
        </>}
        {page.length > 0 && <>
          <MenuLabel>{PAGE_NAMES[section] ?? 'Bu sayfa'}</MenuLabel>
          {render(page)}
          <MenuDivider />
        </>}
        <MenuItem icon={MagnifyingGlass} onSelect={() => { close(); onSearch(); }} trailing={<kbd className="text-[10px] font-bold text-theme-muted">Ctrl K</kbd>}>Ara ve komutlar</MenuItem>
        {section === 'todo'
          ? <MenuItem icon={House} onSelect={() => { close(); navigate('/'); }}>Genel Bakış’a git</MenuItem>
          : <MenuItem icon={ListChecks} onSelect={() => { close(); navigate('/todo', { state: { origin: state?.point } }); }}>Yapılacaklarım</MenuItem>}
        <MenuItem icon={ArrowLeft} onSelect={() => { close(); navigate(-1); }}>Geri</MenuItem>
        <MenuItem icon={ArrowsClockwise} onSelect={() => { close(); qc.invalidateQueries().then(() => toast.success('Veriler yenilendi')); }}>Verileri yenile</MenuItem>
        <MenuItem icon={LinkSimple} onSelect={() => { close(); copy(window.location.href, 'Sayfa bağlantısı kopyalandı'); }}>Sayfa bağlantısını kopyala</MenuItem>
      </Menu>
    </Ctx.Provider>
  );
}

/** Bir öğenin sağ tık menüsünü açar: `onContextMenu={e => menu(e, { label: 'Görev', items })}`. */
// eslint-disable-next-line react/only-export-components
export function useContextMenu() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useContextMenu, ContextMenuProvider içinde kullanılmalı');
  return ctx.open;
}

/** Sayfanın sağ tık menüsüne işlem ekler (sayfa açıkken geçerlidir). */
// eslint-disable-next-line react/only-export-components
export function usePageMenu(items: ContextEntry[]) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePageMenu, ContextMenuProvider içinde kullanılmalı');
  const latest = useRef(items);
  useEffect(() => { latest.current = items; });
  const { register } = ctx;
  useEffect(() => register(() => latest.current), [register]);
}
