import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from 'framer-motion';
import {
  House, Plus, MagnifyingGlass, CaretDown, DotsThree, DotsSixVertical, PencilSimple, Trash, Broom, CloudCheck, CircleNotch, Check, ListChecks,
  Users, UserPlus, SignOut,
} from '@phosphor-icons/react';
import { Menu, MenuItem, MenuDivider, MenuLabel } from '../ui/Menu';
import { Skeleton } from '../ui/primitives';
import TodoCard from './TodoCard';
import TodoDetail from './TodoDetail';
import SendTodoModal from './SendTodoModal';
import WeekPlan from './WeekPlan';
import TasksPane from './TasksPane';
import ListMembersModal from './ListMembersModal';
import { buildViews, canDeleteCard, groupByDue, listIdOf, LIST_COLORS } from './views';
import type { ViewDef, ViewId } from './views';
import {
  useTodos, useTodoSaving, useCreateTodo, useUpdateTodo, useReorderTodos, useClearCompleted,
  useCreateTodoList, useUpdateTodoList, useDeleteTodoList,
} from '../../hooks/todos';
import { useMe, useUserTasks } from '../../hooks/api';
import { firstName, formatLongDate, toIsoDay, trLower } from '../../lib/format';
import type { TodoItem, TodoList } from '../../types';

const VIEW_KEY = 'devhub.todo.view';
const EASE = [0.65, 0, 0.35, 1] as const;
/** Ev düğmesinin ekrandaki yaklaşık merkezi: kapanış dairesi buraya toplanır. */
const HOME = { x: 52, y: 48 };

function readView(): ViewId {
  try { return (localStorage.getItem(VIEW_KEY) as ViewId) || 'today'; } catch { return 'today'; }
}

interface Props {
  /** Açılış dairesinin merkezi (menüdeki düğmenin konumu) */
  origin?: { x: number; y: number };
  onHome: () => void;
}

/**
 * Kişisel alan: tam ekran yapılacaklar. Uygulamanın üstünde bir katman olarak açılır (menü ve üst bar görünmez);
 * sol üstteki ev düğmesi kullanıcıyı kaldığı sayfaya geri götürür. Her değişiklik anında kaydedilir.
 */
export default function TodoSpace({ origin, onHome }: Props) {
  const reduce = useReducedMotion();
  const o = origin ?? { x: 60, y: 130 };
  const radius = (c: { x: number; y: number }) => Math.hypot(Math.max(c.x, window.innerWidth - c.x), Math.max(c.y, window.innerHeight - c.y)) + 60;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-theme-cream"
      role="region"
      aria-label="Kişisel alan: yapılacaklar"
      initial={reduce ? { opacity: 0 } : { clipPath: `circle(0px at ${o.x}px ${o.y}px)` }}
      animate={reduce
        ? { opacity: 1 }
        : { clipPath: `circle(${radius(o)}px at ${o.x}px ${o.y}px)`, transition: { duration: 0.7, ease: EASE }, transitionEnd: { clipPath: 'none' } }}
      exit={reduce
        ? { opacity: 0 }
        : { clipPath: [`circle(${radius(HOME)}px at ${HOME.x}px ${HOME.y}px)`, `circle(0px at ${HOME.x}px ${HOME.y}px)`], transition: { duration: 0.5, ease: EASE } }}
    >
      <Space onHome={onHome} />
    </motion.div>
  );
}

function Space({ onHome }: { onHome: () => void }) {
  const me = useMe();
  const { data, isLoading } = useTodos();
  const saving = useTodoSaving();
  const update = useUpdateTodo();
  const { data: myTasks } = useUserTasks(me.id);
  const [params, setParams] = useSearchParams();

  const [view, setViewState] = useState<ViewId>(readView);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<TodoItem | null>(null);

  const now = new Date();
  const today = toIsoDay(now);
  const lists = useMemo(() => data?.lists ?? [], [data]);
  const items = useMemo(() => data?.items ?? [], [data]);
  const { smart, own } = useMemo(() => buildViews(lists, today), [lists, today]);
  const all = [...smart, ...own];
  const current = all.find(v => v.id === view) ?? smart[0];
  const selected = items.find(i => i.id === selectedId) ?? null;

  const setView = (id: ViewId) => {
    setViewState(id);
    setSearch('');
    try { localStorage.setItem(VIEW_KEY, id); } catch { /* depolama kapalı olabilir */ }
  };

  const select = (item: TodoItem | null) => {
    setSelectedId(item?.id ?? null);
    if (item && !item.seen) update.mutate({ id: item.id, seen: true });
  };

  // Bildirimdeki "?item=ID" bağlantısı: kartı açar, parametreyi adresten temizler.
  const linked = params.get('item');
  useEffect(() => {
    if (!linked || !data) return;
    const item = data.items.find(i => i.id === Number(linked));
    if (item) {
      setViewState(item.sentById !== null ? 'inbox' : item.listId === null ? 'general' : `list-${item.listId}`);
      setSelectedId(item.id);
      if (!item.seen) update.mutate({ id: item.id, seen: true });
    }
    setParams(p => { p.delete('item'); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, data]);

  // Bildirimdeki "?list=ID" bağlantısı (bir listeye eklendiniz): o listeyi açar.
  const linkedList = params.get('list');
  useEffect(() => {
    if (!linkedList || !data) return;
    if (data.lists.some(l => l.id === Number(linkedList))) setViewState(`list-${Number(linkedList)}`);
    setParams(p => { p.delete('list'); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedList, data]);

  // Esc: önce ayrıntı panelini kapatır (açık bir pencere/menü varsa onlar kendi Esc'ini işler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) return;
      setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<ViewId, number>();
    all.forEach(v => m.set(v.id, items.filter(i => !i.done && v.matches(i)).length));
    m.set('tasks', (myTasks ?? []).filter(t => t.status !== 'TAMAMLANDI').length);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, smart, own, myTasks]);
  const pane = search.trim() ? undefined : current.pane;
  // Haftalık plan tüm genişliği kullanır: kart ayrıntısı yanına yerleşmek yerine üstünde açılır.
  const overlayDetail = pane === 'week';
  const unseen = items.filter(i => !i.seen).length;

  return (
    <div className="h-full flex">
      {/* Sol: görünümler ve listeler */}
      {/* Başlık satırı uygulamanın kenar çubuğundaki logo satırıyla aynı ölçülerde: ev karosu iki ekranda da aynı yerde durur. */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-white border-r border-theme-light/50 p-5">
        <div className="flex items-center gap-3 px-3 mb-8 mt-2 h-10">
          <HomeButton onHome={onHome} />
          <div className="min-w-0">
            <p className="text-xl font-bold tracking-tight text-theme-text leading-none">Yapılacaklarım</p>
            <p className="text-[11px] font-semibold text-theme-muted truncate mt-1 leading-none">{firstName(me.fullName)} · kişisel alan</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 flex flex-col">
          <Rail smart={smart} own={own} view={current.id} counts={counts} unseen={unseen} onPick={setView} />
        </motion.div>
      </aside>

      {/* Orta: kartlar */}
      <motion.main
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 min-w-0 flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 sm:px-8 h-[72px] shrink-0">
          <div className="lg:hidden"><HomeButton onHome={onHome} /></div>
          <select aria-label="Görünüm" value={current.id} onChange={e => setView(e.target.value as ViewId)} className="lg:hidden input py-2.5 flex-1 min-w-0">
            {all.map(v => <option key={v.id} value={v.id}>{v.label}{counts.get(v.id) ? ` (${counts.get(v.id)})` : ''}</option>)}
          </select>
          <div className="relative hidden sm:block flex-1 max-w-sm lg:ml-0">
            <MagnifyingGlass size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tüm kartlarda ara…" aria-label="Kartlarda ara"
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-theme-light/60 text-sm font-medium shadow-soft focus:outline-none focus:ring-2 focus:ring-theme-medium" />
          </div>
          <SaveStatus saving={saving} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-4 sm:px-8 pb-10">
          <div className={pane === 'week' ? 'max-w-[1400px] mx-auto' : 'max-w-3xl mx-auto'}>
            {isLoading || !data ? (
              <div className="space-y-3 pt-6"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-14 rounded-3xl" /><Skeleton className="h-16 rounded-3xl" /><Skeleton className="h-16 rounded-3xl" /></div>
            ) : pane === 'week' ? (
              <WeekPlan items={items} now={now} selectedId={selectedId} onSelect={select} onSend={setSending} />
            ) : pane === 'tasks' ? (
              <TasksPane items={items} onSelect={select} />
            ) : (
              <ItemsPane
                key={search.trim() ? 'search' : current.id}
                view={current}
                items={items}
                lists={lists}
                search={search}
                now={now}
                selectedId={selectedId}
                onSelect={select}
                onSend={setSending}
                onViewGone={() => setView('general')}
              />
            )}
          </div>
        </div>
      </motion.main>

      {/* Sağ: kart ayrıntısı (dar ekranda üstte açılan çekmece) */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)} className={`${overlayDetail ? '' : 'xl:hidden'} fixed inset-0 z-[101] bg-theme-text/25 backdrop-blur-sm`} />
            <motion.aside
              key="detail"
              aria-label="Kart ayrıntısı"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 34 } }}
              exit={{ x: 40, opacity: 0, transition: { duration: 0.15 } }}
              className={`fixed inset-y-0 right-0 z-[102] w-full max-w-md shrink-0 bg-theme-cream border-l border-theme-light/50 shadow-2xl ${overlayDetail ? '' : 'xl:static xl:w-[400px] xl:max-w-none xl:shadow-none'}`}
            >
              <TodoDetail key={selected.id} item={selected} lists={lists} onClose={() => setSelectedId(null)} onSend={() => setSending(selected)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <SendTodoModal item={sending} onClose={() => setSending(null)} />
    </div>
  );
}

function HomeButton({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" onClick={onHome} className="w-10 h-10 shrink-0 rounded-2xl bg-theme-deep text-white flex items-center justify-center shadow-soft hover:bg-theme-text transition-colors" aria-label="DevHub'a dön" title="DevHub'a dön">
      <House size={20} weight="fill" />
    </button>
  );
}

/** Kayıt durumu: kullanıcı "kaydet"e basmaz; yazılanın kaydedildiğini buradan görür. */
function SaveStatus({ saving }: { saving: boolean }) {
  return (
    <p className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-theme-muted whitespace-nowrap" role="status" aria-live="polite">
      {saving
        ? <><CircleNotch size={15} weight="bold" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Kaydediliyor…</>
        : <><CloudCheck size={16} weight="bold" className="text-theme-deep" aria-hidden="true" /> Kaydedildi</>}
    </p>
  );
}

// ---------------- Sol ray ----------------

function Rail({ smart, own, view, counts, unseen, onPick }: {
  smart: ViewDef[]; own: ViewDef[]; view: ViewId; counts: Map<ViewId, number>; unseen: number; onPick: (v: ViewId) => void;
}) {
  const create = useCreateTodoList();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const submitted = useRef(false);

  // Enter ve odağın kaybı aynı işlevi çağırır; liste iki kez oluşmasın diye tek seferlik kilit.
  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    const v = name.trim();
    if (!v) { setAdding(false); return; }
    create.mutate({ name: v, color: LIST_COLORS[own.length % LIST_COLORS.length] }, { onSuccess: list => onPick(`list-${list.id}`) });
    setName('');
    setAdding(false);
  };

  const row = (v: ViewDef) => {
    const active = v.id === view;
    const count = counts.get(v.id) ?? 0;
    return (
      <li key={v.id}>
        <button type="button" onClick={() => onPick(v.id)} aria-current={active ? 'page' : undefined}
          className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-colors ${active ? 'text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-theme-lightest/50'}`}>
          {active && <motion.span layoutId="todo-rail-active" className="absolute inset-0 bg-theme-lightest rounded-2xl" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
          {v.color !== undefined
            ? <span className="relative w-5 flex justify-center"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color ?? '#C5D89D' }} aria-hidden="true" /></span>
            : <v.icon size={20} weight={active ? 'fill' : 'duotone'} className="relative" aria-hidden="true" />}
          <span className="relative flex-1 min-w-0 flex items-center gap-1.5">
            <span className="truncate">{v.label}</span>
            {v.list && v.list.members.length > 1 && <Users size={14} weight="bold" className="shrink-0 text-theme-medium" aria-label="Ortak liste" />}
          </span>
          {v.id === 'inbox' && unseen > 0
            ? <span className="relative text-[11px] font-bold tabular min-w-[20px] h-5 px-1.5 rounded-full bg-[#9A3B1B] text-white flex items-center justify-center" aria-label={`${unseen} yeni`}>{unseen}</span>
            : count > 0 && <span className="relative text-xs font-bold tabular text-theme-muted">{count}</span>}
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Görünümler ve listeler" className="flex-1 min-h-0 overflow-y-auto scrollbar-hover -mx-2 px-2">
      <ul className="space-y-0.5">{smart.map(row)}</ul>
      <p className="eyebrow px-3.5 mt-7 mb-2">Listelerim</p>
      <ul className="space-y-0.5">{own.map(row)}</ul>
      {adding ? (
        <form onSubmit={submit} className="mt-1 px-1">
          <input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={submit}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setName(''); setAdding(false); } }}
            placeholder="Liste adı" aria-label="Yeni liste adı"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-theme-cream border border-theme-light text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-theme-medium" />
        </form>
      ) : (
        <button type="button" onClick={() => { submitted.current = false; setAdding(true); }} className="mt-1 w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-theme-deep hover:bg-theme-lightest/50 transition-colors">
          <Plus size={18} weight="bold" aria-hidden="true" /> Yeni liste
        </button>
      )}
    </nav>
  );
}

// ---------------- Orta bölme ----------------

function ItemsPane({ view, items, lists, search, now, selectedId, onSelect, onSend, onViewGone }: {
  view: ViewDef; items: TodoItem[]; lists: TodoList[]; search: string; now: Date;
  selectedId: number | null; onSelect: (i: TodoItem | null) => void; onSend: (i: TodoItem) => void; onViewGone: () => void;
}) {
  const me = useMe();
  const create = useCreateTodo();
  const reorder = useReorderTodos();
  const clear = useClearCompleted();
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [order, setOrder] = useState<number[] | null>(null);
  const orderRef = useRef<number[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = trLower(search.trim());
  const searching = q.length > 0;
  const listName = (i: TodoItem) => (i.listId === null ? 'Genel' : lists.find(l => l.id === i.listId)?.name ?? '');
  const smartView = !view.reorderable;

  const matching = useMemo(() => {
    const base = searching
      ? items.filter(i => trLower(`${i.title} ${i.note ?? ''} ${i.steps.map(s => s.title).join(' ')}`).includes(q))
      : items.filter(view.matches);
    return [...base].sort((a, b) => a.position - b.position || b.id - a.id);
  }, [items, view, q, searching]);

  const open = matching.filter(i => !i.done);
  const done = matching.filter(i => i.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const ordered = order ? order.map(id => open.find(i => i.id === id)).filter((i): i is TodoItem => !!i) : open;
  const canReorder = view.reorderable && !searching && open.length > 1;
  // Ortak listede üye yalnızca kendi eklediği tamamlanmış kartları temizleyebilir.
  const clearable = done.filter(d => canDeleteCard(d, lists, me.id));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title, ...view.defaults });
    setDraft('');
    inputRef.current?.focus();
  };

  const card = (i: TodoItem, handle?: React.ReactNode) => (
    <TodoCard
      item={i}
      selected={i.id === selectedId}
      listName={smartView || searching ? listName(i) : undefined}
      ownerLabel={i.ownerId !== me.id ? firstName(i.ownerName) : undefined}
      onSelect={() => onSelect(i.id === selectedId ? null : i)}
      onSend={() => onSend(i)}
      handle={handle}
    />
  );

  return (
    <>
      <Header view={view} searching={searching} search={search} openCount={open.length} doneCount={done.length} now={now}
        clearCount={clearable.length} onClear={() => clear.mutate(clearable.map(d => d.id))} onDeleted={onViewGone} />

      {!searching && (
        <form onSubmit={add} className="flex items-center gap-3 rounded-3xl bg-white border border-theme-light/60 shadow-soft pl-4 pr-2 py-2 mb-5 focus-within:border-theme-medium focus-within:ring-2 focus-within:ring-theme-light/60 transition-shadow">
          <Plus size={20} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={draft}
            maxLength={300}
            onChange={e => setDraft(e.target.value)}
            placeholder={view.id === 'today' ? 'Bugün ne yapacaksınız?' : 'Yeni kart ekle…'}
            aria-label="Yeni kart"
            className="flex-1 min-w-0 bg-transparent py-2 text-[15px] font-medium text-theme-text placeholder:text-theme-muted focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} className="btn-primary min-h-[40px] px-4 text-sm disabled:opacity-0 disabled:pointer-events-none transition-opacity">Ekle</button>
        </form>
      )}

      {open.length === 0 && done.length === 0 ? (
        <div className="text-center py-16">
          <span className="inline-flex w-16 h-16 rounded-3xl bg-theme-lightest text-theme-deep items-center justify-center mb-4"><ListChecks size={30} weight="duotone" aria-hidden="true" /></span>
          <p className="text-lg font-bold text-theme-text">{searching ? 'Eşleşen kart yok' : view.empty.title}</p>
          <p className="text-sm text-theme-muted font-medium mt-1 max-w-sm mx-auto">{searching ? 'Başka bir kelime deneyin.' : view.empty.text}</p>
        </div>
      ) : view.id === 'planned' && !searching ? (
        <div className="space-y-6">
          {groupByDue(open, now).map(g => (
            <section key={g.label} aria-label={g.label}>
              <h3 className={`eyebrow mb-2 ${g.tone === 'danger' ? 'text-[#9A3B1B]' : ''}`}>{g.label} <span className="tabular">({g.items.length})</span></h3>
              <ul className="space-y-2.5">{g.items.map(i => <li key={i.id}>{card(i)}</li>)}</ul>
            </section>
          ))}
        </div>
      ) : canReorder ? (
        <Reorder.Group axis="y" as="ul" values={ordered.map(i => i.id)} onReorder={ids => { orderRef.current = ids; setOrder(ids); }} className="space-y-2.5">
          {ordered.map(i => (
            <DraggableRow key={i.id} id={i.id} onDrop={() => { if (orderRef.current) reorder.mutate(orderRef.current); orderRef.current = null; setOrder(null); }}>
              {handle => card(i, handle)}
            </DraggableRow>
          ))}
        </Reorder.Group>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {open.map(i => (
              <motion.li key={i.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}>
                {card(i)}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowDone(s => !s)} aria-expanded={showDone} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-theme-deep hover:bg-theme-lightest/60 transition-colors">
            <CaretDown size={14} weight="bold" className={`transition-transform ${showDone ? '' : '-rotate-90'}`} aria-hidden="true" />
            Tamamlananlar <span className="tabular text-theme-muted">{done.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2.5 overflow-hidden pt-2">
                {done.map(i => <li key={i.id}>{card(i)}</li>)}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

/** Sürüklenebilir satır: yalnızca tutamaçtan sürüklenir, böylece karta tıklamak ayrıntıyı açmaya devam eder. */
function DraggableRow({ id, onDrop, children }: { id: number; onDrop: () => void; children: (handle: React.ReactNode) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} as="li" dragListener={false} dragControls={controls} onDragEnd={onDrop} className="relative" whileDrag={{ scale: 1.02, zIndex: 5 }}>
      {children(
        <button
          type="button"
          onPointerDown={e => controls.start(e)}
          className="touch-none cursor-grab active:cursor-grabbing text-theme-medium hover:text-theme-deep opacity-0 group-hover:opacity-100 focus:opacity-100 -ml-1 -mr-1.5 rounded-lg"
          aria-label="Sürükleyerek sırala"
          title="Sürükleyerek sırala"
        >
          <DotsSixVertical size={18} weight="bold" />
        </button>,
      )}
    </Reorder.Item>
  );
}

function Header({ view, searching, search, openCount, doneCount, clearCount, now, onClear, onDeleted }: {
  view: ViewDef; searching: boolean; search: string; openCount: number; doneCount: number; clearCount: number; now: Date; onClear: () => void; onDeleted: () => void;
}) {
  const updateList = useUpdateTodoList();
  const deleteList = useDeleteTodoList();
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(view.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const listId = listIdOf(view.id);
  const list = view.list;
  // Liste yöneticisi: adı, rengi, üyeleri ve silmeyi yönetir. Üye yalnızca kart işlemleri yapar ve ayrılabilir.
  const listAdmin = list?.myRole === 'ADMIN';
  const shared = !!list && list.members.length > 1;
  const total = openCount + doneCount;

  const rename = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const v = name.trim();
    if (listId !== null && v && v !== view.label) updateList.mutate({ id: listId, name: v });
    setRenaming(false);
  };

  return (
    <header className="pt-4 pb-5">
      <div className="flex items-center gap-3">
        {renaming ? (
          <form onSubmit={rename} className="flex-1 min-w-0">
            <input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={rename}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); } }}
              aria-label="Liste adı" className="input text-2xl font-bold py-2" />
          </form>
        ) : (
          <h1 className="flex-1 min-w-0 text-3xl sm:text-4xl font-bold tracking-tight text-theme-text truncate flex items-center gap-3">
            {view.color !== undefined && view.color !== null && <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: view.color }} aria-hidden="true" />}
            <span className="truncate">{searching ? 'Arama sonuçları' : view.label}</span>
          </h1>
        )}
        {!searching && list && (shared || listAdmin) && (
          <button type="button" onClick={() => setMembersOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-white border border-theme-light/60 text-sm font-bold text-theme-deep hover:bg-theme-lightest transition-colors"
            aria-label={shared ? `Üyeler (${list.members.length})` : 'Listeyi paylaş'}>
            {shared ? <><Users size={17} weight="bold" aria-hidden="true" /> <span className="tabular">{list.members.length}</span></> : <><UserPlus size={17} weight="bold" aria-hidden="true" /> Paylaş</>}
          </button>
        )}
        {!searching && (clearCount > 0 || listId !== null) && (
          <>
            <button ref={setAnchor} type="button" onClick={() => setMenuOpen(o => !o)} className="icon-btn shrink-0" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Liste işlemleri">
              <DotsThree size={22} weight="bold" />
            </button>
            <Menu open={menuOpen} onClose={() => { setMenuOpen(false); setConfirmDelete(false); }} anchor={anchor} label="Liste işlemleri" width={240}>
              {listId !== null && <MenuItem icon={Users} onSelect={() => { setMenuOpen(false); setMembersOpen(true); }}>Üyeler ve paylaşım</MenuItem>}
              {listId !== null && listAdmin && <>
                <MenuItem icon={PencilSimple} onSelect={() => { setMenuOpen(false); setName(view.label); setRenaming(true); }}>Yeniden adlandır</MenuItem>
                <MenuLabel>Renk</MenuLabel>
                <div className="flex gap-2 px-3 pb-2">
                  {LIST_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => updateList.mutate({ id: listId, color: c })} aria-label={`Renk ${c}`} aria-pressed={view.color === c}
                      className="w-6 h-6 rounded-full flex items-center justify-center ring-offset-2 ring-offset-white focus-visible:ring-2 ring-theme-deep" style={{ backgroundColor: c }}>
                      {view.color === c && <Check size={12} weight="bold" className="text-theme-text" />}
                    </button>
                  ))}
                </div>
              </>}
              {listId !== null && <MenuDivider />}
              {clearCount > 0 && <MenuItem icon={Broom} onSelect={() => { setMenuOpen(false); onClear(); }}>Tamamlananları temizle ({clearCount})</MenuItem>}
              {listId !== null && listAdmin && (
                confirmDelete
                  ? <MenuItem icon={Trash} tone="danger" onSelect={() => { setMenuOpen(false); deleteList.mutate(listId); onDeleted(); }}>Evet, {shared ? 'herkes için ' : ''}{total ? `${total} kartla birlikte ` : ''}sil</MenuItem>
                  : <MenuItem icon={Trash} tone="danger" onSelect={() => setConfirmDelete(true)}>Listeyi sil…</MenuItem>
              )}
              {listId !== null && !listAdmin && <MenuItem icon={SignOut} tone="danger" onSelect={() => { setMenuOpen(false); setMembersOpen(true); }}>Listeden ayrıl…</MenuItem>}
            </Menu>
          </>
        )}
      </div>
      <p className="text-sm font-semibold text-theme-muted mt-1.5">
        {searching
          ? <>“{search.trim()}” için {total} kart</>
          : view.id === 'today'
            ? <>{formatLongDate(now)} · {openCount ? `${openCount} kart sizi bekliyor` : 'her şey tamam'}</>
            : <>{openCount} açık{doneCount ? ` · ${doneCount} tamamlandı` : ''}{shared ? ` · ortak liste, ${list.members.length} üye` : ''}</>}
      </p>
      {!searching && total > 0 && (
        <div className="h-1.5 rounded-full bg-white border border-theme-light/40 overflow-hidden mt-3" role="progressbar" aria-valuenow={Math.round((doneCount / total) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Tamamlanma oranı">
          <motion.div className="h-full rounded-full bg-theme-deep" animate={{ width: `${(doneCount / total) * 100}%` }} transition={{ type: 'spring', stiffness: 220, damping: 30 }} />
        </div>
      )}
      <ListMembersModal list={membersOpen && list ? list : null} onClose={() => setMembersOpen(false)} onLeft={onDeleted} />
    </header>
  );
}
