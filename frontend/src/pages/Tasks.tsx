import { useMemo, useState } from 'react';
import { Plus, MagnifyingGlass, Kanban } from '@phosphor-icons/react';
import { PageHeader, Segmented, Skeleton, Avatar, EmptyState } from '../components/ui/primitives';
import Combobox from '../components/ui/Combobox';
import { useAllTasks, useUsers, useMe, useUpdateTask, useProjects } from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import PeopleBoard from '../components/tasks/PeopleBoard';
import { TASK_PRIORITY, TASK_PRIORITIES } from '../lib/meta';
import { trLower } from '../lib/format';
import type { Task, TaskPriority, TaskStatus } from '../types';

type Scope = 'MINE' | 'ALL';
/** Proje filtresi: '' = hepsi, 'none' = projesiz, diğerleri proje id'si */
const NO_PROJECT = 'none';

export default function Tasks() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const actions = useQuickActions();
  const { data: tasks, isLoading } = useAllTasks();
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const update = useUpdateTask();

  const [scope, setScope] = useState<Scope>(isAdmin ? 'ALL' : 'MINE');
  const [priority, setPriority] = useState<'ALL' | TaskPriority>('ALL');
  const [person, setPerson] = useState('');
  const [project, setProject] = useState('');
  const [search, setSearch] = useState('');
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

  const canEdit = (t: Task) => isAdmin || t.userId === me.id;

  const move = (task: Task, status: TaskStatus) => {
    if (!canEdit(task) || (task.status ?? 'YAPILACAK') === status) return;
    update.mutate({ id: task.id, status });
  };

  /** Kişi panosu: aynı satırda durum değişir; yönetici başka birinin satırına bırakırsa görev o kişiye de aktarılır. */
  const moveTo = (task: Task, status: TaskStatus, userId?: number) => {
    const statusChanged = (task.status ?? 'YAPILACAK') !== status;
    if (userId !== undefined && isAdmin && userId !== task.userId) {
      update.mutate({ id: task.id, userId, ...(statusChanged ? { status } : {}) });
      return;
    }
    move(task, status);
  };

  const mineCount = tasks?.filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI').length ?? 0;
  const filtered = !!(priority !== 'ALL' || person || project || search.trim());
  const newTaskForFilter = () => actions.newTask(person ? Number(person) : undefined, project && project !== NO_PROJECT ? Number(project) : undefined);

  return (
    <>
      <PageHeader
        title="Görevler"
        description="Kartı satırında sürükleyerek durumunu değiştirin."
        actions={<>
          <button onClick={newTaskForFilter} className="btn-primary"><Plus size={16} weight="bold" /> {isAdmin ? 'Görev ata' : 'Görev ekle'}</button>
        </>}
      />

      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <Segmented<Scope>
          label="Kapsam"
          layoutId="task-scope"
          value={scope}
          onChange={setScope}
          options={[{ value: 'MINE', label: 'Benim', count: mineCount }, { value: 'ALL', label: 'Tüm ekip' }]}
        />
        {/* Dar ekranda arama kendi satırına iner; seçiciler küçülüp aramanın üstüne binmez */}
        <div className="relative flex-1 basis-64 min-w-[15rem]">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} aria-hidden="true" />
          <input type="search" aria-label="Görevlerde ara" placeholder="Görev, açıklama veya kişi ara" value={search} onChange={e => setSearch(e.target.value)} className="input-sm pl-9" />
        </div>
        <select aria-label="Projeye göre filtrele" value={project} onChange={e => setProject(e.target.value)} className="input-sm w-full sm:w-auto sm:min-w-[11rem] sm:flex-none">
          <option value="">Tüm projeler</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value={NO_PROJECT}>Projesiz</option>
        </select>
        {scope === 'ALL' && (
          <Combobox label="Kişiye göre filtrele" value={person} onChange={setPerson} width={260} className="w-full sm:w-auto sm:min-w-[11rem]"
            placeholder="Herkes" searchPlaceholder="Kişi ara" emptyText="Eşleşen kişi yok"
            options={[{ value: '', label: 'Herkes' }, ...(users ?? []).map(u => ({ value: String(u.id), label: u.fullName, hint: u.jobTitle ?? undefined, leading: <Avatar user={u} size="xs" /> }))]} />
        )}
        <select aria-label="Önceliğe göre filtrele" value={priority} onChange={e => setPriority(e.target.value as 'ALL' | TaskPriority)} className="input-sm w-full sm:w-auto sm:min-w-[10rem] sm:flex-none">
          <option value="ALL">Tüm öncelikler</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="card divide-y divide-theme-light">{[1, 2, 3, 4].map(i => <div key={i} className="p-4"><Skeleton className="h-20" /></div>)}</div>
      ) : (tasks ?? []).length === 0 ? (
        <EmptyState icon={Kanban} title="Henüz görev yok" description="İlk görevi ekleyerek panoyu başlatın." action={<button onClick={() => actions.newTask()} className="btn-primary">Görev ekle</button>} />
      ) : (
        <PeopleBoard
          tasks={visible}
          users={(users ?? []).filter(u => scope === 'ALL' ? (!person || u.id === Number(person)) : u.id === me.id)}
          projectById={projectById}
          filtered={filtered || scope === 'MINE'}
          canEdit={canEdit}
          canAssign={isAdmin}
          onMove={moveTo}
          onOpen={actions.openTask}
          onNew={userId => actions.newTask(userId, project && project !== NO_PROJECT ? Number(project) : undefined)}
        />
      )}
    </>
  );
}
