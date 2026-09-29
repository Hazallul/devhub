import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Plus, MagnifyingGlass, CaretLeft, CaretRight, CalendarBlank, Kanban, Trash } from '@phosphor-icons/react';
import { PageHeader, Segmented, Skeleton, Avatar, PriorityBadge, EmptyState } from '../components/ui/primitives';
import { useAllTasks, useUsers, useMe, useUpdateTask, useDeleteTask } from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import { TASK_STATUS, TASK_STATUSES, TASK_PRIORITY, TASK_PRIORITIES } from '../lib/meta';
import { dueLabel, firstName, trLower } from '../lib/format';
import type { Task, TaskPriority, TaskStatus, User } from '../types';

type Scope = 'MINE' | 'ALL';

export default function Tasks() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const actions = useQuickActions();
  const { data: tasks, isLoading } = useAllTasks();
  const { data: users } = useUsers();
  const update = useUpdateTask();

  const [scope, setScope] = useState<Scope>(isAdmin ? 'ALL' : 'MINE');
  const [priority, setPriority] = useState<'ALL' | TaskPriority>('ALL');
  const [person, setPerson] = useState('');
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const userById = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users]);

  const visible = useMemo(() => {
    const q = trLower(search.trim());
    return (tasks ?? []).filter(t =>
      (scope === 'ALL' || t.userId === me.id) &&
      (priority === 'ALL' || (t.priority ?? 'ORTA') === priority) &&
      (!person || t.userId === Number(person)) &&
      (!q || trLower(`${t.content} ${userById.get(t.userId)?.fullName ?? ''}`).includes(q)),
    );
  }, [tasks, scope, priority, person, search, me.id, userById]);

  const columns = useMemo(() => {
    const byCol: Record<TaskStatus, Task[]> = { YAPILACAK: [], DEVAM: [], TAMAMLANDI: [] };
    visible.forEach(t => byCol[t.status ?? 'YAPILACAK'].push(t));
    (Object.keys(byCol) as TaskStatus[]).forEach(k => byCol[k].sort((a, b) =>
      TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')));
    return byCol;
  }, [visible]);

  const canEdit = (t: Task) => isAdmin || t.userId === me.id;

  const move = (task: Task, status: TaskStatus) => {
    if (!canEdit(task) || (task.status ?? 'YAPILACAK') === status) return;
    update.mutate({ id: task.id, status });
  };

  const mineCount = tasks?.filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI').length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Görevler"
        title="Görev Panosu"
        description="Görevleri sütunlar arasında sürükleyin veya oklarla taşıyın. Yalnızca kendi görevlerinizi (yöneticiler tümünü) taşıyabilirsiniz."
        actions={<button onClick={() => actions.newTask()} className="btn-primary"><Plus size={18} weight="bold" /> {isAdmin ? 'Görev Ata' : 'Görev Ekle'}</button>}
      />

      <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-center">
        <Segmented<Scope>
          label="Kapsam"
          layoutId="task-scope"
          value={scope}
          onChange={setScope}
          options={[{ value: 'MINE', label: 'Benim', count: mineCount }, { value: 'ALL', label: 'Tüm ekip' }]}
        />
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} aria-hidden="true" />
          <input type="search" aria-label="Görevlerde ara" placeholder="Görev veya kişi ara…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-11 shadow-soft" />
        </div>
        <select aria-label="Önceliğe göre filtrele" value={priority} onChange={e => setPriority(e.target.value as 'ALL' | TaskPriority)} className="input lg:w-44 shadow-soft">
          <option value="ALL">Tüm öncelikler</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
        </select>
        {scope === 'ALL' && (
          <select aria-label="Kişiye göre filtrele" value={person} onChange={e => setPerson(e.target.value)} className="input lg:w-48 shadow-soft">
            <option value="">Herkes</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-96 rounded-4xl" />)}</div>
      ) : (tasks ?? []).length === 0 ? (
        <EmptyState icon={Kanban} title="Henüz görev yok" description="İlk görevi ekleyerek panoyu başlatın." action={<button onClick={() => actions.newTask()} className="btn-primary">Görev ekle</button>} />
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
                          editable={canEdit(t)}
                          dragging={dragId === t.id}
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => { setDragId(null); setOverCol(null); }}
                          onMove={s => move(t, s)}
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

interface TaskCardProps {
  task: Task;
  owner?: User;
  editable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (s: TaskStatus) => void;
}

function TaskCard({ task, owner, editable, dragging, onDragStart, onDragEnd, onMove }: TaskCardProps) {
  const remove = useDeleteTask();
  const status = task.status ?? 'YAPILACAK';
  const idx = TASK_STATUSES.indexOf(status);
  const done = status === 'TAMAMLANDI';
  const due = task.dueDate && !done ? dueLabel(task.dueDate) : null;

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
        className={`group bg-white rounded-3xl p-4 border border-theme-light/50 shadow-soft hover:shadow-diffusion hover:border-theme-light transition-[box-shadow,border-color] ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          {task.priority && !done ? <PriorityBadge priority={task.priority} /> : <span />}
          {editable && (
            <button onClick={() => remove.mutate(task.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 icon-btn w-8 h-8 -mt-1 -mr-1 hover:text-[#9A3B1B] hover:bg-[#FBEDE5] transition-opacity" aria-label="Görevi sil">
              <Trash size={15} weight="bold" />
            </button>
          )}
        </div>
        <p className={`text-sm font-semibold leading-snug ${done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{task.content}</p>
        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2 min-w-0">
            {owner && <Avatar user={owner} size="xs" />}
            <span className="text-xs font-semibold text-theme-muted truncate">{owner ? firstName(owner.fullName) : '—'}</span>
            {due && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${due.tone === 'danger' ? 'text-[#9A3B1B]' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}`}>
                <CalendarBlank size={12} weight="bold" aria-hidden="true" /> {due.text}
              </span>
            )}
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
