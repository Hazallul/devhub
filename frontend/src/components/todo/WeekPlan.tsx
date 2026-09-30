import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Star, Repeat, Bell, CheckSquare, Airplane, Confetti, CalendarX, WarningCircle } from '@phosphor-icons/react';
import { DoneToggle } from './TodoCard';
import { useCreateTodo, useUpdateTodo } from '../../hooks/todos';
import { useHolidays, useLeaves, useMe, useUserTasks } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { addDays, formatDate, toIsoDay } from '../../lib/format';
import { weekStart } from './views';
import { useTodoCardMenu } from './cardMenu';
import type { Task, TodoItem } from '../../types';

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
/** Sürüklenen kartın bırakılabileceği "tarihsiz" bölmesi */
const NO_DATE = 'none';

interface Props {
  items: TodoItem[];
  now: Date;
  selectedId: number | null;
  onSelect: (item: TodoItem | null) => void;
  onSend: (item: TodoItem) => void;
}

/**
 * Haftalık plan: kartlar günlere sürüklenerek tarihlenir (tarih kartın ayrıntısından da değiştirilebilir).
 * Aynı günlerde kişinin DevHub görevlerinin son tarihleri, izinleri ve resmî tatiller soluk olarak görünür;
 * bunlar yalnızca bilgi amaçlıdır, kişisel kartlarla karışmaz.
 */
export default function WeekPlan({ items, now, selectedId, onSelect, onSend }: Props) {
  const me = useMe();
  const update = useUpdateTodo();
  const { openTask } = useQuickActions();
  const { data: tasks = [] } = useUserTasks(me.id);
  const { data: leaves = [] } = useLeaves();
  const { data: holidays = [] } = useHolidays();
  const [offset, setOffset] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const today = toIsoDay(now);
  const start = addDays(weekStart(now), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => toIsoDay(addDays(start, i)));
  const first = days[0];
  const last = days[6];

  const byDay = useMemo(() => {
    const m = new Map<string, TodoItem[]>();
    items.filter(i => i.dueDate).forEach(i => m.set(i.dueDate!, [...(m.get(i.dueDate!) ?? []), i]));
    // Gün içinde: önce açık kartlar, saatliler saat sırasıyla, sonra diğerleri
    m.forEach(list => list.sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.position - b.position));
    return m;
  }, [items]);

  const linkedTaskIds = useMemo(() => new Set(items.filter(i => i.taskId !== null && !i.done).map(i => i.taskId)), [items]);
  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.filter(t => t.dueDate && t.status !== 'TAMAMLANDI' && !linkedTaskIds.has(t.id)).forEach(t => m.set(t.dueDate!, [...(m.get(t.dueDate!) ?? []), t]));
    return m;
  }, [tasks, linkedTaskIds]);

  const holidayName = (day: string) => holidays.find(h => h.date === day)?.name;
  const onLeave = (day: string) => leaves.some(l => l.userId === me.id && l.state === 'ONAYLANDI' && l.startDate <= day && day <= l.endDate);

  const overdue = items.filter(i => !i.done && i.dueDate && i.dueDate < today && i.dueDate < first);
  const undated = items.filter(i => !i.done && !i.dueDate).sort((a, b) => a.position - b.position);
  const weekOpen = days.reduce((n, d) => n + (byDay.get(d)?.filter(i => !i.done).length ?? 0), 0);

  const move = (target: string) => {
    const item = items.find(i => i.id === dragId);
    setDragId(null);
    setOver(null);
    if (!item) return;
    if (target === NO_DATE) {
      if (item.dueDate) update.mutate({ id: item.id, dueDate: null, dueTime: null, repeatRule: null });
    } else if (item.dueDate !== target) {
      update.mutate({ id: item.id, dueDate: target });
    }
  };

  const dropProps = (target: string) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId !== null) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(target); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(o => (o === target ? null : o)); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); move(target); },
  });

  const chip = (i: TodoItem) => (
    <PlanCard key={i.id} item={i} selected={i.id === selectedId} dragging={i.id === dragId}
      onSelect={() => onSelect(i.id === selectedId ? null : i)} onSend={() => onSend(i)}
      onDragStart={() => setDragId(i.id)} onDragEnd={() => { setDragId(null); setOver(null); }} />
  );

  return (
    <>
      <header className="pt-4 pb-5 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-theme-text">Haftalık plan</h1>
          <p className="text-sm font-semibold text-theme-muted mt-1.5">
            {formatDate(first)} – {formatDate(last)} · {weekOpen ? `${weekOpen} açık kart` : 'açık kart yok'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOffset(o => o - 1)} className="icon-btn bg-white border border-theme-light/60" aria-label="Önceki hafta"><CaretLeft size={16} weight="bold" /></button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className="h-10 px-4 rounded-xl bg-white border border-theme-light/60 text-sm font-bold text-theme-deep hover:bg-theme-lightest disabled:text-theme-muted disabled:hover:bg-white transition-colors">Bu hafta</button>
          <button type="button" onClick={() => setOffset(o => o + 1)} className="icon-btn bg-white border border-theme-light/60" aria-label="Sonraki hafta"><CaretRight size={16} weight="bold" /></button>
        </div>
      </header>

      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-2">
        <div className="grid grid-cols-7 gap-2 min-w-[980px]">
          {days.map((day, idx) => {
            const date = addDays(start, idx);
            const isToday = day === today;
            const weekend = idx > 4;
            const holiday = holidayName(day);
            const leave = onLeave(day);
            const cards = byDay.get(day) ?? [];
            const dayTasks = tasksByDay.get(day) ?? [];
            return (
              <section
                key={day}
                aria-label={`${DAY_LONG[idx]} ${formatDate(day)}`}
                {...dropProps(day)}
                className={`flex flex-col min-h-[340px] rounded-3xl border p-2 transition-colors ${
                  over === day ? 'border-theme-deep bg-theme-lightest' : isToday ? 'border-theme-medium bg-white' : weekend || holiday || leave ? 'border-theme-light/40 bg-theme-lightest/40' : 'border-theme-light/50 bg-white/70'
                }`}
              >
                <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold tabular ${isToday ? 'bg-theme-deep text-white' : 'text-theme-text'}`}>{date.getDate()}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-theme-deep' : 'text-theme-muted'}`}>{DAY_NAMES[idx]}</span>
                  {isToday && <span className="sr-only">(bugün)</span>}
                </div>

                {(holiday || leave) && (
                  <div className="space-y-1 mb-1.5">
                    {holiday && <p className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-theme-lightest text-[11px] font-bold text-theme-deep"><Confetti size={12} weight="bold" aria-hidden="true" /><span className="truncate" title={holiday}>{holiday}</span></p>}
                    {leave && <p className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-theme-lightest text-[11px] font-bold text-theme-deep"><Airplane size={12} weight="bold" aria-hidden="true" /> İzinlisiniz</p>}
                  </div>
                )}

                {dayTasks.length > 0 && (
                  <ul className="space-y-1 mb-1.5" aria-label="Son günü bu gün olan görevler">
                    {dayTasks.map(t => (
                      <li key={t.id}>
                        <button type="button" onClick={() => openTask(t.id)} title={`Görev: ${t.content}`}
                          className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded-xl border border-dashed border-theme-medium/70 text-left text-[11px] font-semibold text-theme-muted hover:text-theme-deep hover:border-theme-deep transition-colors">
                          <CheckSquare size={13} weight="bold" className="shrink-0 mt-px" aria-hidden="true" />
                          <span className="line-clamp-2 break-words"><span className="sr-only">Görev: </span>{t.content}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <ul className="space-y-1.5 flex-1">{cards.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>
                <DayAdd day={day} label={`${DAY_LONG[idx]} gününe kart ekle`} />
              </section>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 mt-4 lg:grid-cols-2">
        {overdue.length > 0 && (
          <section aria-label="Geciken kartlar" className="rounded-3xl border border-[#E9C9B8] bg-[#FBEDE5]/60 p-3">
            <h2 className="eyebrow text-[#9A3B1B] flex items-center gap-1.5 px-1 mb-2"><WarningCircle size={13} weight="bold" aria-hidden="true" /> Gecikenler <span className="tabular">({overdue.length})</span></h2>
            <ul className="grid gap-1.5 sm:grid-cols-2 max-h-52 overflow-y-auto scrollbar-thin">{overdue.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>
          </section>
        )}
        <section aria-label="Tarihsiz kartlar" {...dropProps(NO_DATE)}
          className={`rounded-3xl border p-3 transition-colors ${overdue.length === 0 ? 'lg:col-span-2' : ''} ${over === NO_DATE ? 'border-theme-deep bg-theme-lightest' : 'border-theme-light/50 bg-white/70'}`}>
          <h2 className="eyebrow flex items-center gap-1.5 px-1 mb-2"><CalendarX size={13} weight="bold" aria-hidden="true" /> Tarihsiz <span className="tabular">({undated.length})</span></h2>
          {undated.length === 0
            ? <p className="text-xs font-medium text-theme-muted px-1 pb-1">Tarihsiz kart yok. Aşağıdan ekleyin ya da bir kartın tarihini kaldırmak için buraya bırakın.</p>
            : <ul className={`grid gap-1.5 sm:grid-cols-2 ${overdue.length === 0 ? 'lg:grid-cols-4' : ''} max-h-52 overflow-y-auto scrollbar-thin`}>{undated.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>}
          <DayAdd day={null} label="Tarihsiz kart ekle" placeholder="Tarihsiz kart ekle; sonra bir güne sürükleyin" />
        </section>
      </div>
      <p className="text-xs font-medium text-theme-muted mt-3 px-1">
        Kartları günler arasında sürükleyin ya da kartı açıp tarihini değiştirin. Kesikli çerçeveli satırlar DevHub görevlerinizin son tarihleridir.
      </p>
    </>
  );
}

/** Plandaki küçük kart: sürüklenebilir, tıklanınca ayrıntı açılır. */
function PlanCard({ item, selected, dragging, onSelect, onSend, onDragStart, onDragEnd }: {
  item: TodoItem; selected: boolean; dragging: boolean; onSelect: () => void; onSend: () => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const update = useUpdateTodo();
  const menu = useTodoCardMenu();
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(item.id)); onDragStart(); }}
      onDragEnd={onDragEnd}
      onContextMenu={e => menu(e, item, { onOpen: onSelect, onSend })}
      className={`flex items-start gap-2 rounded-2xl border bg-white px-2 py-2 shadow-soft cursor-grab active:cursor-grabbing transition-[border-color,opacity] ${
        selected ? 'border-theme-deep' : 'border-theme-light/60 hover:border-theme-medium'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <span className="mt-px"><DoneToggle size="sm" done={item.done} onToggle={() => update.mutate({ id: item.id, done: !item.done })} label={item.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} /></span>
      <button type="button" onClick={onSelect} aria-expanded={selected} className="min-w-0 flex-1 text-left rounded-lg">
        <span className={`block text-[13px] font-semibold leading-snug break-words line-clamp-3 ${item.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{item.title}</span>
        {(item.dueTime || item.repeatRule || item.important || item.taskId !== null) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] font-bold text-theme-muted">
            {item.dueTime && <span className="inline-flex items-center gap-0.5 tabular"><Bell size={11} weight="bold" aria-hidden="true" /> {item.dueTime}</span>}
            {item.repeatRule && <Repeat size={11} weight="bold" aria-label="Tekrarlanır" />}
            {item.taskId !== null && <CheckSquare size={11} weight="bold" aria-label="Bir göreve bağlı" />}
            {item.important && <Star size={11} weight="fill" className="text-[#B8861B]" aria-label="Önemli" />}
          </span>
        )}
      </button>
    </div>
  );
}

/** Günün altındaki hızlı ekleme: yazıp Enter'a basınca kart o güne (day null ise tarihsiz olarak) eklenir. */
function DayAdd({ day, label, placeholder = 'Ekle' }: { day: string | null; label: string; placeholder?: string }) {
  const create = useCreateTodo();
  const [draft, setDraft] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title, dueDate: day });
    setDraft('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-xl text-theme-muted focus-within:bg-theme-cream focus-within:text-theme-deep hover:bg-theme-cream transition-colors">
      <Plus size={13} weight="bold" className="shrink-0" aria-hidden="true" />
      <input value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} placeholder={placeholder} aria-label={label}
        className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-theme-text placeholder:text-theme-muted focus:outline-none" />
    </form>
  );
}
