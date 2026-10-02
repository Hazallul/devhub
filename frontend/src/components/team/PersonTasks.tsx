import { useState } from 'react';
import { Check, Plus, ArrowSquareOut, Trash, ChatCircleText } from '@phosphor-icons/react';
import type { Task, TaskPriority, TaskStatus, User } from '../../types';
import { Skeleton } from '../ui/primitives';
import { useContextMenu } from '../layout/ContextMenu';
import { useQuickActions } from '../layout/QuickActions';
import { EffortChip } from '../tasks/PeopleBoard';
import { UrgencyTags } from '../tasks/Urgency';
import { useCreateTask, useDeleteTask, useUpdateTask, useWorkload } from '../../hooks/api';
import { TASK_PRIORITY, TASK_PRIORITIES, TASK_STATUS, TASK_STATUSES, LINK_TYPE, linkHref, linkText } from '../../lib/meta';
import { DAY_HOURS, effortTone, formatDuration, liveSpent, remainingSeconds, useNow } from '../../lib/effort';
import { byUrgency, taskUrgency, urgencySurface } from '../../lib/urgency';
import { dueLabel } from '../../lib/format';

/** Tamamlandı sütununda ilk bakışta görünen kart sayısı */
const DONE_LIMIT = 4;

/**
 * Çalışan satırı açıldığında görünen bölüm: solda kişinin yük özeti ve iletişim bağlantıları,
 * sağda görevler durum sütunlarında (Yapılacak / Devam ediyor / Tamamlandı). Uzun tek sütun liste yerine
 * genişliği kullanır; geciken ve yüksek öncelikli görevler görev panosundaki gibi vurgulanır.
 */
export default function PersonTasks({ user, tasks, loading, canEdit, isSelf }: {
  user: User; tasks?: Task[]; loading: boolean; canEdit: boolean; isSelf: boolean;
}) {
  const { data: workload } = useWorkload();
  const now = useNow(30_000);
  const work = workload?.find(w => w.userId === user.id);
  const worked = work?.weekWorkedSeconds ?? 0;
  const capacity = work?.weekCapacitySeconds ?? 0;
  const list = tasks ?? [];
  const byStatus = (s: TaskStatus) => list.filter(t => (t.status ?? 'YAPILACAK') === s);
  const open = list.filter(t => t.status !== 'TAMAMLANDI');
  const remaining = open.reduce((n, t) => n + remainingSeconds(t, liveSpent(t, now)), 0);
  const overdue = open.filter(t => taskUrgency(t).overdue).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]" onClick={e => e.stopPropagation()}>
      {/* Özet */}
      <aside aria-label={`${user.fullName} özeti`} className="space-y-4 text-sm">
        <div>
          <div className="flex items-baseline justify-between text-xs text-theme-muted">
            <span>Bu hafta</span>
            <span className="tabular"><span className="text-theme-text font-medium">{formatDuration(worked, true)}</span>{capacity > 0 && ` / ${formatDuration(capacity, true)}`}</span>
          </div>
          <div className="h-1.5 rounded-full bg-theme-light/60 mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: `${capacity ? Math.min(100, (worked / capacity) * 100) : 0}%` }} />
          </div>
        </div>
        <dl className="divide-y divide-theme-light">
          <Row label="Açık iş" value={<>{formatDuration(remaining, true)}{remaining > 0 && <span className="text-theme-muted font-normal"> ({String(Math.round((remaining / 3600 / DAY_HOURS) * 10) / 10).replace('.', ',')} gün)</span>}</>} />
          <Row label="Açık görev" value={open.length} />
          {overdue > 0 && <Row label="Geciken" value={<span className="text-danger">{overdue}</span>} />}
          <Row label="Tamamlanan" value={byStatus('TAMAMLANDI').length} />
        </dl>
        {user.links && user.links.length > 0 && (
          <ul className="space-y-1" aria-label={`${user.fullName} iletişim bilgileri`}>
            {user.links.map((l, i) => {
              const meta = LINK_TYPE[l.type];
              const href = linkHref(l);
              const inner = <><meta.icon size={14} weight="bold" className="shrink-0 text-theme-muted" aria-hidden="true" /><span className="truncate">{linkText(l)}</span></>;
              const cls = 'flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg text-xs text-theme-text';
              return (
                <li key={i}>
                  {href
                    ? <a href={href} target={l.type === 'EMAIL' || l.type === 'PHONE' ? undefined : '_blank'} rel="noopener noreferrer" title={`${meta.label}: ${l.value}`} className={`${cls} hover:bg-surface hover:text-theme-deep transition-colors`}>{inner}</a>
                    : <span title={`${meta.label}: ${l.value}`} className={cls}>{inner}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Görevler */}
      <div className="min-w-0 space-y-2.5">
        {canEdit && <QuickAdd user={user} isSelf={isSelf} />}
        {loading && !tasks ? (
          <div className="grid gap-2 md:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {TASK_STATUSES.map(s => <Column key={s} status={s} tasks={byStatus(s)} now={now} canEdit={canEdit} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <dt className="text-theme-muted">{label}</dt>
      <dd className="tabular font-medium text-theme-text">{value}</dd>
    </div>
  );
}

function Column({ status, tasks, now, canEdit }: { status: TaskStatus; tasks: Task[]; now: number; canEdit: boolean }) {
  const [all, setAll] = useState(false);
  const meta = TASK_STATUS[status];
  const done = status === 'TAMAMLANDI';
  const sorted = done
    ? [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    : [...tasks].sort((a, b) => byUrgency(a, b) || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const shown = done && !all ? sorted.slice(0, DONE_LIMIT) : sorted;
  const hours = tasks.reduce((n, t) => n + (done ? liveSpent(t, now) : (t.estimatedMinutes ?? 0) * 60), 0);

  return (
    <section aria-label={meta.label} className="rounded-xl bg-surface border border-theme-light flex flex-col min-w-0">
      <header className="flex items-center gap-1.5 px-2.5 h-9 border-b border-theme-light text-xs">
        <meta.icon size={14} weight="bold" className={meta.className} aria-hidden="true" />
        <span className="font-medium text-theme-text">{meta.label}</span>
        <span className="tabular text-theme-muted">{tasks.length}</span>
        {hours > 0 && <span className="ml-auto tabular text-theme-muted" title={done ? 'Çalışılan süre' : 'Tahmini iş'}>{formatDuration(hours, true)}</span>}
      </header>
      <div className="p-1.5 space-y-1 max-h-[17rem] overflow-y-auto scrollbar-thin">
        {tasks.length === 0
          ? <p className="text-xs text-theme-muted text-center py-4">Görev yok</p>
          : shown.map(t => <Item key={t.id} task={t} now={now} canEdit={canEdit} />)}
      </div>
      {done && tasks.length > DONE_LIMIT && (
        <button type="button" onClick={() => setAll(a => !a)} className="px-2.5 py-1.5 text-xs font-medium text-theme-deep text-left border-t border-theme-light hover:bg-theme-lightest/60 transition-colors">
          {all ? 'Daha az göster' : `${tasks.length - DONE_LIMIT} görev daha`}
        </button>
      )}
    </section>
  );
}

function Item({ task, now, canEdit }: { task: Task; now: number; canEdit: boolean }) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const menu = useContextMenu();
  const { openTask } = useQuickActions();
  const status = task.status ?? 'YAPILACAK';
  const done = status === 'TAMAMLANDI';
  const u = taskUrgency(task);
  const spent = liveSpent(task, now);
  const due = task.dueDate && !done && !u.overdue ? dueLabel(task.dueDate) : null;

  return (
    <div
      onContextMenu={e => menu(e, {
        label: 'Görev',
        items: [
          { label: 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: () => openTask(task.id) },
          canEdit && 'divider',
          ...(canEdit ? TASK_STATUSES.filter(s => s !== status).map(s => ({ label: `“${TASK_STATUS[s].label}” yap`, icon: TASK_STATUS[s].icon, onSelect: () => update.mutate({ id: task.id, status: s }) })) : []),
          canEdit && 'divider',
          canEdit && { label: 'Görevi sil', icon: Trash, tone: 'danger' as const, onSelect: () => remove.mutate(task.id) },
        ],
      })}
      className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors ${urgencySurface(u)}`}
    >
      <button
        type="button"
        onClick={() => canEdit && update.mutate({ id: task.id, status: done ? 'YAPILACAK' : 'TAMAMLANDI' })}
        disabled={!canEdit}
        aria-pressed={done}
        aria-label={done ? 'Görevi yeniden aç' : 'Görevi tamamlandı olarak işaretle'}
        className={`mt-0.5 w-4 h-4 shrink-0 rounded border-[1.5px] flex items-center justify-center transition-colors ${done ? 'bg-accent border-accent text-white' : 'border-theme-medium bg-surface hover:border-theme-deep'} ${canEdit ? '' : 'cursor-default'}`}
      >
        {done && <Check size={10} weight="bold" />}
      </button>
      <button type="button" onClick={() => openTask(task.id)} className="min-w-0 flex-1 text-left rounded-md" title="Ayrıntıyı aç">
        <span className={`block text-[0.8125rem] font-medium leading-snug line-clamp-2 ${done ? 'text-theme-muted line-through decoration-theme-light' : 'text-theme-text'}`}>{task.content}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[0.6875rem] text-theme-muted">
          <UrgencyTags u={u} />
          <EffortChip spent={spent} estimate={task.estimatedMinutes} ticking={!!task.ticking} tone={effortTone(spent, task.estimatedMinutes)} />
          {due && <span className={due.tone === 'warn' ? 'text-theme-deep' : ''}>{due.text}</span>}
          {!!task.commentCount && <span className="inline-flex items-center gap-0.5 tabular" aria-label={`${task.commentCount} yorum`}><ChatCircleText size={12} weight="bold" aria-hidden="true" />{task.commentCount}</span>}
        </span>
      </button>
    </div>
  );
}

/** Tek satır hızlı ekleme: başlık + öncelik + tahmini iş gücü (zorunlu). */
function QuickAdd({ user, isSelf }: { user: User; isSelf: boolean }) {
  const createTask = useCreateTask();
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('ORTA');
  const [hours, setHours] = useState('4');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = content.trim();
    if (!c) return;
    createTask.mutate({ userIds: [user.id], content: c, priority, estimatedMinutes: Number(hours) * 60 }, {
      onSuccess: () => { setContent(''); setPriority('ORTA'); setHours('4'); },
    });
  };
  const select = 'h-8 px-2 rounded-lg bg-transparent text-xs font-medium text-theme-text hover:bg-theme-lightest focus:outline-none focus:ring-2 focus:ring-theme-medium/40 cursor-pointer';
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 h-11 pl-3 pr-1.5 rounded-xl bg-surface border border-theme-light focus-within:border-theme-medium transition-colors">
      <Plus size={15} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
      <input value={content} onChange={e => setContent(e.target.value)} maxLength={500}
        placeholder={isSelf ? 'Kendine görev ekle…' : `${user.fullName.split(' ')[0]} için görev yaz…`} aria-label="Yeni görev"
        className="flex-1 min-w-0 bg-transparent text-sm text-theme-text placeholder:text-theme-muted focus:outline-none" />
      <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} aria-label="Öncelik" className={select}>
        {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
      </select>
      <select value={hours} onChange={e => setHours(e.target.value)} aria-label="Tahmini iş gücü" title="Tahmini iş gücü" className={select}>
        {[1, 2, 4, 8, 16, 24, 40].map(h => <option key={h} value={h}>{h >= 8 && h % 8 === 0 ? `${h / 8} gün` : `${h} sa`}</option>)}
      </select>
      <button type="submit" disabled={createTask.isPending || !content.trim()} className="btn-primary min-h-0 h-8 px-3 text-xs disabled:opacity-40">Ekle</button>
    </form>
  );
}
