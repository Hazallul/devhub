import { useMemo, useRef, useState } from 'react';
import { CalendarBlank, CaretDown, Plus, Star, Sun, Tray } from '@phosphor-icons/react';
import TodoCard from './TodoCard';
import TasksPanel from './TasksPane';
import { GroupLabel, Panel, PanelEmpty } from './Panel';
import { useLimited } from './useLimited';
import { groupByDue, inToday } from './views';
import { useCreateTodo } from '../../hooks/todos';
import { useMe } from '../../hooks/api';
import { firstName, formatLongDate, toIsoDay, addDays } from '../../lib/format';
import type { TodoItem, TodoList } from '../../types';

interface Props {
  items: TodoItem[];
  lists: TodoList[];
  now: Date;
  selectedId: number | null;
  onSelect: (item: TodoItem | null) => void;
  onSend: (item: TodoItem) => void;
}

const byDueThenTime = (a: TodoItem, b: TodoItem) =>
  (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.position - b.position;

/**
 * Kişisel alanın ana ekranı: eskiden ayrı sayfalar olan Bugün, Planlanan, Önemli, Gelenler ve Görevlerim tek bakışta.
 * Sol: bugün + gecikmiş (hızlı ekleme burada), orta: yaklaşan günler, sağ: DevHub görevleri, önemliler ve gelen kartlar.
 */
export default function TodayBoard({ items, lists, now, selectedId, onSelect, onSend }: Props) {
  const me = useMe();
  const create = useCreateTodo();
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = toIsoDay(now);
  const weekEnd = toIsoDay(addDays(now, 7));

  const sets = useMemo(() => {
    const open = items.filter(i => !i.done);
    return {
      overdue: open.filter(i => i.dueDate && i.dueDate < today).sort(byDueThenTime),
      today: open.filter(i => i.dueDate === today).sort(byDueThenTime),
      doneToday: items.filter(i => i.done && inToday(i, today)),
      upcoming: groupByDue(open.filter(i => i.dueDate && i.dueDate > today), now),
      important: open.filter(i => i.important).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
      // Gelenler: görülmemişler önce, sonra en yeni
      inbox: items.filter(i => i.sentById !== null && !i.done).sort((a, b) => Number(a.seen) - Number(b.seen) || b.id - a.id),
      thisWeek: open.filter(i => i.dueDate && i.dueDate > today && i.dueDate <= weekEnd).length,
    };
  }, [items, today, weekEnd, now]);

  const important = useLimited(sets.important, 5);
  const inbox = useLimited(sets.inbox, 5);
  const listName = (i: TodoItem) => (i.listId === null ? 'Genel' : lists.find(l => l.id === i.listId)?.name ?? '');
  const unseen = sets.inbox.filter(i => !i.seen).length;
  const todayTotal = sets.today.length + sets.doneToday.length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title, dueDate: today });
    setDraft('');
    inputRef.current?.focus();
  };

  const row = (i: TodoItem) => (
    <li key={i.id}>
      <TodoCard
        item={i}
        selected={i.id === selectedId}
        listName={listName(i)}
        ownerLabel={i.ownerId !== me.id ? firstName(i.ownerName) : undefined}
        onSelect={() => onSelect(i.id === selectedId ? null : i)}
        onSend={() => onSend(i)}
      />
    </li>
  );
  const rows = (list: TodoItem[]) => <ul className="divide-y divide-theme-light">{list.map(row)}</ul>;

  return (
    <>
      <header className="pt-6 pb-5 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-theme-text">Bugün</h1>
          <p className="text-sm text-theme-muted mt-0.5">{formatLongDate(now)}</p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <Stat label="Bugün" value={sets.today.length} />
          <Stat label="Gecikmiş" value={sets.overdue.length} tone={sets.overdue.length ? 'danger' : undefined} />
          <Stat label="Bu hafta" value={sets.thisWeek} />
          <div className="min-w-[7rem]">
            <dt className="text-xs text-theme-muted">Bugün biten</dt>
            <dd className="text-lg font-semibold tabular text-theme-text leading-tight">{sets.doneToday.length}<span className="text-theme-muted font-normal text-sm"> / {todayTotal}</span></dd>
            <div className="h-1 rounded-full bg-theme-lightest mt-1 overflow-hidden" role="progressbar" aria-label="Bugünün tamamlanma oranı"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={todayTotal ? Math.round((sets.doneToday.length / todayTotal) * 100) : 0}>
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${todayTotal ? (sets.doneToday.length / todayTotal) * 100 : 0}%` }} />
            </div>
          </div>
        </dl>
      </header>

      <div className="grid gap-4 items-start lg:grid-cols-2 xl:grid-cols-3">
        {/* Bugün + gecikmiş */}
        <Panel title="Bugün" icon={Sun} count={sets.today.length + sets.overdue.length}>
          <form onSubmit={add} className="flex items-center gap-2.5 pl-3.5 pr-2 h-11 border-b border-theme-light focus-within:bg-theme-lightest/40 transition-colors">
            <Plus size={16} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
            <input ref={inputRef} value={draft} maxLength={300} onChange={e => setDraft(e.target.value)}
              placeholder="Bugüne kart ekle…" aria-label="Bugüne yeni kart"
              className="flex-1 min-w-0 bg-transparent text-sm text-theme-text placeholder:text-theme-muted focus:outline-none" />
            {draft.trim() && <button type="submit" className="btn-primary min-h-0 h-8 px-3 text-xs">Ekle</button>}
          </form>
          {sets.overdue.length > 0 && <><GroupLabel tone="danger" count={sets.overdue.length}>Gecikmiş</GroupLabel>{rows(sets.overdue)}</>}
          {sets.today.length > 0 && <>{sets.overdue.length > 0 && <GroupLabel count={sets.today.length}>Bugün</GroupLabel>}{rows(sets.today)}</>}
          {sets.overdue.length + sets.today.length === 0 && (
            <PanelEmpty>{sets.doneToday.length ? 'Bugünün kartları bitti.' : 'Bugün için plan yok. Yukarıya yazıp Enter’a basın ya da görevlerinizden ekleyin.'}</PanelEmpty>
          )}
          {sets.doneToday.length > 0 && (
            <>
              <button type="button" onClick={() => setShowDone(s => !s)} aria-expanded={showDone}
                className="w-full flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-theme-muted border-t border-theme-light hover:bg-theme-lightest/60 hover:text-theme-text transition-colors">
                <CaretDown size={12} weight="bold" className={`transition-transform ${showDone ? '' : '-rotate-90'}`} aria-hidden="true" />
                Bugün tamamlanan <span className="tabular">{sets.doneToday.length}</span>
              </button>
              {showDone && <div className="border-t border-theme-light">{rows(sets.doneToday)}</div>}
            </>
          )}
        </Panel>

        {/* Yaklaşan günler */}
        <Panel title="Yaklaşan" icon={CalendarBlank} count={sets.upcoming.reduce((n, g) => n + g.items.length, 0)}>
          {sets.upcoming.length === 0
            ? <PanelEmpty>Yaklaşan tarihli kart yok. Bir karta tarih verdiğinizde burada gün gün sıralanır.</PanelEmpty>
            : sets.upcoming.map(g => <Upcoming key={g.label} label={g.label} items={g.items} rows={rows} />)}
        </Panel>

        {/* Görevler, önemliler, gelenler */}
        <div className="grid gap-4 content-start lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
          <TasksPanel items={items} onSelect={onSelect} />
          <Panel title="Önemli" icon={Star} count={sets.important.length}>
            {sets.important.length === 0 ? <PanelEmpty>Bir kartın yıldızına basarak onu buraya alın.</PanelEmpty> : rows(important.shown)}
            {important.more}
          </Panel>
          <Panel title="Gelenler" icon={Tray} count={sets.inbox.length}
            action={unseen > 0 && <span className="text-[0.6875rem] font-semibold tabular h-5 px-1.5 rounded-full bg-danger-solid text-white inline-flex items-center">{unseen} yeni</span>}>
            {sets.inbox.length === 0 ? <PanelEmpty>Ekip arkadaşlarınızın size gönderdiği kartlar burada görünür.</PanelEmpty> : rows(inbox.shown)}
            {inbox.more}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div>
      <dt className="text-xs text-theme-muted">{label}</dt>
      <dd className={`text-lg font-semibold tabular leading-tight ${tone === 'danger' ? 'text-danger' : 'text-theme-text'}`}>{value}</dd>
    </div>
  );
}

/** Yaklaşan grubundaki kartlar; uzun "Daha sonra" grubu kısaltılır. */
function Upcoming({ label, items, rows }: { label: string; items: TodoItem[]; rows: (l: TodoItem[]) => React.ReactNode }) {
  const { shown, more } = useLimited(items, label === 'Daha sonra' ? 4 : 8);
  return (
    <>
      <GroupLabel count={items.length}>{label}</GroupLabel>
      {rows(shown)}
      {more}
    </>
  );
}
