import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, PencilSimple, CalendarBlank, Users, UserMinus, UserPlus, CheckCircle, Briefcase, Plus, CaretRight, ChatCircleText } from '@phosphor-icons/react';
import type { Project, ProjectStatus, Task, User } from '../../types';
import { Avatar, Pill, ProgressBar, StatusBadge, Segmented, PriorityBadge } from '../ui/primitives';
import { useQuickActions } from '../layout/QuickActions';
import { useMe, useUsers, useAssignProject, useUpdateProject } from '../../hooks/api';
import { PROJECT_STATUS, PROJECT_STATUSES, TASK_PRIORITY, TASK_STATUS, projectColor } from '../../lib/meta';
import { dueLabel, formatDate, firstName } from '../../lib/format';

interface Props {
  project: Project | null;
  members: User[];
  tasks: Task[];
  onClose: () => void;
}

/** Sağdan kayan proje detay paneli. */
export default function ProjectDrawer({ project, members, tasks, onClose }: Props) {
  useEffect(() => {
    if (!project) return;
    // Üstünde görev paneli açıksa Esc önce onu kapatır.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-drawer="task"]')) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project, onClose]);

  return createPortal(
    <AnimatePresence>
      {project && (
        <div className="fixed inset-0 z-[110]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`${project.name} detayları`}
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { type: 'spring', stiffness: 300, damping: 34 } }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            className="absolute inset-y-0 right-0 w-full max-w-lg bg-theme-cream shadow-2xl flex flex-col sm:rounded-l-4xl overflow-hidden"
          >
            <DrawerBody key={project.id} project={project} members={members} tasks={tasks} onClose={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerBody({ project, members, tasks, onClose }: Props & { project: Project }) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const assign = useAssignProject();
  const update = useUpdateProject();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [deadline, setDeadline] = useState(project.deadline ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project.status ?? 'AKTIF');
  const [addUserId, setAddUserId] = useState('');

  const memberIds = new Set(members.map(m => m.id));
  // Projeye bağlı görevler (üye sonradan başka projeye geçmiş olsa da burada kalır)
  const memberTasks = tasks.filter(t => t.projectId === project.id);
  const done = memberTasks.filter(t => t.status === 'TAMAMLANDI').length;
  const statusMeta = PROJECT_STATUS[project.status ?? 'AKTIF'];
  const due = project.deadline && project.status !== 'TAMAMLANDI' ? dueLabel(project.deadline) : null;
  const candidates = users?.filter(u => !memberIds.has(u.id)) ?? [];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    update.mutate({ id: project.id, name: name.trim(), description, deadline, status }, { onSuccess: () => setEditing(false) });
  };

  const goToMember = (id: number) => {
    onClose();
    navigate('/team', { state: { highlightUserId: id } });
  };

  return (
    <>
      <div className="p-6 sm:p-8 pb-6 bg-surface border-b border-theme-light/40">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: projectColor(project.name) }}>
            <Briefcase size={26} weight="duotone" className="text-theme-text" />
          </div>
          <div className="flex-1 min-w-0">
            <Pill className={statusMeta.className}><statusMeta.icon size={11} weight="bold" /> {statusMeta.label}</Pill>
            <h2 className="text-2xl font-bold tracking-tight text-theme-text mt-2 break-words">{project.name}</h2>
          </div>
          <div className="flex gap-1 shrink-0">
            {isAdmin && !editing && (
              <button onClick={() => setEditing(true)} className="icon-btn" aria-label="Projeyi düzenle"><PencilSimple size={18} weight="bold" /></button>
            )}
            <button onClick={onClose} className="icon-btn bg-theme-lightest text-theme-deep hover:bg-theme-light" aria-label="Kapat"><X size={18} weight="bold" /></button>
          </div>
        </div>
        {project.description && !editing && <p className="text-sm text-theme-muted mt-4 leading-relaxed">{project.description}</p>}

        {!editing && (
          <dl className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-theme-cream rounded-2xl p-3">
              <dt className="eyebrow flex items-center gap-1"><Users size={12} weight="bold" /> Üye</dt>
              <dd className="text-xl font-bold tabular mt-1">{members.length}</dd>
            </div>
            <div className="bg-theme-cream rounded-2xl p-3">
              <dt className="eyebrow flex items-center gap-1"><CheckCircle size={12} weight="bold" /> Görev</dt>
              <dd className="text-xl font-bold tabular mt-1">{done}/{memberTasks.length}</dd>
            </div>
            <div className="bg-theme-cream rounded-2xl p-3">
              <dt className="eyebrow flex items-center gap-1"><CalendarBlank size={12} weight="bold" /> Teslim</dt>
              <dd className={`text-sm font-bold mt-1.5 ${due?.tone === 'danger' ? 'text-danger' : 'text-theme-text'}`}>
                {project.deadline ? (due ? due.text : formatDate(project.deadline)) : '—'}
              </dd>
            </div>
          </dl>
        )}
        {!editing && memberTasks.length > 0 && <ProgressBar value={done / memberTasks.length} className="mt-4" />}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 sm:p-8 space-y-8">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.form key="edit" onSubmit={save} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} className="space-y-5">
              <div>
                <label htmlFor="pd-name" className="label">Proje adı</label>
                <input id="pd-name" value={name} onChange={e => setName(e.target.value)} className="input" autoFocus />
              </div>
              <div>
                <label htmlFor="pd-desc" className="label">Açıklama</label>
                <textarea id="pd-desc" rows={3} value={description} onChange={e => setDescription(e.target.value)} className="input resize-none" />
              </div>
              <div>
                <label htmlFor="pd-deadline" className="label">Teslim tarihi</label>
                <input id="pd-deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="input" />
              </div>
              <div>
                <span className="label">Aşama</span>
                <Segmented<ProjectStatus> label="Aşama" layoutId="pd-status" value={status} onChange={setStatus}
                  options={PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS[s].label }))} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost">Vazgeç</button>
                <button type="submit" disabled={update.isPending} className="btn-primary">{update.isPending ? 'Kaydediliyor…' : 'Kaydet'}</button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} className="space-y-8">
              <section>
                <h3 className="eyebrow mb-3">Ekip ({members.length})</h3>
                {members.length === 0 && <p className="text-sm text-theme-muted">Bu projeye henüz kimse atanmamış.</p>}
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {members.map(m => {
                      const open = memberTasks.filter(t => t.userId === m.id && t.status !== 'TAMAMLANDI').length;
                      return (
                        <motion.li key={m.id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
                          className="group flex items-center gap-3 p-2.5 pr-3 rounded-2xl bg-surface border border-theme-light/40">
                          <button onClick={() => goToMember(m.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl">
                            <Avatar user={m} size="sm" />
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-theme-text truncate">{m.fullName}</span>
                              <span className="block text-xs text-theme-muted truncate">{m.jobTitle} · {open ? `projede ${open} açık görev` : 'projede açık görevi yok'}</span>
                            </span>
                          </button>
                          <StatusBadge status={m.status} size="sm" />
                          {isAdmin && (
                            <button onClick={() => assign.mutate({ userId: m.id, project: null })} className="icon-btn w-9 h-9 hover:text-danger hover:bg-danger-soft" aria-label={`${m.fullName} projeden çıkar`} title="Projeden çıkar">
                              <UserMinus size={17} weight="bold" />
                            </button>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                {isAdmin && candidates.length > 0 && (
                  <form
                    className="flex gap-2 mt-3"
                    onSubmit={e => {
                      e.preventDefault();
                      if (addUserId) assign.mutate({ userId: Number(addUserId), project: project.name }, { onSuccess: () => setAddUserId('') });
                    }}
                  >
                    <select aria-label="Projeye kişi ekle" value={addUserId} onChange={e => setAddUserId(e.target.value)} className="input py-2.5 flex-1">
                      <option value="">Kişi seçin…</option>
                      {candidates.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}{u.currentProject ? ` (şu an: ${u.currentProject})` : ' (boşta)'}</option>
                      ))}
                    </select>
                    <button type="submit" disabled={!addUserId || assign.isPending} className="btn-primary px-4"><UserPlus size={18} weight="bold" /> Ekle</button>
                  </form>
                )}
              </section>

              <ProjectTasks projectId={project.id} tasks={memberTasks} users={users ?? []} canAssign={isAdmin} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

type TaskTab = 'OPEN' | 'DONE';

/** Projeye bağlı görevler: açık / tamamlanan sekmeleri; satıra tıklayınca görev ayrıntısı açılır. */
function ProjectTasks({ projectId, tasks, users, canAssign }: { projectId: number; tasks: Task[]; users: User[]; canAssign: boolean }) {
  const actions = useQuickActions();
  const [tab, setTab] = useState<TaskTab>('OPEN');
  const open = tasks.filter(t => t.status !== 'TAMAMLANDI').sort((a, b) =>
    TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const done = tasks.filter(t => t.status === 'TAMAMLANDI').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const list = tab === 'OPEN' ? open : done;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="eyebrow">Görevler</h3>
        {canAssign && (
          <button onClick={() => actions.newTask(undefined, projectId)} className="inline-flex items-center gap-1.5 text-xs font-bold text-theme-deep hover:underline underline-offset-4 rounded">
            <Plus size={13} weight="bold" /> Görev ata
          </button>
        )}
      </div>
      <Segmented<TaskTab>
        label="Görev sekmesi"
        layoutId={`pd-tasks-${projectId}`}
        value={tab}
        onChange={setTab}
        options={[{ value: 'OPEN', label: 'Açık', count: open.length }, { value: 'DONE', label: 'Tamamlanan', count: done.length }]}
      />
      {list.length === 0 ? (
        <p className="text-sm text-theme-muted mt-4">{tab === 'OPEN' ? 'Projenin açık görevi yok.' : 'Henüz tamamlanan görev yok.'}</p>
      ) : (
        <ul className="space-y-2 mt-3">
          {list.map(t => {
            const owner = users.find(u => u.id === t.userId);
            const d = t.dueDate && t.status !== 'TAMAMLANDI' ? dueLabel(t.dueDate) : null;
            const status = TASK_STATUS[t.status ?? 'YAPILACAK'];
            return (
              <li key={t.id}>
                <button onClick={() => actions.openTask(t.id)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface border border-theme-light/40 hover:border-theme-light hover:shadow-soft transition-[border-color,box-shadow] text-left">
                  <status.icon size={18} weight={t.status === 'TAMAMLANDI' ? 'fill' : 'bold'} className={`shrink-0 ${status.className}`} aria-label={status.label} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${t.status === 'TAMAMLANDI' ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{t.content}</span>
                    <span className="flex flex-wrap items-center gap-2 mt-1.5">
                      {owner && <span className="flex items-center gap-1.5 text-[11px] font-bold text-theme-muted"><Avatar user={owner} size="xs" /> {firstName(owner.fullName)}</span>}
                      {t.priority && t.status !== 'TAMAMLANDI' && <PriorityBadge priority={t.priority} />}
                      {d && <span className={`text-[11px] font-bold ${d.tone === 'danger' ? 'text-danger' : 'text-theme-muted'}`}>{d.text}</span>}
                      {!!t.commentCount && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-theme-muted tabular" aria-label={`${t.commentCount} yorum`}>
                          <ChatCircleText size={13} weight="bold" aria-hidden="true" /> {t.commentCount}
                        </span>
                      )}
                    </span>
                  </span>
                  <CaretRight size={16} weight="bold" className="text-theme-muted shrink-0" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
