import type { Icon } from '@phosphor-icons/react';
import { Sun, Star, CalendarBlank, Tray, ListBullets, CalendarDots, CheckSquare } from '@phosphor-icons/react';
import { addDays, toDate, toIsoDay } from '../../lib/format';
import type { NewTodo } from '../../hooks/todos';
import type { TodoItem, TodoList, TodoRepeat } from '../../types';

/** Akıllı görünümler + "Genel" + kişinin kendi listeleri (list-<id>). */
export type ViewId = 'today' | 'week' | 'important' | 'planned' | 'tasks' | 'inbox' | 'general' | `list-${number}`;

export interface ViewDef {
  id: ViewId;
  label: string;
  icon: Icon;
  /** Liste rengi (yalnızca kişinin listelerinde) */
  color?: string | null;
  /** Görünüm gerçek bir listeyse o liste (üyeler ve yetki için) */
  list?: TodoList;
  matches: (item: TodoItem) => boolean;
  /** Bu görünümde eklenen kartın varsayılanları */
  defaults: Partial<NewTodo>;
  empty: { title: string; text: string };
  /** Sürükleyerek sıralama yalnızca gerçek listelerde anlamlıdır */
  reorderable: boolean;
  /** Kart listesi yerine kendi bölmesiyle çizilen görünümler (haftalık plan, DevHub görevleri) */
  pane?: 'week' | 'tasks';
}

export const REPEAT: Record<TodoRepeat, { label: string; next: string }> = {
  DAILY: { label: 'Her gün', next: 'ertesi gün' },
  WEEKDAYS: { label: 'Hafta içi her gün', next: 'sonraki iş günü' },
  WEEKLY: { label: 'Her hafta', next: 'bir hafta sonrası' },
  MONTHLY: { label: 'Her ay', next: 'bir ay sonrası' },
};
export const REPEATS: TodoRepeat[] = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'];

/** Haftanın pazartesisi */
export function weekStart(now: Date) {
  return addDays(now, -((now.getDay() + 6) % 7));
}

export const LIST_COLORS = ['#9CAB84', '#C5D89D', '#89986D', '#D8CFA6', '#D9A88A', '#B7C4A0'];

export function buildViews(lists: TodoList[], today: string): { smart: ViewDef[]; own: ViewDef[] } {
  const monday = weekStart(toDate(today));
  const weekFirst = toIsoDay(monday);
  const weekLast = toIsoDay(addDays(monday, 6));
  const smart: ViewDef[] = [
    {
      id: 'today', label: 'Bugün', icon: Sun, reorderable: false,
      // Tarihi bugün olan kartlar + günü geçmiş açık kartlar. Ayrı bir "bugüne ekle" işareti yoktur: bugün = tarihi bugün.
      matches: i => !!i.dueDate && (i.done ? i.dueDate === today : i.dueDate <= today),
      defaults: { dueDate: today },
      empty: { title: 'Bugün için plan yok', text: 'Yukarıdaki kutuya yazıp Enter’a basın ya da bir kartın tarihini “Bugün” yapın.' },
    },
    {
      id: 'week', label: 'Haftalık plan', icon: CalendarDots, reorderable: false, pane: 'week',
      matches: i => !!i.dueDate && i.dueDate >= weekFirst && i.dueDate <= weekLast,
      defaults: { dueDate: today },
      empty: { title: '', text: '' },
    },
    {
      id: 'important', label: 'Önemli', icon: Star, reorderable: false,
      matches: i => i.important,
      defaults: { important: true },
      empty: { title: 'Önemli kart yok', text: 'Bir kartın yıldızına basarak onu buraya alabilirsiniz.' },
    },
    {
      id: 'planned', label: 'Planlanan', icon: CalendarBlank, reorderable: false,
      matches: i => !!i.dueDate,
      defaults: { dueDate: today },
      empty: { title: 'Tarihli kart yok', text: 'Bir karta tarih verdiğinizde burada gün gün sıralanır.' },
    },
    {
      // Kişisel kart değil, DevHub görevleri: sayısı TodoSpace'te görevlerden hesaplanır.
      id: 'tasks', label: 'Görevlerim', icon: CheckSquare, reorderable: false, pane: 'tasks',
      matches: () => false,
      defaults: {},
      empty: { title: '', text: '' },
    },
    {
      id: 'inbox', label: 'Gelenler', icon: Tray, reorderable: false,
      matches: i => i.sentById !== null,
      defaults: {},
      empty: { title: 'Gelen kart yok', text: 'Ekip arkadaşlarınızın size gönderdiği kartlar burada görünür.' },
    },
  ];
  const own: ViewDef[] = [
    {
      id: 'general', label: 'Genel', icon: ListBullets, reorderable: true,
      matches: i => i.listId === null,
      defaults: { listId: null },
      empty: { title: 'Liste boş', text: 'İlk kartınızı yukarıdaki kutuya yazıp Enter’a basarak ekleyin.' },
    },
    ...lists.map<ViewDef>(l => ({
      id: `list-${l.id}`, label: l.name, icon: ListBullets, color: l.color, list: l, reorderable: true,
      matches: i => i.listId === l.id,
      defaults: { listId: l.id },
      empty: { title: 'Liste boş', text: 'Yukarıdaki kutuya yazıp Enter’a basarak bu listeye ilk kartı ekleyin.' },
    })),
  ];
  return { smart, own };
}

export const listIdOf = (view: ViewId): number | null => (view.startsWith('list-') ? Number(view.slice(5)) : null);

/** Planlanan görünümü için gün grupları (yalnızca açık kartlar). */
export function groupByDue(items: TodoItem[], now: Date) {
  const today = toIsoDay(now);
  const tomorrow = toIsoDay(addDays(now, 1));
  const week = toIsoDay(addDays(now, 7));
  const groups: { label: string; tone?: 'danger'; items: TodoItem[] }[] = [
    { label: 'Gecikmiş', tone: 'danger', items: [] },
    { label: 'Bugün', items: [] },
    { label: 'Yarın', items: [] },
    { label: 'Bu hafta', items: [] },
    { label: 'Daha sonra', items: [] },
  ];
  [...items].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).forEach(i => {
    const d = i.dueDate!;
    const g = d < today ? 0 : d === today ? 1 : d === tomorrow ? 2 : d <= week ? 3 : 4;
    groups[g].items.push(i);
  });
  return groups.filter(g => g.items.length > 0);
}

/** Gelecek haftanın pazartesisi (bugün pazartesiyse 7 gün sonrası) */
export function nextMonday(now: Date) {
  const day = now.getDay(); // 0 = pazar
  return toIsoDay(addDays(now, ((8 - day) % 7) || 7));
}
