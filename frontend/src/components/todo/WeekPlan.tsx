import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Star, Repeat, Bell, CheckSquare, Airplane, Confetti, CalendarX, WarningCircle, ArrowRight } from '@phosphor-icons/react';
import { DoneToggle } from './TodoCard';
import TaskChip, { TASK_CARD_SURFACE } from './TaskChip';
import { Panel, PanelEmpty } from './Panel';
import { useLimited } from './useLimited';
import { Segmented } from '../ui/primitives';
import { useCreateTodo, useUpdateTodo } from '../../hooks/todos';
import { useHolidays, useLeaves, useMe, useUserTasks } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { addDays, formatDate, toIsoDay } from '../../lib/format';
import { formatEstimate } from '../../lib/effort';
import { taskUrgency } from '../../lib/urgency';
import { weekStart } from './views';
import { useTodoCardMenu } from './cardMenu';
import type { Task, TodoItem } from '../../types';

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
/** Sürüklenen kartın bırakılabileceği "tarihsiz" bölmesi */
const NO_DATE = 'none';
/** Hafta içi sütunları geniş, hafta sonu daha dar: iş günlerine yer kalır. */
const COLS = 'grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.72fr))]';
const SPAN_KEY = 'devhub.todo.weeks';
type Span = '1' | '2';

function readSpan(): Span {
  try { return localStorage.getItem(SPAN_KEY) === '1' ? '1' : '2'; } catch { return '2'; }
}

interface Props {
  items: TodoItem[];
  now: Date;
  selectedId: number | null;
  onSelect: (item: TodoItem | null) => void;
  onSend: (item: TodoItem) => void;
}

/**
 * Plan: kartlar günlere sürüklenerek tarihlenir (tarih kartın ayrıntısından da değiştirilebilir).
 * Varsayılan iki hafta görünür (bu hafta + gelecek hafta): pazar günü bakan kişi pazartesinin büyük işini de görür.
 * Kişinin DevHub görevlerinin son tarihleri (tahmini iş büyüklüğüyle), izinleri ve resmî tatiller günlerin içinde bilgi olarak durur;
 * pencerenin ötesindeki işler "Sonrası" bölümünde listelenir.
 */
export default function WeekPlan({ items, now, selectedId, onSelect, onSend }: Props) {
  const me = useMe();
  const update = useUpdateTodo();
  const { openTask } = useQuickActions();
  const { data: tasks = [] } = useUserTasks(me.id);
  const { data: leaves = [] } = useLeaves();
  const { data: holidays = [] } = useHolidays();
  const [offset, setOffset] = useState(0);
  const [span, setSpanState] = useState<Span>(readSpan);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const setSpan = (s: Span) => {
    setSpanState(s);
    try { localStorage.setItem(SPAN_KEY, s); } catch { /* depolama kapalı olabilir */ }
  };

  const today = toIsoDay(now);
  const thisMonday = weekStart(now);
  const start = addDays(thisMonday, offset * 7);
  const weeks = Array.from({ length: Number(span) }, (_, w) => Array.from({ length: 7 }, (_, i) => toIsoDay(addDays(start, w * 7 + i))));
  const days = weeks.flat();
  const first = days[0];
  const last = days[days.length - 1];

  const byDay = useMemo(() => {
    const m = new Map<string, TodoItem[]>();
    items.filter(i => i.dueDate).forEach(i => m.set(i.dueDate!, [...(m.get(i.dueDate!) ?? []), i]));
    // Gün içinde: önce açık kartlar, saatliler saat sırasıyla, sonra diğerleri
    m.forEach(list => list.sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.position - b.position));
    return m;
  }, [items]);

  const linkedTaskIds = useMemo(() => new Set(items.filter(i => i.taskId !== null && !i.done).map(i => i.taskId)), [items]);
  const openTasks = useMemo(() => tasks.filter(t => t.dueDate && t.status !== 'TAMAMLANDI' && !linkedTaskIds.has(t.id)), [tasks, linkedTaskIds]);
  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    openTasks.forEach(t => m.set(t.dueDate!, [...(m.get(t.dueDate!) ?? []), t]));
    return m;
  }, [openTasks]);

  const holidayName = (day: string) => holidays.find(h => h.date === day)?.name;
  const onLeave = (day: string) => leaves.some(l => l.userId === me.id && l.state === 'ONAYLANDI' && l.startDate <= day && day <= l.endDate);

  const overdue = items.filter(i => !i.done && i.dueDate && i.dueDate < today && i.dueDate < first);
  const undated = items.filter(i => !i.done && !i.dueDate).sort((a, b) => a.position - b.position);
  const openIn = (list: string[]) => list.reduce((n, d) => n + (byDay.get(d)?.filter(i => !i.done).length ?? 0), 0);

  // Pencerenin ötesi: tarihli açık kartlar ve görev teslimleri, en yakını önce
  const later = useMemo(() => [
    ...items.filter(i => !i.done && i.dueDate && i.dueDate > last).map(i => ({ key: `c${i.id}`, date: i.dueDate!, card: i as TodoItem | undefined, task: undefined as Task | undefined })),
    ...openTasks.filter(t => t.dueDate! > last).map(t => ({ key: `t${t.id}`, date: t.dueDate!, card: undefined, task: t })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [items, openTasks, last]);
  const laterLimited = useLimited(later, 6);

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

  const weekName = (weekFirst: string) => {
    const diff = Math.round((new Date(weekFirst).getTime() - new Date(toIsoDay(thisMonday)).getTime()) / (7 * 86_400_000));
    return diff === 0 ? 'Bu hafta' : diff === 1 ? 'Gelecek hafta' : diff === -1 ? 'Geçen hafta' : null;
  };

  const twoWeeks = span === '2';

  return (
    <>
      <header className="pt-6 pb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto min-w-[13.75rem]">
          <h1 className="text-2xl font-semibold tracking-tight text-theme-text">Haftalık plan</h1>
          <p className="text-sm text-theme-muted mt-0.5">
            {formatDate(first)} – {formatDate(last)} · {openIn(days) ? `${openIn(days)} açık kart` : 'açık kart yok'}
          </p>
        </div>
        <Segmented<Span> label="Görünen süre" layoutId="plan-span" value={span} onChange={setSpan}
          options={[{ value: '1', label: '1 hafta' }, { value: '2', label: '2 hafta' }]} />
        <div className="inline-flex items-center rounded-xl border border-theme-light bg-surface overflow-hidden">
          <button type="button" onClick={() => setOffset(o => o - 1)} className="h-9 w-9 flex items-center justify-center text-theme-muted hover:bg-theme-lightest hover:text-theme-text transition-colors" aria-label="Bir hafta geri"><CaretLeft size={15} weight="bold" /></button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className="h-9 px-3 text-sm font-medium border-x border-theme-light text-theme-text hover:bg-theme-lightest disabled:text-theme-muted disabled:hover:bg-transparent transition-colors">Bu hafta</button>
          <button type="button" onClick={() => setOffset(o => o + 1)} className="h-9 w-9 flex items-center justify-center text-theme-muted hover:bg-theme-lightest hover:text-theme-text transition-colors" aria-label="Bir hafta ileri"><CaretRight size={15} weight="bold" /></button>
        </div>
      </header>

      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
        <div className="min-w-[56rem] space-y-4">
          {weeks.map(week => {
            const name = weekName(week[0]);
            const weekTasks = week.flatMap(d => tasksByDay.get(d) ?? []);
            const taskMinutes = weekTasks.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0);
            return (
              <section key={week[0]} aria-label={name ?? `${formatDate(week[0])} haftası`}>
                {/* Hafta başlığı: iki hafta görünürken hangisinin hangisi olduğu ve o haftanın yükü */}
                <p className="flex items-baseline gap-2 px-1 mb-1.5 text-xs text-theme-muted">
                  <span className="text-sm font-semibold text-theme-text">{name ?? `${formatDate(week[0])} haftası`}</span>
                  {name && <span>{formatDate(week[0])} – {formatDate(week[6])}</span>}
                  <span className="tabular">· {openIn(week)} kart</span>
                  {weekTasks.length > 0 && <span className="tabular">· {weekTasks.length} görev teslimi{taskMinutes ? `, ${formatEstimate(taskMinutes)} iş` : ''}</span>}
                </p>
                <div className={`grid ${COLS} gap-1.5`}>
                  {week.map((day, idx) => {
                    const date = new Date(`${day}T00:00:00`);
                    const isToday = day === today;
                    const past = day < today;
                    const holiday = holidayName(day);
                    const leave = onLeave(day);
                    const quiet = idx > 4 || !!holiday || leave;
                    const cards = byDay.get(day) ?? [];
                    const open = cards.filter(i => !i.done).length;
                    const dayTasks = tasksByDay.get(day) ?? [];
                    return (
                      <div
                        key={day}
                        role="group"
                        aria-label={`${DAY_LONG[idx]} ${formatDate(day)}${isToday ? ' (bugün)' : ''}`}
                        {...dropProps(day)}
                        className={`group flex flex-col rounded-2xl border p-1.5 transition-colors ${twoWeeks ? 'min-h-[10.5rem]' : 'min-h-[22rem]'} ${
                          over === day ? 'border-accent bg-accent/[0.06]'
                            : isToday ? 'border-accent/70 bg-surface shadow-[0_0_0_3px_rgb(var(--accent)/0.08)]'
                              : quiet || past ? 'border-theme-light bg-theme-lightest/50'
                                : 'border-theme-light bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-1 pb-1.5">
                          <span className={`min-w-[1.75rem] h-7 px-1 rounded-lg flex items-center justify-center text-sm font-semibold tabular ${isToday ? 'bg-accent text-white' : past ? 'text-theme-muted' : 'text-theme-text'}`}>{date.getDate()}</span>
                          <span className={`text-xs ${isToday ? 'text-theme-deep font-medium' : 'text-theme-muted'}`}>
                            {isToday ? 'Bugün' : DAY_NAMES[idx]}{date.getDate() === 1 && ` · ${date.toLocaleDateString('tr-TR', { month: 'short' })}`}
                          </span>
                          {open > 0 && <span className="ml-auto text-[0.6875rem] tabular text-theme-muted" title={`${open} açık kart`}>{open}</span>}
                        </div>

                        {(holiday || leave) && (
                          <div className="space-y-1 mb-1">
                            {holiday && <p className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface border border-theme-light text-[0.6875rem] font-medium text-theme-deep"><Confetti size={12} weight="bold" aria-hidden="true" /><span className="truncate" title={holiday}>{holiday}</span></p>}
                            {leave && <p className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface border border-theme-light text-[0.6875rem] font-medium text-theme-deep"><Airplane size={12} weight="bold" aria-hidden="true" /> İzinlisiniz</p>}
                          </div>
                        )}

                        {dayTasks.length > 0 && (
                          <ul className="space-y-1 mb-1" aria-label="Son günü bu gün olan görevler">
                            {dayTasks.map(t => <li key={t.id}><TaskHint task={t} onOpen={() => openTask(t.id)} /></li>)}
                          </ul>
                        )}

                        <ul className="space-y-1 flex-1">{cards.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>
                        <DayAdd day={day} label={`${DAY_LONG[idx]} gününe kart ekle`} />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 mt-5 items-start lg:grid-cols-3">
        {overdue.length > 0 && (
          <Panel title="Gecikenler" icon={WarningCircle} tone="danger" count={overdue.length}>
            <ul className="grid gap-1 p-1.5 max-h-60 overflow-y-auto scrollbar-thin">{overdue.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>
          </Panel>
        )}

        <div {...dropProps(NO_DATE)} className={`rounded-2xl transition-shadow ${over === NO_DATE ? 'ring-2 ring-accent' : ''} ${overdue.length === 0 ? 'lg:col-span-2' : ''}`}>
          <Panel title="Tarihsiz" icon={CalendarX} count={undated.length}>
            {undated.length === 0
              ? <PanelEmpty>Tarihsiz kart yok. Bir kartın tarihini kaldırmak için buraya bırakın.</PanelEmpty>
              : <ul className={`grid gap-1 p-1.5 sm:grid-cols-2 ${overdue.length === 0 ? 'xl:grid-cols-3' : ''} max-h-60 overflow-y-auto scrollbar-thin`}>{undated.map(i => <li key={i.id}>{chip(i)}</li>)}</ul>}
            <div className="px-1.5 pb-1.5"><DayAdd day={null} label="Tarihsiz kart ekle" placeholder="Tarihsiz kart ekle, sonra bir güne sürükleyin" always /></div>
          </Panel>
        </div>

        {/* Pencerenin ötesi: ileri tarihli işler gözden kaçmasın */}
        <Panel title="Sonrası" icon={ArrowRight} count={later.length}>
          {later.length === 0 ? <PanelEmpty>{formatDate(last)} sonrasına tarihli iş yok.</PanelEmpty> : (
            <ul className="divide-y divide-theme-light">
              {laterLimited.shown.map(e => {
                const high = e.task ? taskUrgency(e.task).high : false;
                return (
                  <li key={e.key}>
                    <button type="button" onClick={() => (e.task ? openTask(e.task.id) : onSelect(e.card!))}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-theme-lightest/60 transition-colors">
                      <span className="w-14 shrink-0 text-xs tabular text-theme-muted">{formatDate(e.date)}</span>
                      {e.task
                        ? <CheckSquare size={14} weight="bold" className={high ? 'text-clay shrink-0' : 'text-theme-muted shrink-0'} aria-label="Görev" />
                        : <span className="w-3.5 flex justify-center shrink-0" aria-label="Kart"><span className="w-2 h-2 rounded-full border-2 border-theme-medium" /></span>}
                      <span className="min-w-0 flex-1 text-sm truncate text-theme-text">{e.task ? e.task.content : e.card!.title}</span>
                      {e.task?.estimatedMinutes ? <span className={`shrink-0 text-xs tabular ${high ? 'text-clay-ink font-medium' : 'text-theme-muted'}`}>{formatEstimate(e.task.estimatedMinutes)}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {laterLimited.more}
        </Panel>
      </div>
      <p className="text-xs text-theme-muted mt-3 px-1">
        Kartları günler arasında sürükleyin ya da kartı açıp tarihini değiştirin. Kesikli çerçeveli satırlar DevHub görevlerinizin son tarihleridir.
      </p>
    </>
  );
}

/** Günün içindeki görev teslimi: yalnızca bilgi; tıklayınca görev açılır. Yüksek öncelikli/gecikmiş görev renkli, iş büyüklüğü yazılı. */
function TaskHint({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const u = taskUrgency(task);
  const tone = u.overdue ? 'border-danger-line bg-danger-soft text-danger-ink'
    : u.high ? 'border-clay-line bg-clay-soft/70 text-clay-ink'
      : 'border-theme-medium/60 text-theme-muted hover:text-theme-text hover:border-theme-medium';
  return (
    <button type="button" onClick={onOpen} title={`Görev: ${task.content}`}
      className={`w-full flex items-start gap-1.5 px-2 py-1.5 rounded-lg border border-dashed text-left text-[0.6875rem] font-medium transition-colors ${tone}`}>
      <CheckSquare size={13} weight="bold" className="shrink-0 mt-px" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words"><span className="sr-only">Görev: </span>{task.content}</span>
        {(task.estimatedMinutes || u.high) && (
          <span className="block mt-0.5 tabular opacity-90">
            {task.estimatedMinutes ? `${formatEstimate(task.estimatedMinutes)} iş` : ''}{u.high ? `${task.estimatedMinutes ? ' · ' : ''}yüksek öncelik` : ''}
          </span>
        )}
      </span>
    </button>
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
      className={`flex items-start gap-1.5 rounded-lg border ${item.taskId !== null ? '' : 'bg-surface'} px-1.5 py-1.5 cursor-grab active:cursor-grabbing transition-[border-color,opacity,background-color] ${
        selected ? 'border-accent bg-accent/[0.05]' : item.taskId !== null ? TASK_CARD_SURFACE : 'border-theme-light hover:border-theme-dark/30'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <span className="mt-px"><DoneToggle size="sm" square={item.taskId !== null} done={item.done} onToggle={() => update.mutate({ id: item.id, done: !item.done })} label={item.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} /></span>
      <button type="button" onClick={onSelect} aria-expanded={selected} className="min-w-0 flex-1 text-left rounded-md">
        <span className={`block text-[0.8125rem] font-medium leading-snug break-words line-clamp-3 ${item.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{item.title}</span>
        {(item.dueTime || item.repeatRule || item.important || item.taskId !== null) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[0.6875rem] text-theme-muted">
            {item.taskId !== null && <TaskChip taskId={item.taskId} size="sm" />}
            {item.dueTime && <span className="inline-flex items-center gap-0.5 tabular"><Bell size={11} weight="bold" aria-hidden="true" /> {item.dueTime}</span>}
            {item.repeatRule && <Repeat size={11} weight="bold" aria-label="Tekrarlanır" />}
            {item.important && <Star size={11} weight="fill" className="text-warn" aria-label="Önemli" />}
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * Günün altındaki hızlı ekleme: yazıp Enter'a basınca kart o güne (day null ise tarihsiz olarak) eklenir.
 * Gün kutularında yalnızca üzerine gelince/odaklanınca görünür (dokunmatik ekranda hep görünür), pano sakin kalsın.
 */
function DayAdd({ day, label, placeholder = 'Ekle', always = false }: { day: string | null; label: string; placeholder?: string; always?: boolean }) {
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
    <form onSubmit={submit} className={`flex items-center gap-1.5 mt-1 px-2 py-1.5 rounded-lg text-theme-muted focus-within:bg-theme-lightest focus-within:text-theme-deep hover:bg-theme-lightest transition-[opacity,background-color] ${
      always || draft ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'
    }`}>
      <Plus size={13} weight="bold" className="shrink-0" aria-hidden="true" />
      <input value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} placeholder={placeholder} aria-label={label}
        className="flex-1 min-w-0 bg-transparent text-xs text-theme-text placeholder:text-theme-muted focus:outline-none" />
    </form>
  );
}
