import type { Icon } from '@phosphor-icons/react';
import { House, Users, FolderOpen, Kanban, CalendarBlank } from '@phosphor-icons/react';

export interface NavItem { to: string; label: string; icon: Icon }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Genel Bakış', icon: House },
  { to: '/team', label: 'Ekip', icon: Users },
  { to: '/projects', label: 'Projeler', icon: FolderOpen },
  { to: '/tasks', label: 'Görevler', icon: Kanban },
  { to: '/leaves', label: 'İzinler', icon: CalendarBlank },
];
