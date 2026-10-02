import type { Icon } from '@phosphor-icons/react';
import { Sun, ListBullets, CalendarDots } from '@phosphor-icons/react';
import { addDays, parseServerDate, toDate, toIsoDay } from '../../lib/format';
import { listColor } from '../../lib/meta';
import type { NewTodo } from '../../hooks/todos';
import type { TodoItem, TodoList, TodoRepeat } from '../../types';

/**
 * Bugün panosu + haftalık plan + "Genel" + kişinin kendi listeleri (list-<id>).
 * Eski Önemli / Planlanan / Görevlerim / Gelenler görünümleri Bugün panosunun bölümleri oldu (kayıtlı eski kimlikler Bugün'e düşer).
 */
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
  /** Kart listesi yerine kendi bölmesiyle çizilen görünümler (Bugün panosu, haftalık plan) */
  pane?: 'week' | 'board';
}

export const REPEAT: Record<TodoRepeat, { label: string; next: string }> = {
  DAILY: { label: 'Her gün', next: 'ertesi gün' },
  WEEKDAYS: { label: 'Hafta içi her gün', next: 'sonraki iş günü' },
  WEEKLY: { label: 'Her hafta', next: 'bir hafta sonrası' },
  MONTHLY: { label: 'Her ay', next: 'bir ay sonrası' },
};
export const REPEATS: TodoRepeat[] = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'];

/**
 * "Bugün"e giren kart: tarihi bugün olan ve günü geçmiş açık kartlar; tamamlananlardan tarihi bugün olanlar ve
 * bugün tamamlanan gecikmiş kartlar (yoksa gecikmiş bir kart tamamlanınca listeden ve "bugün biten" sayısından kaybolurdu).
 */
export function inToday(i: TodoItem, today: string) {
  if (!i.dueDate || i.dueDate > today) return false;
  if (!i.done) return true;
  return i.dueDate === today || (!!i.doneAt && toIsoDay(parseServerDate(i.doneAt)) === today);
}

/** Haftanın pazartesisi */
export function weekStart(now: Date) {
  return addDays(now, -((now.getDay() + 6) % 7));
}

export const LIST_COLORS = ['#5C87D8', '#3A9E9A', '#7A8BA6', '#C9932C', '#D0728C', '#8B7BD8'];

export function buildViews(lists: TodoList[], today: string): { smart: ViewDef[]; own: ViewDef[] } {
  const monday = weekStart(toDate(today));
  const weekFirst = toIsoDay(monday);
  const weekLast = toIsoDay(addDays(monday, 6));
  const smart: ViewDef[] = [
    {
      // Pano: bugün + gecikmiş, yaklaşan, önemli, gelenler ve DevHub görevleri tek ekranda (TodayBoard).
      id: 'today', label: 'Bugün', icon: Sun, reorderable: false, pane: 'board',
      // Tarihi bugün olan kartlar + günü geçmiş açık kartlar. Ayrı bir "bugüne ekle" işareti yoktur: bugün = tarihi bugün.
      matches: i => inToday(i, today),
      defaults: { dueDate: today },
      empty: { title: 'Bugün için plan yok', text: 'Yukarıdaki kutuya yazıp Enter’a basın ya da bir kartın tarihini “Bugün” yapın.' },
    },
    {
      id: 'week', label: 'Haftalık plan', icon: CalendarDots, reorderable: false, pane: 'week',
      matches: i => !!i.dueDate && i.dueDate >= weekFirst && i.dueDate <= weekLast,
      defaults: { dueDate: today },
      empty: { title: '', text: '' },
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
      id: `list-${l.id}`, label: l.name, icon: ListBullets, color: listColor(l.color), list: l, reorderable: true,
      matches: i => i.listId === l.id,
      defaults: { listId: l.id },
      empty: { title: 'Liste boş', text: 'Yukarıdaki kutuya yazıp Enter’a basarak bu listeye ilk kartı ekleyin.' },
    })),
  ];
  return { smart, own };
}

/** Ortak listede başkasının eklediği kartı yalnızca liste yöneticisi silebilir (sunucu da aynı kuralı uygular). */
export function canDeleteCard(item: TodoItem, lists: TodoList[], meId: number) {
  if (item.listId === null || item.ownerId === meId) return true;
  return lists.find(l => l.id === item.listId)?.myRole === 'ADMIN';
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
