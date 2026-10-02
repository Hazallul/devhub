import type { Icon } from '@phosphor-icons/react';
import { House, Users, Folder, CheckSquare, CalendarBlank, ChartBar, UserGear, Pulse, BookOpenText, ListDashes } from '@phosphor-icons/react';
import type { User } from '../../types';

export interface NavItem { to: string; label: string; icon: Icon; adminOnly?: boolean }
export interface NavGroup { label: string; items: NavItem[]; adminOnly?: boolean }

/** Kenar çubuğunun en üstü (grup başlığı yok). "Yapılacaklarım" ayrı bir düğmedir (tam ekran kişisel alan açar). */
export const HOME_ITEM: NavItem = { to: '/', label: 'Genel Bakış', icon: House };

/** Kenar çubuğu grupları: İş / Ekip / Yönetim */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'İş',
    items: [
      { to: '/tasks', label: 'Görevler', icon: CheckSquare },
      { to: '/projects', label: 'Projeler', icon: Folder },
      { to: '/docs', label: 'Dokümantasyon', icon: BookOpenText },
    ],
  },
  {
    label: 'Ekip',
    items: [
      { to: '/team', label: 'Çalışanlar', icon: Users },
      { to: '/leaves', label: 'İzinler', icon: CalendarBlank },
      { to: '/reports', label: 'Raporlar', icon: ChartBar, adminOnly: true },
    ],
  },
  {
    label: 'Yönetim',
    adminOnly: true,
    items: [
      { to: '/users', label: 'Kullanıcılar', icon: UserGear, adminOnly: true },
      { to: '/logs', label: 'Loglar', icon: ListDashes, adminOnly: true },
      { to: '/monitoring', label: 'Sistem İzleme', icon: Pulse, adminOnly: true },
    ],
  },
];

const visible = (user: User) => (n: { adminOnly?: boolean }) => !n.adminOnly || user.role === 'ADMIN';

export const groupsFor = (user: User) =>
  NAV_GROUPS.filter(visible(user)).map(g => ({ ...g, items: g.items.filter(visible(user)) }));

/** Komut paleti vb. için düz liste: ana sayfalar ve yönetim sayfaları */
export const navFor = (user: User) => [HOME_ITEM, ...NAV_GROUPS.filter(g => !g.adminOnly).flatMap(g => g.items)].filter(visible(user));
export const systemNavFor = (user: User) => NAV_GROUPS.filter(g => g.adminOnly).flatMap(g => g.items).filter(visible(user));

/** Tüm sayfalar (sağ tık menüsünde sayfa adları için) */
export const ALL_NAV_ITEMS: NavItem[] = [HOME_ITEM, ...NAV_GROUPS.flatMap(g => g.items)];

/**
 * Kenar çubuğundaki logo satırı ile kişisel alandaki (TodoSpace) başlık satırı aynı ölçüleri kullanır:
 * ev karosu iki ekran arasında geçerken yerinden oynamaz.
 */
export const HOME_TILE = {
  row: 'flex items-center gap-2.5 px-2 h-12 mb-2',
  tile: 'w-9 h-9 shrink-0 rounded-xl bg-accent text-white flex items-center justify-center',
  icon: 18,
} as const;
