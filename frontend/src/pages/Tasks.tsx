import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  Plus, MagnifyingGlass, CaretLeft, CaretRight, CaretDown, CalendarBlank, Kanban, Trash, ChatCircleText, TextAlignLeft, Rows, SquaresFour,
} from '@phosphor-icons/react';
import { PageHeader, Segmented, Skeleton, Avatar, PriorityBadge, EmptyState, ProgressBar } from '../components/ui/primitives';
import { useAllTasks, useUsers, useMe, useUpdateTask, useDeleteTask, useProjects } from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import { TASK_STATUS, TASK_STATUSES, TASK_PRIORITY, TASK_PRIORITIES, projectColor } from '../lib/meta';
import { dueLabel, firstName, trLower } from '../lib/format';
import type { Project, Task, TaskPriority, TaskStatus, User } from '../types';

type Scope = 'MINE' | 'ALL';
type View = 'BOARD' | 'LIST';
type GroupBy = 'PERSON' | 'PROJECT';
/** Proje filtresi: '' = hepsi, 'none' = projesiz, diğerleri proje id'si */
const NO_PROJECT = 'none';

const VIEW_KEY = 'devhub.tasks.view';
function readPref<T extends string>(key: string, fallback: T, allowed: T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch { return fallback; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* tarayıcı depolaması kapalı olabilir */ }
}

const byPriorityThenDue = (a: Task, b: Task) =>
  TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank ||
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

export default function Tasks() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const actions = useQuickActions();
  const { data: tasks, isLoading } = useAllTasks();
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const update = useUpdateTask();

  const [scope, setScope] = useState<Scope>(isAdmin ? 'ALL' : 'MINE');
  const [view, setView] = useState<View>(() => readPref<View>(VIEW_KEY, 'BOARD', ['BOARD', 'LIST']));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => readPref<GroupBy>(`${VIEW_KEY}.group`, 'PROJECT', ['PERSON', 'PROJECT']));
  const [priority, setPriority] = useState<'ALL' | TaskPriority>('ALL');
  const [person, setPerson] = useState('');
  const [project, setProject] = useState('');
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const userById = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users]);
  const projectById = useMemo(() => new Map((projects ?? []).map(p => [p.id, p])), [projects]);

  const visible = useMemo(() => {
    const q = trLower(search.trim());
    return (tasks ?? []).filter(t =>
      (scope === 'ALL' || t.userId === me.id) &&
      (priority === 'ALL' || (t.priority ?? 'ORTA') === priority) &&
      (!person || t.userId === Number(person)) &&
      (!project || (project === NO_PROJECT ? !t.projectId : t.projectId === Number(project))) &&
      (!q || trLower(`${t.content} ${t.description ?? ''} ${userById.get(t.userId)?.fullName ?? ''}`).includes(q)),
    );
  }, [tasks, scope, priority, person, project, search, me.id, userById]);

  const columns = useMemo(() => {
    const byCol: Record<TaskStatus, Task[]> = { YAPILACAK: [], DEVAM: [], TAMAMLANDI: [] };
    visible.forEach(t => byCol[t.status ?? 'YAPILACAK'].push(t));
    (Object.keys(byCol) as TaskStatus[]).forEach(k => byCol[k].sort(byPriorityThenDue));
    return byCol;
  }, [visible]);

  const canEdit = (t: Task) => isAdmin || t.userId === me.id;

  const move = (task: Task, status: TaskStatus) => {
    if (!canEdit(task) || (task.status ?? 'YAPILACAK') === status) return;
    update.mutate({ id: task.id, status });
  };

  const changeView = (v: View) => { setView(v); writePref(VIEW_KEY, v); };
  const changeGroup = (g: GroupBy) => { setGroupBy(g); writePref(`${VIEW_KEY}.group`, g); };

  const mineCount = tasks?.filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI').length ?? 0;
  const filtered = !!(priority !== 'ALL' || person || project || search.trim());
  const newTaskForFilter = () => actions.newTask(person ? Number(person) : undefined, project && project !== NO_PROJECT ? Number(project) : undefined);

  return (
    <>
      <PageHeader
        eyebrow="Görevler"
        title="Görev Panosu"
        description="Bir göreve tıklayarak ayrıntısını, geçmişini ve yorumlarını açın. Kartları sütunlar arasında sürükleyebilir veya oklarla taşıyabilirsiniz."
        actions={<>
          <Segmented<View>
            label="Görünüm"
            layoutId="task-view"
            value={view}
            onChange={changeView}
            options={[{ value: 'BOARD', label: 'Pano' }, { value: 'LIST', label: 'Liste' }]}
          />
          <button onClick={newTaskForFilter} className="btn-primary"><Plus size={18} weight="bold" /> {isAdmin ? 'Görev Ata' : 'Görev Ekle'}</button>
        </>}
      />

      <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-center">
        <Segmented<Scope>
          label="Kapsam"
          layoutId="task-scope"
          value={scope}
          onChange={setScope}
          options={[{ value: 'MINE', label: 'Benim', count: mineCount }, { value: 'ALL', label: 'Tüm ekip' }]}
        />
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} aria-hidden="true" />
          <input type="search" aria-label="Görevlerde ara" placeholder="Görev, açıklama veya kişi ara…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-11 shadow-soft" />
        </div>
        <select aria-label="Projeye göre filtrele" value={project} onChange={e => setProject(e.target.value)} className="input lg:w-48 shadow-soft">
          <option value="">Tüm projeler</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value={NO_PROJECT}>Projesiz</option>
        </select>
        {scope === 'ALL' && (
          <select aria-label="Kişiye göre filtrele" value={person} onChange={e => setPerson(e.target.value)} className="input lg:w-44 shadow-soft">
            <option value="">Herkes</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        )}
        <select aria-label="Önceliğe göre filtrele" value={priority} onChange={e => setPriority(e.target.value as 'ALL' | TaskPriority)} className="input lg:w-40 shadow-soft">
          <option value="ALL">Tüm öncelikler</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-96 rounded-4xl" />)}</div>
      ) : (tasks ?? []).length === 0 ? (
        <EmptyState icon={Kanban} title="Henüz görev yok" description="İlk görevi ekleyerek panoyu başlatın." action={<button onClick={() => actions.newTask()} className="btn-primary">Görev ekle</button>} />
      ) : view === 'LIST' ? (
        <ListView
          tasks={visible}
          groupBy={groupBy}
          onGroupBy={changeGroup}
          userById={userById}
          projectById={projectById}
          filtered={filtered}
          onOpen={actions.openTask}
          onNew={(userId, projectId) => actions.newTask(userId, projectId)}
          canAssign={isAdmin}
        />
      ) : (
        <LayoutGroup>
          <div className="grid md:grid-cols-3 gap-5 pb-10 items-start">
            {TASK_STATUSES.map(col => {
              const meta = TASK_STATUS[col];
              const list = columns[col];
              const isOver = overCol === col && dragId !== null;
              return (
                <section
                  key={col}
                  aria-label={meta.label}
                  onDragOver={e => { if (dragId !== null) { e.preventDefault(); setOverCol(col); } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    const t = tasks?.find(x => x.id === dragId);
                    if (t) move(t, col);
                    setDragId(null); setOverCol(null);
                  }}
                  className={`rounded-4xl p-4 border-2 transition-colors min-h-[240px] ${isOver ? 'border-theme-deep bg-theme-lightest/70' : 'border-transparent bg-white/60'}`}
                >
                  <header className="flex items-center justify-between px-2 pt-1 pb-4">
                    <h2 className={`flex items-center gap-2 text-sm font-bold ${meta.className}`}>
                      <meta.icon size={18} weight="bold" aria-hidden="true" />
                      <span className="text-theme-text">{meta.label}</span>
                    </h2>
                    <span className="text-xs font-bold tabular bg-white border border-theme-light/60 text-theme-deep px-2 py-0.5 rounded-lg">{list.length}</span>
                  </header>
                  <div className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {list.map(t => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          owner={userById.get(t.userId)}
                          project={t.projectId ? projectById.get(t.projectId) : undefined}
                          editable={canEdit(t)}
                          dragging={dragId === t.id}
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => { setDragId(null); setOverCol(null); }}
                          onMove={s => move(t, s)}
                          onOpen={() => actions.openTask(t.id)}
                        />
                      ))}
                    </AnimatePresence>
                    {list.length === 0 && (
                      <p className="text-sm text-theme-muted font-medium text-center py-8 border-2 border-dashed border-theme-light/60 rounded-3xl">
                        {isOver ? 'Buraya bırakın' : 'Görev yok'}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </LayoutGroup>
      )}
    </>
  );
}

/** Kartta ve satırda görevin küçük göstergeleri: açıklama var mı, kaç yorum var. */
function TaskHints({ task }: { task: Task }) {
  const comments = task.commentCount ?? 0;
  if (!task.description && !comments) return null;
  return (
    <span className="inline-flex items-center gap-2 text-theme-muted">
      {task.description && <TextAlignLeft size={14} weight="bold" aria-label="Açıklaması var" />}
      {comments > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular" aria-label={`${comments} yorum`}>
          <ChatCircleText size={14} weight="bold" aria-hidden="true" /> {comments}
        </span>
      )}
    </span>
  );
}

function DueText({ task }: { task: Task }) {
  const due = task.dueDate && task.status !== 'TAMAMLANDI' ? dueLabel(task.dueDate) : null;
  if (!due) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ${due.tone === 'danger' ? 'text-[#9A3B1B]' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}`}>
      <CalendarBlank size={12} weight="bold" aria-hidden="true" /> {due.text}
    </span>
  );
}

interface TaskCardProps {
  task: Task;
  owner?: User;
  project?: Project;
  editable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (s: TaskStatus) => void;
  onOpen: () => void;
}

function TaskCard({ task, owner, project, editable, dragging, onDragStart, onDragEnd, onMove, onOpen }: TaskCardProps) {
  const remove = useDeleteTask();
  const status = task.status ?? 'YAPILACAK';
  const idx = TASK_STATUSES.indexOf(status);
  const done = status === 'TAMAMLANDI';

  return (
    <motion.div
      layout
      layoutId={`task-${task.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: dragging ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 } }}
    >
      <div
        draggable={editable}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
        onDragEnd={onDragEnd}
        onClick={e => { if (!(e.target as HTMLElement).closest('button')) onOpen(); }}
        className={`group bg-white rounded-3xl p-4 border border-theme-light/50 shadow-soft hover:shadow-diffusion hover:border-theme-light transition-[box-shadow,border-color] ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2.5">
          {task.priority && !done ? <PriorityBadge priority={task.priority} /> : <span />}
          {editable && (
            <button onClick={() => remove.mutate(task.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 icon-btn w-8 h-8 -mt-1 -mr-1 hover:text-[#9A3B1B] hover:bg-[#FBEDE5] transition-opacity" aria-label="Görevi sil">
              <Trash size={15} weight="bold" />
            </button>
          )}
        </div>
        <button type="button" onClick={onOpen} className="block w-full text-left rounded-lg" aria-label={`${task.content} ayrıntısını aç`}>
          <span className={`block text-sm font-semibold leading-snug ${done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{task.content}</span>
        </button>
        {project && (
          <p className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-theme-muted truncate">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor(project.name) }} aria-hidden="true" />
            <span className="truncate">{project.name}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-3.5">
          <div className="flex items-center gap-2 min-w-0">
            {owner && <Avatar user={owner} size="xs" />}
            <span className="text-xs font-semibold text-theme-muted truncate">{owner ? firstName(owner.fullName) : '—'}</span>
            <DueText task={task} />
            <TaskHints task={task} />
          </div>
          {editable && (
            <div className="flex gap-1 shrink-0">
              <button disabled={idx === 0} onClick={() => onMove(TASK_STATUSES[idx - 1])} className="icon-btn w-8 h-8 disabled:opacity-30 disabled:pointer-events-none" aria-label={idx > 0 ? `${TASK_STATUS[TASK_STATUSES[idx - 1]].label} sütununa taşı` : 'Geri taşınamaz'}>
                <CaretLeft size={15} weight="bold" />
              </button>
              <button disabled={idx === TASK_STATUSES.length - 1} onClick={() => onMove(TASK_STATUSES[idx + 1])} className="icon-btn w-8 h-8 disabled:opacity-30 disabled:pointer-events-none" aria-label={idx < 2 ? `${TASK_STATUS[TASK_STATUSES[idx + 1]].label} sütununa taşı` : 'İleri taşınamaz'}>
                <CaretRight size={15} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------- Liste görünümü ----------------

interface Group { key: string; label: string; user?: User; project?: Project; open: Task[]; done: Task[] }

function ListView({ tasks, groupBy, onGroupBy, userById, projectById, filtered, onOpen, onNew, canAssign }: {
  tasks: Task[];
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  userById: Map<number, User>;
  projectById: Map<number, Project>;
  filtered: boolean;
  onOpen: (id: number) => void;
  onNew: (userId?: number, projectId?: number) => void;
  canAssign: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    tasks.forEach(t => {
      let key: string; let label: string; let user: User | undefined; let project: Project | undefined;
      if (groupBy === 'PERSON') {
        user = userById.get(t.userId);
        key = `u${t.userId}`; label = user?.fullName ?? 'Pasif kullanıcı';
      } else {
        project = t.projectId ? projectById.get(t.projectId) : undefined;
        key = project ? `p${project.id}` : 'none'; label = project?.name ?? 'Projesiz';
      }
      const g = map.get(key) ?? { key, label, user, project, open: [], done: [] };
      (t.status === 'TAMAMLANDI' ? g.done : g.open).push(t);
      map.set(key, g);
    });
    const list = [...map.values()];
    list.forEach(g => { g.open.sort(byPriorityThenDue); g.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')); });
    // Açık görevi çok olan grup üstte; "Projesiz" en sonda.
    return list.sort((a, b) => Number(a.key === 'none') - Number(b.key === 'none') || b.open.length - a.open.length || a.label.localeCompare(b.label, 'tr'));
  }, [tasks, groupBy, userById, projectById]);

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-theme-muted font-medium">
          <span className="font-bold text-theme-text tabular">{groups.length}</span> {groupBy === 'PERSON' ? 'kişi' : 'grup'} ·{' '}
          <span className="font-bold text-theme-text tabular">{tasks.filter(t => t.status !== 'TAMAMLANDI').length}</span> açık görev
        </p>
        <Segmented<GroupBy>
          label="Gruplama"
          layoutId="task-group"
          value={groupBy}
          onChange={onGroupBy}
          options={[{ value: 'PROJECT', label: 'Projeye göre' }, { value: 'PERSON', label: 'Kişiye göre' }]}
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={groupBy === 'PERSON' ? Rows : SquaresFour} title={filtered ? 'Filtreye uyan görev yok' : 'Görev yok'} description={filtered ? 'Filtreleri değiştirmeyi deneyin.' : undefined} />
      ) : (
        <LayoutGroup>
          <div className="space-y-4">
            {groups.map(g => (
              <GroupCard key={`${groupBy}-${g.key}`} group={g} groupBy={groupBy} userById={userById} projectById={projectById} onOpen={onOpen} onNew={canAssign ? onNew : undefined} />
            ))}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}

function GroupCard({ group: g, groupBy, userById, projectById, onOpen, onNew }: {
  group: Group; groupBy: GroupBy; userById: Map<number, User>; projectById: Map<number, Project>;
  onOpen: (id: number) => void; onNew?: (userId?: number, projectId?: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const total = g.open.length + g.done.length;
  const overdue = g.open.filter(t => t.dueDate && dueLabel(t.dueDate).tone === 'danger').length;

  return (
    <motion.section layout className="card overflow-hidden" aria-label={g.label}>
      <div className="flex items-center gap-3 p-4 sm:px-5">
        <button type="button" onClick={() => setCollapsed(c => !c)} aria-expanded={!collapsed} className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-2xl">
          {g.user ? <Avatar user={g.user} size="sm" /> : (
            <span className="w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: g.project ? projectColor(g.project.name) : '#EDE8D5' }} aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-theme-text truncate">{g.label}</span>
            <span className="block text-xs text-theme-muted font-semibold tabular">
              {g.open.length} açık · {g.done.length}/{total} tamamlandı
              {overdue > 0 && <span className="text-[#9A3B1B]"> · {overdue} gecikmiş</span>}
            </span>
          </span>
          <ProgressBar value={total ? g.done.length / total : 0} className="hidden sm:block w-32 shrink-0" />
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} className="flex text-theme-muted shrink-0" aria-hidden="true"><CaretDown size={18} weight="bold" /></motion.span>
        </button>
        {onNew && (
          <button
            type="button"
            onClick={() => groupBy === 'PERSON' ? onNew(g.user?.id) : onNew(undefined, g.project?.id)}
            className="icon-btn shrink-0"
            aria-label={`${g.label} için görev ata`}
            title="Görev ata"
          >
            <Plus size={18} weight="bold" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="overflow-hidden">
            <ul className="border-t border-theme-light/40 divide-y divide-theme-light/30">
              {g.open.length === 0 && <li className="px-5 py-4 text-sm text-theme-muted font-medium">Açık görev yok.</li>}
              {g.open.map(t => <ListRow key={t.id} task={t} groupBy={groupBy} userById={userById} projectById={projectById} onOpen={onOpen} />)}
              {showDone && g.done.map(t => <ListRow key={t.id} task={t} groupBy={groupBy} userById={userById} projectById={projectById} onOpen={onOpen} />)}
            </ul>
            {g.done.length > 0 && (
              <button type="button" onClick={() => setShowDone(s => !s)} className="w-full px-5 py-2.5 text-xs font-bold text-theme-deep bg-theme-cream/60 hover:bg-theme-lightest/70 transition-colors text-left border-t border-theme-light/40">
                {showDone ? 'Tamamlananları gizle' : `Tamamlanan ${g.done.length} görevi göster`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ListRow({ task, groupBy, userById, projectById, onOpen }: {
  task: Task; groupBy: GroupBy; userById: Map<number, User>; projectById: Map<number, Project>; onOpen: (id: number) => void;
}) {
  const status = task.status ?? 'YAPILACAK';
  const meta = TASK_STATUS[status];
  const done = status === 'TAMAMLANDI';
  const owner = userById.get(task.userId);
  const project = task.projectId ? projectById.get(task.projectId) : undefined;

  return (
    <li>
      <button type="button" onClick={() => onOpen(task.id)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-theme-cream/70 transition-colors">
        <meta.icon size={18} weight={done ? 'fill' : 'bold'} className={`shrink-0 ${meta.className}`} aria-label={meta.label} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold truncate ${done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{task.content}</span>
          <span className="flex items-center gap-2 mt-0.5 text-xs text-theme-muted font-medium min-w-0">
            {groupBy === 'PROJECT' ? (
              owner ? <span className="flex items-center gap-1.5 min-w-0"><Avatar user={owner} size="xs" /><span className="truncate">{owner.fullName}</span></span> : <span>Pasif kullanıcı</span>
            ) : (
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project ? projectColor(project.name) : '#D8D2BE' }} aria-hidden="true" />
                {project?.name ?? 'Projesiz'}
              </span>
            )}
            {status === 'DEVAM' && <span className="text-theme-dark font-bold whitespace-nowrap">· Devam ediyor</span>}
          </span>
        </span>
        <TaskHints task={task} />
        <DueText task={task} />
        {task.priority && !done && <span className="hidden sm:inline-flex"><PriorityBadge priority={task.priority} /></span>}
        <CaretRight size={16} weight="bold" className="text-theme-muted shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
}
