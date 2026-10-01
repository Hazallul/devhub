import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, PencilSimple, Trash, CalendarBlank, Briefcase, UserCircle, Flag, CheckCircle, PaperPlaneRight, ChatCircleText, ClockCounterClockwise,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Avatar, PriorityBadge, Segmented, Skeleton } from '../ui/primitives';
import EffortPanel from './EffortPanel';
import {
  useAllTasks, useUsers, useMe, useProjects, useUpdateTask, useDeleteTask, useTaskActivity, useAddTaskComment, useDeleteTaskComment,
} from '../../hooks/api';
import { TASK_STATUS, TASK_STATUSES, TASK_PRIORITY, TASK_PRIORITIES, projectColor } from '../../lib/meta';
import { dueLabel, formatDate, parseServerDate, timeAgo, toIsoDay } from '../../lib/format';
import type { Task, TaskActivity, TaskPriority, TaskStatus } from '../../types';

/** Sağdan kayan görev ayrıntı paneli: özellikler, açıklama, geçmiş ve yorumlar. Proje panelinin üstünde açılabilir. */
export default function TaskDrawer({ taskId, onClose }: { taskId: number | null; onClose: () => void }) {
  const { data: tasks, isLoading } = useAllTasks();
  const task = taskId !== null ? tasks?.find(t => t.id === taskId) : undefined;

  useEffect(() => {
    if (taskId === null) return;
    // Düzenlenen alanlar Esc'i kendileri yakalayıp durdurur; alttaki proje paneli bu panel açıkken Esc'e tepki vermez.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  return createPortal(
    <AnimatePresence>
      {taskId !== null && (
        <div className="fixed inset-0 z-[115]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            data-drawer="task"
            aria-label={task ? `Görev: ${task.content}` : 'Görev ayrıntısı'}
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { type: 'spring', stiffness: 300, damping: 34 } }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            className="absolute inset-y-0 right-0 w-full max-w-xl bg-theme-cream shadow-2xl flex flex-col sm:rounded-l-4xl overflow-hidden"
          >
            {task ? (
              <DrawerBody key={task.id} task={task} onClose={onClose} />
            ) : (
              <div className="p-8 space-y-4">
                <div className="flex justify-end">
                  <button onClick={onClose} className="icon-btn bg-theme-lightest text-theme-deep hover:bg-theme-light" aria-label="Kapat"><X size={18} weight="bold" /></button>
                </div>
                {isLoading ? (
                  <><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-40" /></>
                ) : (
                  <p className="text-sm text-theme-muted font-medium text-center py-10">Bu görev bulunamadı; silinmiş olabilir.</p>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const canEdit = isAdmin || task.userId === me.id;
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const owner = users?.find(u => u.id === task.userId);
  const project = projects?.find(p => p.id === task.projectId);
  const status = task.status ?? 'YAPILACAK';
  const done = status === 'TAMAMLANDI';
  const due = task.dueDate && !done ? dueLabel(task.dueDate) : null;

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const patch = (body: Parameters<typeof update.mutate>[0]) => update.mutate(body);

  const saveTitle = () => {
    const v = title.trim();
    setEditingTitle(false);
    if (v.length >= 3 && v !== task.content) patch({ id: task.id, content: v });
    else setTitle(task.content);
  };

  const openProject = () => {
    if (!project) return;
    onClose();
    navigate('/projects', { state: { openProjectId: project.id } });
  };

  return (
    <>
      <div className="p-6 sm:p-8 pb-6 bg-surface border-b border-theme-light/40">
        <div className="flex items-center gap-2">
          {project ? (
            <button onClick={openProject} className="inline-flex items-center gap-2 text-xs font-bold text-theme-deep bg-theme-cream hover:bg-theme-lightest px-2.5 py-1.5 rounded-xl transition-colors min-w-0" title="Projeyi aç">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: projectColor(project.name) }} aria-hidden="true" />
              <span className="truncate">{project.name}</span>
            </button>
          ) : (
            <span className="text-xs font-bold text-theme-muted bg-theme-cream px-2.5 py-1.5 rounded-xl">Projesiz</span>
          )}
          <div className="ml-auto flex gap-1 shrink-0">
            {canEdit && (
              confirmDelete ? (
                <button onClick={() => remove.mutate(task.id, { onSuccess: onClose })} className="h-10 px-3 rounded-xl text-xs font-bold bg-danger-soft text-danger hover:bg-clay-soft transition-colors">
                  Silinsin mi?
                </button>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="icon-btn hover:text-danger hover:bg-danger-soft" aria-label="Görevi sil" title="Görevi sil"><Trash size={18} weight="bold" /></button>
              )
            )}
            <button onClick={onClose} className="icon-btn bg-theme-lightest text-theme-deep hover:bg-theme-light" aria-label="Kapat"><X size={18} weight="bold" /></button>
          </div>
        </div>

        {editingTitle ? (
          <textarea
            value={title}
            autoFocus
            rows={2}
            aria-label="Görev başlığı"
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); }
              if (e.key === 'Escape') { e.stopPropagation(); setTitle(task.content); setEditingTitle(false); }
            }}
            className="input mt-4 text-lg font-bold resize-none"
          />
        ) : (
          <div className="group flex items-start gap-2 mt-4">
            <h2 className={`text-xl font-bold tracking-tight leading-snug break-words flex-1 ${done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{task.content}</h2>
            {canEdit && (
              <button onClick={() => { setTitle(task.content); setEditingTitle(true); }} className="icon-btn w-9 h-9 shrink-0 opacity-60 group-hover:opacity-100 focus:opacity-100" aria-label="Başlığı düzenle" title="Başlığı düzenle">
                <PencilSimple size={16} weight="bold" />
              </button>
            )}
          </div>
        )}

        <div className="mt-4">
          {canEdit ? (
            <Segmented<TaskStatus>
              label="Durum"
              layoutId={`task-drawer-status-${task.id}`}
              value={status}
              onChange={s => patch({ id: task.id, status: s })}
              options={TASK_STATUSES.map(s => ({ value: s, label: TASK_STATUS[s].label }))}
            />
          ) : (
            <StatusChip status={status} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 sm:p-8 space-y-8">
          <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
            <Prop icon={UserCircle} label="Atanan">
              {isAdmin ? (
                <select aria-label="Atanan kişi" value={task.userId} onChange={e => patch({ id: task.id, userId: Number(e.target.value) })} className="prop-select">
                  {!owner && <option value={task.userId}>Pasif kullanıcı</option>}
                  {users?.map(u => <option key={u.id} value={u.id}>{u.fullName}{u.status === 'IZINLI' ? ' (izinli)' : ''}</option>)}
                </select>
              ) : owner ? (
                <span className="flex items-center gap-2"><Avatar user={owner} size="xs" /><span className="truncate">{owner.fullName}</span></span>
              ) : '—'}
            </Prop>

            <Prop icon={Flag} label="Öncelik">
              {canEdit ? (
                <select aria-label="Öncelik" value={task.priority ?? 'ORTA'} onChange={e => patch({ id: task.id, priority: e.target.value as TaskPriority })} className="prop-select">
                  {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
                </select>
              ) : <PriorityBadge priority={task.priority ?? 'ORTA'} />}
            </Prop>

            <Prop icon={CalendarBlank} label="Son tarih" hint={due ? <span className={due.tone === 'danger' ? 'text-danger' : ''}>{due.text}</span> : null}>
              {canEdit ? (
                <input
                  type="date"
                  aria-label="Son tarih"
                  value={task.dueDate ?? ''}
                  min={task.dueDate && task.dueDate < toIsoDay(new Date()) ? task.dueDate : toIsoDay(new Date())}
                  onChange={e => patch({ id: task.id, dueDate: e.target.value || null })}
                  className="prop-select"
                />
              ) : task.dueDate ? formatDate(task.dueDate) : '—'}
            </Prop>

            <Prop icon={Briefcase} label="Proje">
              {isAdmin ? (
                <select
                  aria-label="Proje"
                  value={task.projectId ?? ''}
                  onChange={e => patch({ id: task.id, projectId: e.target.value ? Number(e.target.value) : null })}
                  className="prop-select"
                >
                  <option value="">Projesiz</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : project?.name ?? 'Projesiz'}
            </Prop>

            <Prop icon={PaperPlaneRight} label="Atayan">
              {task.createdByName ?? <span className="text-theme-muted">Bilinmiyor</span>}
              <span className="block text-xs text-theme-muted font-medium mt-0.5">{formatDate(toIsoDay(parseServerDate(task.createdAt)))}</span>
            </Prop>

            {done && task.completedAt && (
              <Prop icon={CheckCircle} label="Tamamlandı">
                {formatDate(toIsoDay(parseServerDate(task.completedAt)))}
                <span className="block text-xs text-theme-muted font-medium mt-0.5">{timeAgo(task.completedAt)}</span>
              </Prop>
            )}
          </dl>

          <EffortPanel task={task} canEdit={canEdit} canEditEstimate={isAdmin || (task.createdById === me.id)} />
          <Description task={task} canEdit={canEdit} />
          <Activity task={task} />
        </div>
      </div>

      <CommentBox taskId={task.id} />
    </>
  );
}

function Prop({ icon: IconCmp, label, hint, children }: { icon: Icon; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow flex items-center gap-1.5 mb-1.5"><IconCmp size={13} weight="bold" aria-hidden="true" /> {label}</dt>
      <dd className="text-sm font-semibold text-theme-text min-w-0">
        {children}
        {hint && <span className="block text-xs font-bold text-theme-muted mt-1">{hint}</span>}
      </dd>
    </div>
  );
}

function StatusChip({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl bg-theme-cream">
      <meta.icon size={16} weight="bold" className={meta.className} aria-hidden="true" /> {meta.label}
    </span>
  );
}

function Description({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description ?? '');

  const save = () => {
    const v = draft.trim();
    if (v !== (task.description ?? '')) update.mutate({ id: task.id, description: v || null });
    setEditing(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="eyebrow">Açıklama</h3>
        {canEdit && !editing && (
          <button onClick={() => { setDraft(task.description ?? ''); setEditing(true); }} className="text-xs font-bold text-theme-deep hover:underline underline-offset-4 rounded">
            {task.description ? 'Düzenle' : 'Ekle'}
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            autoFocus
            rows={5}
            maxLength={4000}
            aria-label="Açıklama"
            placeholder="Kabul kriterleri, bağlantılar, notlar…"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }}
            className="input resize-y min-h-[7.5rem] text-sm"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost min-h-[2.375rem] px-4 text-sm">Vazgeç</button>
            <button type="button" onClick={save} className="btn-primary min-h-[2.375rem] px-4 text-sm">Kaydet</button>
          </div>
        </div>
      ) : task.description ? (
        <p className="text-sm text-theme-text leading-relaxed whitespace-pre-wrap break-words bg-surface rounded-2xl border border-theme-light/40 p-4">{task.description}</p>
      ) : (
        <p className="text-sm text-theme-muted font-medium">Açıklama eklenmemiş.</p>
      )}
    </section>
  );
}

type Filter = 'ALL' | 'COMMENTS';

function Activity({ task }: { task: Task }) {
  const me = useMe();
  const { data: items, isLoading } = useTaskActivity(task.id);
  const del = useDeleteTaskComment();
  const [filter, setFilter] = useState<Filter>('ALL');
  const comments = items?.filter(a => a.kind === 'COMMENT').length ?? 0;
  const shown = (items ?? []).filter(a => filter === 'ALL' || a.kind === 'COMMENT');

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="eyebrow">Etkinlik</h3>
        <Segmented<Filter>
          label="Etkinlik filtresi"
          layoutId={`task-activity-${task.id}`}
          value={filter}
          onChange={setFilter}
          options={[{ value: 'ALL', label: 'Tümü' }, { value: 'COMMENTS', label: 'Yorumlar', count: comments }]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-6" /><Skeleton className="h-16" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-theme-muted font-medium text-center py-6">
          {filter === 'COMMENTS' ? 'Henüz yorum yok. İlk yorumu aşağıdan yazın.' : 'Bu görev için kayıt yok.'}
        </p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-[0.8125rem] before:top-2 before:bottom-2 before:w-px before:bg-theme-light/70">
          <AnimatePresence initial={false}>
            {shown.map(a => (
              <motion.li key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="relative pl-10">
                {a.kind === 'COMMENT'
                  ? <Comment item={a} canDelete={a.actorId === me.id || me.role === 'ADMIN'} onDelete={() => del.mutate({ taskId: task.id, commentId: a.id })} />
                  : <EventLine item={a} />}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

function ActorDot({ item }: { item: TaskActivity }) {
  return (
    <span className="absolute left-0 top-0">
      {item.actorName
        ? <Avatar user={{ fullName: item.actorName, avatarColor: item.actorAvatarColor ?? '', status: null }} size="xs" />
        : <span className="w-7 h-7 rounded-lg bg-theme-lightest text-theme-deep flex items-center justify-center"><ClockCounterClockwise size={14} weight="bold" /></span>}
    </span>
  );
}

function EventLine({ item }: { item: TaskActivity }) {
  return (
    <>
      <ActorDot item={item} />
      <p className="text-sm text-theme-muted leading-snug pt-1">
        <span className="font-bold text-theme-text">{item.actorName ?? 'Sistem'}</span> {item.message}
        <time className="text-xs font-medium whitespace-nowrap" dateTime={item.createdAt} title={parseServerDate(item.createdAt).toLocaleString('tr-TR')}> · {timeAgo(item.createdAt)}</time>
      </p>
    </>
  );
}

function Comment({ item, canDelete, onDelete }: { item: TaskActivity; canDelete: boolean; onDelete: () => void }) {
  return (
    <>
      <ActorDot item={item} />
      <div className="group bg-surface rounded-2xl rounded-tl-md border border-theme-light/50 p-3.5 shadow-soft">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-theme-text">{item.actorName ?? 'Sistem'}</span>
          <time className="text-xs text-theme-muted font-medium" dateTime={item.createdAt} title={parseServerDate(item.createdAt).toLocaleString('tr-TR')}>{timeAgo(item.createdAt)}</time>
          {canDelete && (
            <button onClick={onDelete} className="ml-auto icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger hover:bg-danger-soft transition-opacity" aria-label="Yorumu sil" title="Yorumu sil">
              <Trash size={13} weight="bold" />
            </button>
          )}
        </div>
        <p className="text-sm text-theme-text leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
      </div>
    </>
  );
}

function CommentBox({ taskId }: { taskId: number }) {
  const add = useAddTaskComment();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const v = text.trim();
    if (!v || add.isPending) return;
    add.mutate({ taskId, text: v }, { onSuccess: () => { setText(''); ref.current?.focus(); } });
  };

  return (
    <div className="p-4 sm:px-8 sm:py-5 bg-surface border-t border-theme-light/40">
      <div className="flex items-end gap-2">
        <label htmlFor={`comment-${taskId}`} className="sr-only">Yorum yaz</label>
        <div className="relative flex-1">
          <ChatCircleText size={18} className="absolute left-3.5 top-3 text-theme-muted" aria-hidden="true" />
          <textarea
            id={`comment-${taskId}`}
            ref={ref}
            value={text}
            rows={1}
            maxLength={1000}
            placeholder="Yorum yazın… (Enter: gönder, Shift+Enter: yeni satır)"
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="input pl-10 py-2.5 resize-none max-h-32 text-sm [field-sizing:content]"
          />
        </div>
        <button type="button" onClick={send} disabled={!text.trim() || add.isPending} className="btn-primary px-4 min-h-[2.75rem]" aria-label="Yorumu gönder">
          <PaperPlaneRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
