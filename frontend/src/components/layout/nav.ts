import type { Icon } from '@phosphor-icons/react';
import { House, Users, FolderOpen, Kanban, CalendarBlank, ChartBar, UserGear, Pulse, BookOpenText } from '@phosphor-icons/react';
import type { User } from '../../types';

export interface NavItem { to: string; label: string; icon: Icon; adminOnly?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Genel Bakış', icon: House },
  { to: '/team', label: 'Ekip', icon: Users },
  { to: '/projects', label: 'Projeler', icon: FolderOpen },
  { to: '/tasks', label: 'Görevler', icon: Kanban },
  { to: '/leaves', label: 'İzinler', icon: CalendarBlank },
  { to: '/reports', label: 'Raporlar', icon: ChartBar, adminOnly: true },
  { to: '/docs', label: 'Dokümantasyon', icon: BookOpenText },
];

/** Kenar çubuğunun "Sistem" bölümündeki yönetici sayfaları */
export const SYSTEM_ITEMS: NavItem[] = [
  { to: '/monitoring', label: 'Sistem İzleme', icon: Pulse, adminOnly: true },
  { to: '/users', label: 'Kullanıcılar', icon: UserGear, adminOnly: true },
];

export const navFor = (user: User) => NAV_ITEMS.filter(n => !n.adminOnly || user.role === 'ADMIN');
export const systemNavFor = (user: User) => SYSTEM_ITEMS.filter(n => !n.adminOnly || user.role === 'ADMIN');
