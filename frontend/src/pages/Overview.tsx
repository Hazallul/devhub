import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, CheckSquare, FolderOpen, Airplane, ArrowRight, Megaphone, PushPin, Trash, ListDashes, Hourglass, Plus, CalendarBlank, CaretDown,
} from '@phosphor-icons/react';
import { StatCard, Skeleton, StatusBadge, ProgressBar, AvatarStack, EmptyState, Pill } from '../components/ui/primitives';
import { Menu, MenuItem, MenuLabel } from '../components/ui/Menu';
import TaskRow from '../components/tasks/TaskRow';
import {
  useMe, useUsers, useAllTasks, useProjects, useLeaves, useLogs, useAnnouncements, useDeleteAnnouncement, useUpdateStatus,
} from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import { USER_STATUS, ALL_STATUSES, TASK_PRIORITY, PROJECT_STATUS, statusOptions, statusHint } from '../lib/meta';
import { dueLabel, firstName, formatLongDate, greeting, parseLog, parseServerDate, toIsoDay } from '../lib/format';
import { listContainer, listItem } from '../lib/motion';
import type { UserStatus } from '../types';

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });
function ago(iso: string) {
  const mins = Math.round((parseServerDate(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(mins) < 60) return relative.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

export default function Overview() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const navigate = useNavigate();
  const actions = useQuickActions();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: tasks } = useAllTasks();
  const { data: projects } = useProjects();
  const { data: leaves } = useLeaves();
  const { data: logs } = useLogs();
  const { data: announcements } = useAnnouncements();
  const deleteAnnouncement = useDeleteAnnouncement();
  const updateStatus = useUpdateStatus();
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusEl, setStatusEl] = useState<HTMLButtonElement | null>(null);

  const today = toIsoDay(new Date());
  const working = users?.filter(u => u.status && u.status !== 'IZINLI').length ?? 0;
  const openTasks = tasks?.filter(t => t.status !== 'TAMAMLANDI') ?? [];
  const overdue = openTasks.filter(t => t.dueDate && t.dueDate < today).length;
  const activeProjects = projects?.filter(p => (p.status ?? 'AKTIF') === 'AKTIF').length ?? 0;
  const onLeave = leaves?.filter(l => l.state === 'ONAYLANDI' && l.startDate <= today && today <= l.endDate) ?? [];
  const pendingLeaves = leaves?.filter(l => l.state === 'BEKLIYOR').length ?? 0;

  const myTasks = useMemo(() => (tasks ?? [])
    .filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI')
    .sort((a, b) => TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
    .slice(0, 5), [tasks, me.id]);

  const distribution = ALL_STATUSES.map(s => ({ status: s, count: users?.filter(u => u.status === s).length ?? 0 }));
  const total = users?.length ?? 0;

  const projectRows = useMemo(() => (projects ?? [])
    .filter(p => p.status !== 'TAMAMLANDI')
    .sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'))
    .slice(0, 4)
    .map(p => {
      const members = users?.filter(u => u.currentProject === p.name) ?? [];
      const ids = new Set(members.map(m => m.id));
      const own = tasks?.filter(t => ids.has(t.userId)) ?? [];
      return { project: p, members, done: own.filter(t => t.status === 'TAMAMLANDI').length, total: own.length };
    }), [projects, users, tasks]);

  const statuses: UserStatus[] = statusOptions(me, me);
  const hint = statusHint(me, me);

  return (
    <>
      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
        <div>
          <p className="eyebrow mb-2">{formatLongDate(new Date())}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{greeting()}, {firstName(me.fullName)}</h1>
          <p className="text-theme-muted mt-2 font-medium">
            {myTasks.length > 0 ? `Bugün seni bekleyen ${openTasks.filter(t => t.userId === me.id).length} açık görev var.` : 'Açık görevin yok, harika gidiyorsun.'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-3xl border border-theme-light/50 shadow-soft p-2 pl-4">
          <span className="text-sm font-semibold text-theme-muted">Durumun</span>
          <button ref={setStatusEl} onClick={() => setStatusOpen(o => !o)} aria-haspopup="menu" aria-expanded={statusOpen} className="flex items-center gap-1 rounded-full">
            <StatusBadge status={me.status} interactive />
            <CaretDown size={14} weight="bold" className="text-theme-muted" />
          </button>
          <Menu open={statusOpen} onClose={() => setStatusOpen(false)} anchor={statusEl} width={200} label="Durumunu değiştir">
            <MenuLabel>Durumunu değiştir</MenuLabel>
            {statuses.map(s => (
              <MenuItem key={s} icon={USER_STATUS[s].icon} active={me.status === s} onSelect={() => { setStatusOpen(false); if (s === me.status) return; if (s === 'IZINLI') actions.newLeave(me); else updateStatus.mutate({ userId: me.id, status: s }); }}>
                {USER_STATUS[s].label}
              </MenuItem>
            ))}
            {hint && <p className="text-[11px] text-theme-muted font-medium px-3 pt-2 pb-1 leading-snug">{hint}</p>}
          </Menu>
        </div>
      </div>

      {/* KPI */}
      <motion.div variants={listContainer} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div variants={listItem}>
          <StatCard label="Çalışıyor" icon={Users} value={usersLoading ? '–' : <>{working}<span className="text-lg text-theme-muted font-semibold">/{total}</span></>} hint="Aktif, toplantıda veya uzaktan" onClick={() => navigate('/team')} />
        </motion.div>
        <motion.div variants={listItem}>
          <StatCard label="Açık görev" icon={CheckSquare} value={openTasks.length} hint={overdue > 0 ? <span className="text-[#9A3B1B] font-bold">{overdue} gecikmiş</span> : 'Gecikmiş görev yok'} onClick={() => navigate('/tasks')} />
        </motion.div>
        <motion.div variants={listItem}>
          <StatCard label="Aktif proje" icon={FolderOpen} value={activeProjects} hint={`${projects?.length ?? 0} projenin`} onClick={() => navigate('/projects')} />
        </motion.div>
        <motion.div variants={listItem}>
          <StatCard label="Bugün izinde" icon={Airplane} value={onLeave.length} hint={isAdmin && pendingLeaves > 0 ? <span className="text-theme-deep font-bold">{pendingLeaves} talep onay bekliyor</span> : 'İzin takvimini gör'} onClick={() => navigate('/leaves')} />
        </motion.div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Görevlerim */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="my-tasks">
          <div className="flex items-center justify-between mb-4">
            <h2 id="my-tasks" className="text-lg font-bold tracking-tight">Görevlerim</h2>
            <div className="flex gap-2">
              <button onClick={() => actions.newTask(me.id)} className="icon-btn" aria-label="Görev ekle" title="Görev ekle"><Plus size={18} weight="bold" /></button>
              <button onClick={() => navigate('/tasks')} className="btn-ghost min-h-0 h-10 px-3 text-sm">Panoya git <ArrowRight size={14} weight="bold" /></button>
            </div>
          </div>
          {!tasks ? (
            <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : myTasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Açık görevin yok" description="Yeni bir görev ekleyebilir ya da ekibin panosuna göz atabilirsin." />
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {myTasks.map(t => <TaskRow key={t.id} task={t} canEdit />)}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Ekip durumu */}
        <section className="card p-6" aria-labelledby="team-dist">
          <div className="flex items-center justify-between mb-5">
            <h2 id="team-dist" className="text-lg font-bold tracking-tight">Ekip Durumu</h2>
            <button onClick={() => navigate('/team')} className="text-sm font-bold text-theme-deep hover:underline underline-offset-4">Ekibe git</button>
          </div>
          {!users ? <Skeleton className="h-40" /> : (
            <>
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-5" role="img" aria-label={distribution.map(d => `${USER_STATUS[d.status].label}: ${d.count}`).join(', ')}>
                {distribution.filter(d => d.count > 0).map((d, i) => (
                  <motion.div
                    key={d.status}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className={`origin-left ${USER_STATUS[d.status].dot}`}
                    style={{ width: `${(d.count / total) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="space-y-2.5">
                {distribution.map(d => {
                  const Meta = USER_STATUS[d.status];
                  return (
                    <li key={d.status} className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${Meta.dot}`} aria-hidden="true" />
                      <Meta.icon size={16} weight="bold" className="text-theme-muted" aria-hidden="true" />
                      <span className="text-sm font-semibold flex-1">{Meta.label}</span>
                      <span className="text-sm font-bold tabular">{d.count}</span>
                      <span className="text-xs text-theme-muted tabular w-10 text-right">%{total ? Math.round((d.count / total) * 100) : 0}</span>
                    </li>
                  );
                })}
              </ul>
              {onLeave.length > 0 && (
                <div className="mt-5 pt-4 border-t border-theme-light/40">
                  <p className="eyebrow mb-2">Bugün izinde</p>
                  <div className="flex items-center gap-2">
                    <AvatarStack users={onLeave.map(l => users.find(u => u.id === l.userId)).filter(u => !!u)} max={6} />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 pb-10">
        {/* Duyurular */}
        <section className="card p-6" aria-labelledby="ann-title">
          <div className="flex items-center justify-between mb-4">
            <h2 id="ann-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><Megaphone size={20} weight="duotone" className="text-theme-deep" /> Duyurular</h2>
            {isAdmin && <button onClick={actions.newAnnouncement} className="icon-btn" aria-label="Duyuru yayınla" title="Duyuru yayınla"><Plus size={18} weight="bold" /></button>}
          </div>
          {!announcements ? <Skeleton className="h-32" /> : announcements.length === 0 ? (
            <p className="text-sm text-theme-muted py-6 text-center">Şu an duyuru yok.</p>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {announcements.slice(0, 4).map(a => (
                  <motion.li key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    className={`group p-4 rounded-2xl border ${a.pinned ? 'bg-theme-lightest/60 border-theme-light' : 'bg-theme-cream/60 border-theme-light/40'}`}>
                    <div className="flex items-start gap-2">
                      {a.pinned && <PushPin size={15} weight="fill" className="text-theme-deep mt-0.5 shrink-0" aria-label="Sabitlenmiş" />}
                      <h3 className="text-sm font-bold flex-1">{a.title}</h3>
                      {isAdmin && (
                        <button onClick={() => deleteAnnouncement.mutate(a.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 icon-btn w-7 h-7 -mt-1 -mr-1 hover:text-[#9A3B1B] hover:bg-[#FBEDE5]" aria-label="Duyuruyu kaldır">
                          <Trash size={14} weight="bold" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-theme-muted mt-1.5 leading-relaxed">{a.content}</p>
                    <p className="text-[11px] font-semibold text-theme-muted/80 mt-2">{ago(a.createdAt)}</p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* Projeler */}
        <section className="card p-6" aria-labelledby="proj-title">
          <div className="flex items-center justify-between mb-4">
            <h2 id="proj-title" className="text-lg font-bold tracking-tight">Yaklaşan Teslimler</h2>
            <button onClick={() => navigate('/projects')} className="text-sm font-bold text-theme-deep hover:underline underline-offset-4">Tümü</button>
          </div>
          {!projects ? <Skeleton className="h-40" /> : (
            <ul className="space-y-4">
              {projectRows.map(({ project, members, done, total: t }) => {
                const due = project.deadline ? dueLabel(project.deadline) : null;
                const s = PROJECT_STATUS[project.status ?? 'AKTIF'];
                return (
                  <li key={project.id}>
                    <button onClick={() => navigate('/projects', { state: { openProjectId: project.id } })} className="w-full text-left rounded-2xl p-3 -m-3 hover:bg-theme-cream transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold truncate">{project.name}</span>
                        <Pill className={s.className}>{s.label}</Pill>
                      </div>
                      <ProgressBar value={t ? done / t : 0} />
                      <div className="flex items-center justify-between mt-2">
                        <AvatarStack users={members} max={4} />
                        {due && (
                          <span className={`text-xs font-bold flex items-center gap-1 ${due.tone === 'danger' ? 'text-[#9A3B1B]' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}`}>
                            <CalendarBlank size={13} weight="bold" /> {due.text}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Son aktiviteler */}
        <section className="card p-6" aria-labelledby="act-title">
          <div className="flex items-center justify-between mb-4">
            <h2 id="act-title" className="text-lg font-bold tracking-tight">Son Aktiviteler</h2>
            <button onClick={actions.openLogs} className="text-sm font-bold text-theme-deep hover:underline underline-offset-4">Tüm loglar</button>
          </div>
          {!logs ? <Skeleton className="h-40" /> : logs.length === 0 ? (
            <EmptyState icon={ListDashes} title="Henüz aktivite yok" />
          ) : (
            <ol className="space-y-4">
              {logs.slice(0, 6).map(l => {
                const p = parseLog(l);
                return (
                  <li key={l.id} className="flex gap-3">
                    <span className="w-2 h-2 rounded-full bg-theme-medium mt-1.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{p.text}</p>
                      <p className="text-[11px] font-semibold text-theme-muted mt-0.5">{ago(l.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {isAdmin && pendingLeaves > 0 && (
            <button onClick={() => navigate('/leaves')} className="mt-5 w-full flex items-center gap-3 p-3 rounded-2xl bg-theme-lightest border border-theme-light text-left hover:bg-theme-light/50 transition-colors">
              <Hourglass size={20} weight="duotone" className="text-theme-deep shrink-0" />
              <span className="text-sm font-bold text-theme-deep flex-1">{pendingLeaves} izin talebi onayını bekliyor</span>
              <ArrowRight size={16} weight="bold" className="text-theme-deep" />
            </button>
          )}
        </section>
      </div>

    </>
  );
}
