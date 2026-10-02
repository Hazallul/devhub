import { CheckSquare, Sun, Check } from '@phosphor-icons/react';
import { useCreateTodo } from '../../hooks/todos';
import { useMe, useProjects, useUserTasks } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { Skeleton } from '../ui/primitives';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/meta';
import { dueLabel, toIsoDay } from '../../lib/format';
import { UrgencyTags } from '../tasks/Urgency';
import { byUrgency, taskUrgency } from '../../lib/urgency';
import { Panel, PanelEmpty } from './Panel';
import { useLimited } from './useLimited';
import type { TodoItem } from '../../types';

interface Props {
  items: TodoItem[];
  onSelect: (item: TodoItem) => void;
  className?: string;
}

/**
 * Bugün panosundaki "Görevlerim" bölümü: DevHub'da kişiye atanmış açık görevler. Burada yalnızca görüntülenir (durumu görev
 * çekmecesinden değişir); güneş düğmesi görevi kişisel plana bugünlük bir kart olarak alır. Geciken ve yüksek öncelikli görevler
 * görev panosundaki gibi vurgulanır.
 */
export default function TasksPanel({ items, onSelect, className }: Props) {
  const me = useMe();
  const { openTask } = useQuickActions();
  const create = useCreateTodo();
  const { data: tasks, isLoading } = useUserTasks(me.id);
  const { data: projects = [] } = useProjects();

  const open = (tasks ?? [])
    .filter(t => t.status !== 'TAMAMLANDI')
    .sort((a, b) => byUrgency(a, b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank);
  const { shown, more } = useLimited(open, 5);
  const linked = (taskId: number) => items.find(i => i.taskId === taskId && !i.done);

  return (
    <Panel title="Görevlerim" icon={CheckSquare} count={open.length} className={className}>
      {isLoading ? (
        <div className="p-3 space-y-2"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-10 rounded-lg" /></div>
      ) : open.length === 0 ? (
        <PanelEmpty>Açık göreviniz yok. Size bir görev atandığında burada görünür.</PanelEmpty>
      ) : (
        <ul className="divide-y divide-theme-light">
          {shown.map(t => {
            const status = TASK_STATUS[t.status ?? 'YAPILACAK'];
            const u = taskUrgency(t);
            const due = t.dueDate && !u.overdue ? dueLabel(t.dueDate) : null;
            const project = projects.find(p => p.id === t.projectId)?.name;
            const card = linked(t.id);
            return (
              <li key={t.id} className={`flex items-center gap-2.5 pl-3 pr-1.5 py-2 transition-colors ${u.overdue ? 'bg-danger-soft/70' : u.high ? 'bg-clay-soft/50' : 'hover:bg-theme-lightest/60'}`}>
                <status.icon size={16} weight="bold" className={`shrink-0 ${status.className}`} aria-label={status.label} />
                <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left rounded-md" title="Görevi aç">
                  <span className="block text-sm font-medium leading-snug text-theme-text line-clamp-2">{t.content}</span>
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-xs text-theme-muted">
                    <UrgencyTags u={u} />
                    {t.status === 'DEVAM' && <span>Devam ediyor</span>}
                    {project && <span className="truncate max-w-[12rem]">{project}</span>}
                    {due && <span className={due.tone === 'warn' ? 'text-theme-deep' : ''}>{due.text}</span>}
                  </span>
                </button>
                {card ? (
                  <button type="button" onClick={() => onSelect(card)} className="icon-btn w-8 h-8 shrink-0 text-good" aria-label="Plandaki kartı aç" title="Planda: kartı aç">
                    <Check size={16} weight="bold" />
                  </button>
                ) : (
                  <button type="button" disabled={create.isPending}
                    onClick={() => create.mutate({ title: t.content, taskId: t.id, dueDate: toIsoDay(new Date()) })}
                    className="icon-btn w-8 h-8 shrink-0" aria-label={`${t.content}: bugüne ekle`} title="Bugünün planına ekle">
                    <Sun size={16} weight="bold" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {more}
    </Panel>
  );
}
