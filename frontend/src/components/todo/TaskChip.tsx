import { CheckSquare } from '@phosphor-icons/react';
import { useAllTasks, useProjects } from '../../hooks/api';

/** Göreve bağlı kart satırının zemini: kişisel notlardan ayrı bölüm açmadan ayırt edilsin (mavi ton + kare onay kutusu + bu etiket). */
export const TASK_CARD_SURFACE = 'bg-accent/[0.06] border-accent/25 hover:border-accent/45';

/** "Görev · Proje" etiketi; proje adı görev ve proje listelerinden (React Query önbelleği) bulunur. */
export default function TaskChip({ taskId, size = 'md' }: { taskId: number; size?: 'sm' | 'md' }) {
  const { data: tasks } = useAllTasks();
  const { data: projects } = useProjects();
  const projectId = tasks?.find(t => t.id === taskId)?.projectId;
  const project = projectId ? projects?.find(p => p.id === projectId)?.name : undefined;
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full rounded-md bg-accent/10 text-theme-deep font-semibold shrink-0 ${
      size === 'sm' ? 'px-1.5 py-px text-[0.6875rem]' : 'max-w-[12rem] px-2 py-0.5 text-xs'
    }`}>
      <CheckSquare size={size === 'sm' ? 11 : 12} weight="bold" className="shrink-0" aria-hidden="true" />
      <span className="truncate">Görev{project ? ` · ${project}` : ''}</span>
    </span>
  );
}
