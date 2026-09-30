import { CalendarBlank, CheckSquare, Sun, ArrowSquareOut, Check } from '@phosphor-icons/react';
import { useCreateTodo } from '../../hooks/todos';
import { useMe, useProjects, useUserTasks } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { Skeleton } from '../ui/primitives';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/meta';
import { dueLabel, toIsoDay } from '../../lib/format';
import type { TodoItem } from '../../types';

interface Props {
  items: TodoItem[];
  onSelect: (item: TodoItem) => void;
}

/**
 * "Görevlerim": DevHub'da kişiye atanmış açık görevler. Burada yalnızca görüntülenir (durumu görev sayfasından/çekmecesinden değişir);
 * "Bugüne ekle" görevi kişisel plana bağlı bir kart olarak alır.
 */
export default function TasksPane({ items, onSelect }: Props) {
  const me = useMe();
  const { openTask } = useQuickActions();
  const create = useCreateTodo();
  const { data: tasks, isLoading } = useUserTasks(me.id);
  const { data: projects = [] } = useProjects();

  const open = (tasks ?? [])
    .filter(t => t.status !== 'TAMAMLANDI')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank);
  const linked = (taskId: number) => items.find(i => i.taskId === taskId && !i.done);

  return (
    <>
      <header className="pt-4 pb-5">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-theme-text">Görevlerim</h1>
        <p className="text-sm font-semibold text-theme-muted mt-1.5">
          DevHub’da size atanan {open.length ? `${open.length} açık görev` : 'açık görev yok'} · buradan plana alabilirsiniz
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2.5"><Skeleton className="h-16 rounded-3xl" /><Skeleton className="h-16 rounded-3xl" /><Skeleton className="h-16 rounded-3xl" /></div>
      ) : open.length === 0 ? (
        <div className="text-center py-16">
          <span className="inline-flex w-16 h-16 rounded-3xl bg-theme-lightest text-theme-deep items-center justify-center mb-4"><CheckSquare size={30} weight="duotone" aria-hidden="true" /></span>
          <p className="text-lg font-bold text-theme-text">Açık göreviniz yok</p>
          <p className="text-sm text-theme-muted font-medium mt-1 max-w-sm mx-auto">Size bir görev atandığında burada görünür.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {open.map(t => {
            const status = TASK_STATUS[t.status ?? 'YAPILACAK'];
            const priority = TASK_PRIORITY[t.priority ?? 'ORTA'];
            const due = t.dueDate ? dueLabel(t.dueDate) : null;
            const project = projects.find(p => p.id === t.projectId)?.name;
            const card = linked(t.id);
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-3xl border border-theme-light/50 bg-white pl-4 pr-2 py-3 shadow-soft hover:border-theme-light hover:shadow-diffusion transition-[border-color,box-shadow]">
                <status.icon size={20} weight="bold" className={`shrink-0 ${status.className}`} aria-hidden="true" />
                <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left rounded-xl py-0.5">
                  <span className="block text-[15px] font-semibold leading-snug break-words text-theme-text">{t.content}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-theme-muted">
                    <span>{status.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md ${priority.className}`}>{priority.label}</span>
                    {project && <span>{project}</span>}
                    {due && (
                      <span className={`inline-flex items-center gap-1 ${due.tone === 'danger' ? 'text-[#9A3B1B]' : due.tone === 'warn' ? 'text-theme-deep' : ''}`}>
                        <CalendarBlank size={12} weight="bold" aria-hidden="true" /> {due.text}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1"><ArrowSquareOut size={12} weight="bold" aria-hidden="true" /> Görevi aç</span>
                  </span>
                </button>
                {card ? (
                  <button type="button" onClick={() => onSelect(card)} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-theme-lightest text-xs font-bold text-theme-deep hover:bg-theme-light transition-colors" title="Plandaki kartı aç">
                    <Check size={14} weight="bold" aria-hidden="true" /> Planda
                  </button>
                ) : (
                  <button type="button" disabled={create.isPending}
                    onClick={() => create.mutate({ title: t.content, taskId: t.id, dueDate: toIsoDay(new Date()) })}
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-theme-light text-xs font-bold text-theme-deep hover:bg-theme-lightest transition-colors">
                    <Sun size={14} weight="bold" aria-hidden="true" /> Bugüne ekle
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
