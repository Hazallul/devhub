import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, FolderOpen, CalendarBlank, Users, CaretRight, CaretLeft, UserMinus, Briefcase, HandGrabbing, Eye } from '@phosphor-icons/react';
import { PageHeader, Segmented, Skeleton, EmptyState, Avatar, AvatarStack, Pill, ProgressBar } from '../components/ui/primitives';
import { Menu, MenuItem, MenuDivider } from '../components/ui/Menu';
import type { MenuPoint } from '../components/ui/Menu';
import ProjectDrawer from '../components/projects/ProjectDrawer';
import { useUsers, useProjects, useAllTasks, useMe, useAssignProject } from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import { useContextMenu } from '../components/layout/ContextMenu';
import { PROJECT_STATUS, PROJECT_STATUSES, projectColor } from '../lib/meta';
import { dueLabel } from '../lib/format';
import { listContainer, listItem } from '../lib/motion';
import type { Project, ProjectStatus, User } from '../types';

type Filter = 'ALL' | ProjectStatus;

export default function Projects() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const location = useLocation();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const contextMenu = useContextMenu();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: tasks } = useAllTasks();
  const assign = useAssignProject();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [openId, setOpenId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ point: MenuPoint; user: User; view: 'root' | 'projects' } | null>(null);
  const [dragUser, setDragUser] = useState<User | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Başka sayfadan (komut paleti, ekip kartı) belirli bir proje açılmak istenebilir.
  useEffect(() => {
    // Sayfa çıkış animasyonundayken yeni adresin durumunu (ör. /team'e giden highlightUserId) silmemek için
    // yalnızca kendi adresine gelen ve kendine ait olan durumu okur.
    if (location.pathname !== '/projects') return;
    const state = location.state as { openProjectId?: number; openProjectName?: string } | null;
    if (!state || (state.openProjectId === undefined && !state.openProjectName) || !projects) return;
    const target = projects.find(p => p.id === state.openProjectId || p.name === state.openProjectName);
    if (target) setOpenId(target.id);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, projects, navigate]);

  const members = useMemo(() => {
    const m = new Map<string, User[]>();
    users?.forEach(u => { if (u.currentProject) m.set(u.currentProject, [...(m.get(u.currentProject) ?? []), u]); });
    return m;
  }, [users]);

  const unassigned = users?.filter(u => !u.currentProject) ?? [];

  // Bir projede olup açık (tamamlanmamış) görevi olmayanlar: yöneticinin iş dağıtması gereken kişiler.
  // İzinliler hariç: görevleri izinden önce kapatılmış/devredilmiştir ve bu sürede iş atanmaz.
  const idle = useMemo(() => (users ?? [])
    .filter(u => u.currentProject && u.status !== 'IZINLI' && !(tasks ?? []).some(t => t.userId === u.id && t.status !== 'TAMAMLANDI'))
    .map(u => ({ user: u, done: (tasks ?? []).filter(t => t.userId === u.id).length }))
    .sort((a, b) => (a.user.currentProject ?? '').localeCompare(b.user.currentProject ?? '', 'tr') || a.user.fullName.localeCompare(b.user.fullName, 'tr')),
  [users, tasks]);

  const progressOf = (project: Project) => {
    // Görev kendi projesine bağlıdır: kişi proje değiştirse de ilerleme doğru kalır.
    const own = tasks?.filter(t => t.projectId === project.id) ?? [];
    if (!own.length) return null;
    return { done: own.filter(t => t.status === 'TAMAMLANDI').length, total: own.length };
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: projects?.length ?? 0, PLANLAMA: 0, AKTIF: 0, BEKLEMEDE: 0, TAMAMLANDI: 0 };
    projects?.forEach(p => { c[p.status ?? 'AKTIF'] += 1; });
    return c;
  }, [projects]);

  const visible = (projects ?? []).filter(p => filter === 'ALL' || (p.status ?? 'AKTIF') === filter);
  const openProject = projects?.find(p => p.id === openId) ?? null;

  const onChipContext = (e: React.MouseEvent, user: User) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ point: { x: e.clientX, y: e.clientY }, user, view: 'root' });
  };

  const drop = (projectName: string | null) => {
    if (dragUser && dragUser.currentProject !== projectName) assign.mutate({ userId: dragUser.id, project: projectName });
    setDragUser(null);
    setDropTarget(null);
  };

  const dropProps = (key: string, projectName: string | null) => isAdmin ? {
    onDragOver: (e: React.DragEvent) => { if (dragUser) { e.preventDefault(); setDropTarget(key); } },
    onDragLeave: () => setDropTarget(t => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(projectName); },
  } : {};

  const chip = (u: User, subtitle?: string, trailing?: React.ReactNode) => (
    <motion.div
      key={u.id}
      layout
      layoutId={`chip-${u.id}`}
      className="list-none"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    >
      <div
        draggable={isAdmin}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragUser(u); }}
        onDragEnd={() => { setDragUser(null); setDropTarget(null); }}
        onContextMenu={e => onChipContext(e, u)}
        onClick={e => { e.stopPropagation(); navigate('/team', { state: { highlightUserId: u.id } }); }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') navigate('/team', { state: { highlightUserId: u.id } }); }}
        title={isAdmin ? 'Tıkla: ekipte göster · Sürükle: projeye ata · Sağ tık: işlemler' : 'Ekipte göster'}
        className={`group flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl bg-surface border border-theme-light/60 hover:border-theme-medium hover:shadow-soft transition-all ${
          isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${dragUser?.id === u.id ? 'opacity-40' : ''}`}
      >
        <Avatar user={u} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-theme-text truncate max-w-[8.75rem]">{u.fullName}</p>
          <p className="text-[0.6875rem] text-theme-muted font-medium truncate max-w-[11.25rem]">{subtitle ?? u.jobTitle}</p>
        </div>
        {trailing}
      </div>
    </motion.div>
  );

  const loading = usersLoading || projectsLoading;

  return (
    <>
      <PageHeader
        eyebrow="Projeler"
        title="Projeler"
        description={isAdmin ? 'Projeleri takip edin. Boştaki çalışanları bir projeye sürükleyerek atayabilirsiniz.' : 'Aktif projeler ve atanmış ekip üyeleri.'}
        actions={isAdmin ? <button onClick={() => actions.newProject()} className="btn-primary"><Plus size={18} weight="bold" /> Proje ekle</button> : undefined}
      />

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-32 rounded-2xl" /><div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div></div>
      ) : (
        <>
          {/* Boştaki çalışanlar */}
          <section
            aria-labelledby="pool-title"
            {...dropProps('pool', null)}
            className={`card p-5 mb-4 transition-colors ${
              dropTarget === 'pool' ? 'border-theme-medium bg-theme-lightest/60 ring-1 ring-theme-medium' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 id="pool-title" className="text-base font-semibold text-theme-text">Boşta olan çalışanlar</h2>
                <Pill className="bg-theme-lightest text-theme-deep">{unassigned.length} kişi</Pill>
              </div>
              {isAdmin && <p className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-theme-muted"><HandGrabbing size={16} weight="bold" /> Bir projeye sürükleyin</p>}
            </div>
            {unassigned.length === 0 ? (
              <p className="text-sm text-theme-muted font-medium">Herkes bir projeye atanmış. {isAdmin && 'Bir kişiyi projeden çıkarmak için buraya sürükleyin.'}</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">{unassigned.map(u => chip(u))}</div>
            )}
          </section>

          {/* Projede olup açık görevi olmayanlar */}
          <section aria-labelledby="idle-title" className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 id="idle-title" className="text-base font-semibold text-theme-text">Projede görevi olmayanlar</h2>
                <Pill className="bg-theme-lightest text-theme-deep">{idle.length} kişi</Pill>
              </div>
              {isAdmin && idle.length > 0 && <p className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-theme-muted"><Plus size={14} weight="bold" /> ile hızlıca görev atayın</p>}
            </div>
            <p className="text-sm text-theme-muted mb-4">Bir projeye atanmış, şu an çalışan ama üzerinde açık görevi bulunmayan kişiler (izinliler hariç).</p>
            {idle.length === 0 ? (
              <p className="text-sm text-theme-muted font-medium">Projelerdeki herkesin en az bir açık görevi var.</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {idle.map(({ user: u, done }) => chip(
                  u,
                  `${u.currentProject} · ${done > 0 ? `${done} görevi tamamlandı` : 'hiç görevi yok'}`,
                  isAdmin ? (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); actions.newTask(u.id); }}
                      className="ml-1 w-8 h-8 rounded-xl flex items-center justify-center text-theme-deep bg-theme-lightest hover:bg-theme-light transition-colors shrink-0"
                      aria-label={`${u.fullName} için görev ata`}
                      title="Görev ata"
                    >
                      <Plus size={15} weight="bold" />
                    </button>
                  ) : undefined,
                ))}
              </div>
            )}
          </section>

          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <Segmented<Filter>
              label="Proje aşaması"
              layoutId="project-filter"
              value={filter}
              onChange={setFilter}
              options={[{ value: 'ALL', label: 'Tümü', count: counts.ALL }, ...PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS[s].label, count: counts[s] }))]}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={FolderOpen} title="Bu aşamada proje yok" description="Farklı bir filtre seçin ya da yeni bir proje ekleyin." />
          ) : (
            <motion.div variants={listContainer} initial="hidden" animate="visible" className="grid md:grid-cols-2 gap-5 pb-10">
              {visible.map(p => {
                const list = members.get(p.name) ?? [];
                const progress = progressOf(p);
                const status = PROJECT_STATUS[p.status ?? 'AKTIF'];
                const due = p.deadline && p.status !== 'TAMAMLANDI' ? dueLabel(p.deadline) : null;
                const isDrop = dropTarget === `p-${p.id}`;
                return (
                  <motion.article
                    key={p.id}
                    variants={listItem}
                    layout
                    {...dropProps(`p-${p.id}`, p.name)}
                    onContextMenu={e => contextMenu(e, {
                      label: p.name,
                      items: [
                        { label: 'Detayları gör', icon: Eye, onSelect: () => setOpenId(p.id) },
                        isAdmin && { label: 'Bu projeye görev ata', icon: Plus, onSelect: () => actions.newTask(undefined, p.id) },
                      ],
                    })}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                    className={`relative bg-surface rounded-2xl p-5 border transition-[border-color,box-shadow] flex flex-col gap-4 ${
                      isDrop ? 'border-theme-medium shadow-glow' : 'border-theme-light hover:border-theme-dark/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-lg bg-theme-lightest flex items-center justify-center shrink-0">
                        <Briefcase size={18} weight="fill" style={{ color: projectColor(p.name) }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-theme-text tracking-tight truncate">{p.name}</h3>
                          <Pill className={status.className}><status.icon size={11} weight="bold" /> {status.label}</Pill>
                        </div>
                        {p.description && <p className="text-sm text-theme-muted mt-1 line-clamp-2">{p.description}</p>}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-2">
                        <span className="text-theme-muted">Görev ilerlemesi</span>
                        <span className="text-theme-text tabular">{progress ? `${progress.done}/${progress.total}` : 'Görev yok'}</span>
                      </div>
                      <ProgressBar value={progress ? progress.done / progress.total : 0} />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-3">
                        {list.length > 0 ? <AvatarStack users={list} /> : <span className="text-xs font-semibold text-theme-muted italic">Üye yok</span>}
                        <span className="text-xs font-semibold text-theme-muted flex items-center gap-1"><Users size={14} weight="bold" /> {list.length}</span>
                      </div>
                      {due && (
                        <span className={`text-xs font-bold flex items-center gap-1 ${due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}`}>
                          <CalendarBlank size={14} weight="bold" /> {due.text}
                        </span>
                      )}
                    </div>

                    <button onClick={() => setOpenId(p.id)} className="self-start -mx-1 px-1 rounded-md text-sm font-medium text-theme-deep hover:underline underline-offset-4 inline-flex items-center gap-1">
                      Ayrıntıları aç <CaretRight size={13} weight="bold" aria-hidden="true" />
                    </button>

                    <AnimatePresence>
                      {isDrop && dragUser && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 rounded-2xl bg-theme-lightest/90 flex items-center justify-center pointer-events-none"
                        >
                          <p className="text-sm font-bold text-theme-deep">{dragUser.fullName} → {p.name}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      <Menu open={!!menu} onClose={() => setMenu(null)} point={menu?.point} width={230} label="Çalışan işlemleri">
        {menu && (
          <AnimatePresence mode="wait" initial={false}>
            {menu.view === 'root' ? (
              <motion.div key="root" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.1 } }}>
                <div className="px-3 py-2 mb-1 border-b border-theme-light/50 flex items-center gap-2.5">
                  <Avatar user={menu.user} size="xs" />
                  <p className="text-sm font-bold text-theme-text truncate">{menu.user.fullName}</p>
                </div>
                <MenuItem icon={Briefcase} onSelect={() => setMenu({ ...menu, view: 'projects' })} trailing={<CaretRight size={14} weight="bold" />}>Projeye ata</MenuItem>
                <MenuItem icon={Plus} onSelect={() => { const u = menu.user; setMenu(null); actions.newTask(u.id); }}>Yeni görev ata</MenuItem>
                {menu.user.currentProject && (
                  <MenuItem icon={UserMinus} tone="danger" onSelect={() => { assign.mutate({ userId: menu.user.id, project: null }); setMenu(null); }}>Projeden çıkar</MenuItem>
                )}
              </motion.div>
            ) : (
              <motion.div key="projects" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, transition: { duration: 0.1 } }}>
                <MenuItem icon={CaretLeft} onSelect={() => setMenu({ ...menu, view: 'root' })}>Geri</MenuItem>
                <MenuDivider />
                <div className="max-h-64 overflow-y-auto scrollbar-thin">
                  {projects?.map(p => (
                    <MenuItem key={p.id} active={p.name === menu.user.currentProject} disabled={p.name === menu.user.currentProject}
                      onSelect={() => { assign.mutate({ userId: menu.user.id, project: p.name }); setMenu(null); }}>
                      {p.name}
                    </MenuItem>
                  ))}
                </div>
                <MenuDivider />
                <MenuItem icon={Plus} onSelect={() => { const u = menu.user; setMenu(null); actions.newProject(u); }}>Yeni proje oluştur</MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Menu>

      <ProjectDrawer
        project={openProject}
        members={openProject ? members.get(openProject.name) ?? [] : []}
        tasks={tasks ?? []}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
