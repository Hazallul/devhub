import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, CaretDown, CaretRight, CaretLeft, DotsThree, Briefcase, UserMinus, ListDashes, CheckSquare, Envelope,
} from '@phosphor-icons/react';
import type { Task, User, UserStatus, TaskPriority } from '../../types';
import { Avatar, StatusBadge, Skeleton, PriorityBadge } from '../ui/primitives';
import { Menu, MenuItem, MenuLabel, MenuDivider } from '../ui/Menu';
import type { MenuPoint } from '../ui/Menu';
import TaskRow from '../tasks/TaskRow';
import { useMe, useProjects, useUpdateStatus, useAssignProject, useCreateTask, useUserTasks } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { USER_STATUS, TASK_PRIORITY, TASK_PRIORITIES, statusOptions, statusHint } from '../../lib/meta';

interface EmployeeCardProps {
  user: User;
  tasks?: Task[];
  isHighlighted?: boolean;
}

export default function EmployeeCard({ user, tasks: allTasks, isHighlighted = false }: EmployeeCardProps) {
  const me = useMe();
  const navigate = useNavigate();
  const controls = useAnimation();
  const actions = useQuickActions();
  const { data: projects } = useProjects();
  const updateStatus = useUpdateStatus();
  const assignProject = useAssignProject();
  const createTask = useCreateTask();

  const [expanded, setExpanded] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuPoint, setMenuPoint] = useState<MenuPoint | null>(null);
  const [menuView, setMenuView] = useState<'root' | 'projects'>('root');
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('ORTA');
  const [statusBtn, setStatusBtn] = useState<HTMLButtonElement | null>(null);
  const [moreBtn, setMoreBtn] = useState<HTMLButtonElement | null>(null);
  const newTaskRef = useRef<HTMLInputElement>(null);

  const isAdmin = me.role === 'ADMIN';
  const isSelf = me.id === user.id;
  const canEditStatus = isAdmin || isSelf;
  const canEditTasks = isAdmin || isSelf;
  const statuses: UserStatus[] = statusOptions(me, user);
  const hint = statusHint(me, user);

  // Açılınca kişinin görevleri; kapalıyken üstten gelen tüm görev listesi özet için kullanılır.
  const { data: fetchedTasks, isLoading: tasksLoading } = useUserTasks(user.id, expanded);
  const tasks = fetchedTasks ?? allTasks?.filter(t => t.userId === user.id);
  const openCount = tasks?.filter(t => t.status !== 'TAMAMLANDI').length ?? 0;
  const doneCount = tasks?.filter(t => t.status === 'TAMAMLANDI').length ?? 0;
  const urgent = tasks?.filter(t => t.status !== 'TAMAMLANDI' && t.priority === 'YUKSEK').length ?? 0;

  useEffect(() => {
    if (!isHighlighted) return;
    // Kaydırma bittiğinde çağrılır: kart hafifçe büyüyüp yerine oturur, çevresinde kısa bir ışık belirir.
    controls.start({
      scale: [1, 1.035, 1],
      boxShadow: ['0 0 0 0 rgba(156,171,132,0)', '0 0 0 5px rgba(156,171,132,0.35), 0 0 28px rgba(156,171,132,0.45)', '0 0 0 0 rgba(156,171,132,0)'],
      transition: {
        scale: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.45, 1] },
        boxShadow: { duration: 1.2, ease: 'easeInOut', times: [0, 0.3, 1] },
      },
    });
  }, [isHighlighted, controls]);

  const openMenuAt = (point: MenuPoint) => {
    setMenuView('root');
    setMenuPoint(point);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEditTasks && !isAdmin) return;
    e.preventDefault();
    openMenuAt({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenuPoint(null);

  const startNewTask = () => {
    closeMenu();
    setExpanded(true);
    setTimeout(() => newTaskRef.current?.focus(), 320);
  };

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newTask.trim();
    if (!content) return;
    createTask.mutate({ userId: user.id, content, priority: newPriority }, {
      onSuccess: () => { setNewTask(''); setNewPriority('ORTA'); },
    });
  };

  const selectStatus = (status: UserStatus) => {
    setStatusOpen(false);
    if (status === user.status) return;
    // İzinli durumu her zaman tarihli bir izin kaydına dayanır: önce tür ve tarih sorulur.
    if (status === 'IZINLI') actions.newLeave(user);
    else updateStatus.mutate({ userId: user.id, status });
  };

  const highlighted = isHighlighted || statusOpen || !!menuPoint;

  return (
    <motion.div
      layout="position"
      animate={controls}
      onContextMenu={handleContextMenu}
      className={`relative bg-white rounded-3xl border transition-colors ${
        highlighted ? 'border-theme-medium' : expanded ? 'border-theme-light' : 'border-theme-light/40 hover:border-theme-light'
      } ${expanded ? 'shadow-diffusion' : 'shadow-soft hover:shadow-diffusion'}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${user.fullName} görevlerini ${expanded ? 'gizle' : 'göster'}`}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); }
        }}
        className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 cursor-pointer rounded-3xl"
      >
        <Avatar user={user} />

        <div className="min-w-0 flex-1 sm:flex-none sm:w-56">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-theme-text tracking-tight truncate">{user.fullName}</h3>
            {isSelf && <span className="hidden sm:inline text-[10px] font-bold uppercase bg-theme-lightest text-theme-deep px-1.5 py-0.5 rounded-md shrink-0">Sen</span>}
            {user.role === 'ADMIN' && <span className="hidden sm:inline text-[10px] font-bold uppercase bg-theme-deep text-white px-1.5 py-0.5 rounded-md shrink-0">Yönetici</span>}
          </div>
          <p className="text-xs text-theme-muted font-medium truncate">{user.jobTitle || 'Çalışan'}</p>
        </div>

        <div className="hidden md:block w-44 min-w-0">
          <p className="eyebrow mb-0.5">Proje</p>
          {user.currentProject ? (
            <button
              onClick={e => { e.stopPropagation(); navigate('/projects', { state: { openProjectName: user.currentProject } }); }}
              className="text-sm text-theme-text font-semibold truncate max-w-full hover:text-theme-deep hover:underline underline-offset-4 decoration-theme-medium text-left"
            >
              {user.currentProject}
            </button>
          ) : (
            <p className="text-sm text-theme-muted font-medium italic">Boşta</p>
          )}
        </div>

        <div className="hidden lg:block w-36">
          <p className="eyebrow mb-1">Görevler</p>
          {tasks ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-theme-text tabular">
              <span title="Açık görev">{openCount} açık</span>
              {urgent > 0 && <span className="text-[11px] font-bold text-[#8A4B2A] bg-[#F3E1D6] px-1.5 rounded-md" title="Yüksek öncelikli">{urgent}!</span>}
              {doneCount > 0 && <span className="text-theme-muted font-medium text-xs">· {doneCount} bitti</span>}
            </div>
          ) : <span className="text-sm text-theme-muted">—</span>}
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            ref={setStatusBtn}
            onClick={e => { e.stopPropagation(); if (canEditStatus) setStatusOpen(o => !o); }}
            disabled={!canEditStatus}
            aria-haspopup={canEditStatus ? 'menu' : undefined}
            aria-expanded={statusOpen}
            aria-label={`Durum: ${user.status ? USER_STATUS[user.status].label : 'belirtilmedi'}${canEditStatus ? ', değiştir' : ''}`}
            className={`rounded-full ${canEditStatus ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <StatusBadge status={user.status} interactive={canEditStatus} />
          </button>

          {(canEditTasks || isAdmin) && (
            <button
              ref={setMoreBtn}
              onClick={e => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                openMenuAt({ x: r.right - 230, y: r.bottom + 8 });
              }}
              className="icon-btn"
              aria-label={`${user.fullName} için işlemler`}
              aria-haspopup="menu"
            >
              <DotsThree size={22} weight="bold" />
            </button>
          )}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="hidden sm:flex w-8 h-8 items-center justify-center text-theme-muted" aria-hidden="true">
            <CaretDown size={18} weight="bold" />
          </motion.span>
        </div>
      </div>

      {/* Durum menüsü */}
      <Menu open={statusOpen} onClose={() => setStatusOpen(false)} anchor={statusBtn} width={200} label="Durum seç">
        <MenuLabel>Durumu değiştir</MenuLabel>
        {statuses.map(s => (
          <MenuItem key={s} icon={USER_STATUS[s].icon} active={s === user.status} onSelect={() => selectStatus(s)}>
            {USER_STATUS[s].label}
          </MenuItem>
        ))}
        {hint && <p className="text-[11px] text-theme-muted font-medium px-3 pt-2 pb-1 leading-snug">{hint}</p>}
      </Menu>

      {/* Sağ tık / ⋯ menüsü */}
      <Menu open={!!menuPoint} onClose={closeMenu} point={menuPoint} anchor={moreBtn} width={230} label={`${user.fullName} işlemleri`}>
        <AnimatePresence mode="wait" initial={false}>
          {menuView === 'root' ? (
            <motion.div key="root" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.1 } }}>
              <div className="px-3 py-2 mb-1 border-b border-theme-light/50 flex items-center gap-2.5">
                <Avatar user={user} size="xs" />
                <p className="text-sm font-bold text-theme-text truncate">{user.fullName}</p>
              </div>
              {canEditTasks && (
                <MenuItem icon={Plus} onSelect={startNewTask}>{isSelf ? 'Yeni görev ekle' : 'Yeni görev ata'}</MenuItem>
              )}
              {isAdmin && (
                <MenuItem icon={CheckSquare} onSelect={() => { closeMenu(); actions.newTask(user.id); }}>Detaylı görev ata…</MenuItem>
              )}
              {isAdmin && <>
                <MenuDivider />
                <MenuItem icon={Briefcase} onSelect={() => setMenuView('projects')} trailing={<CaretRight size={14} weight="bold" />}>
                  {user.currentProject ? 'Başka projeye ata' : 'Projeye ata'}
                </MenuItem>
                {user.currentProject && (
                  <MenuItem icon={UserMinus} tone="danger" onSelect={() => { closeMenu(); assignProject.mutate({ userId: user.id, project: null }); }}>
                    Projeden çıkar
                  </MenuItem>
                )}
              </>}
              <MenuDivider />
              <MenuItem icon={Envelope} onSelect={() => { closeMenu(); window.location.href = `mailto:${user.email}`; }}>E-posta gönder</MenuItem>
            </motion.div>
          ) : (
            <motion.div key="projects" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, transition: { duration: 0.1 } }}>
              <MenuItem icon={CaretLeft} onSelect={() => setMenuView('root')}>Geri</MenuItem>
              <MenuDivider />
              <div className="max-h-64 overflow-y-auto scrollbar-thin">
                {projects?.map(p => (
                  <MenuItem
                    key={p.id}
                    active={p.name === user.currentProject}
                    disabled={p.name === user.currentProject}
                    onSelect={() => { closeMenu(); assignProject.mutate({ userId: user.id, project: p.name }); }}
                  >
                    {p.name}
                  </MenuItem>
                ))}
              </div>
              <MenuDivider />
              <MenuItem icon={Plus} onSelect={() => { closeMenu(); actions.newProject(user); }}>Yeni proje oluştur</MenuItem>
            </motion.div>
          )}
        </AnimatePresence>
      </Menu>

      {/* Görevler (akordeon) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="tasks"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { type: 'spring', stiffness: 260, damping: 30 }, opacity: { duration: 0.2, delay: 0.05 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.2 }, opacity: { duration: 0.1 } } }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5">
              <div className="border-t border-theme-light/40 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-theme-deep flex items-center gap-2">
                    <ListDashes size={16} weight="bold" aria-hidden="true" />
                    Görevler
                  </h4>
                  {tasks && tasks.length > 0 && (
                    <span className="text-xs font-semibold text-theme-muted tabular">{doneCount}/{tasks.length} tamamlandı</span>
                  )}
                </div>

                {canEditTasks && (
                  <form onSubmit={submitTask} className="flex flex-col sm:flex-row gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      ref={newTaskRef}
                      value={newTask}
                      onChange={e => setNewTask(e.target.value)}
                      placeholder={isSelf ? 'Yeni görev ekle…' : `${user.fullName.split(' ')[0]} için görev yaz…`}
                      aria-label="Yeni görev"
                      className="flex-1 px-4 py-2.5 rounded-2xl bg-theme-cream border border-theme-light/60 focus:outline-none focus:ring-2 focus:ring-theme-medium text-sm font-medium text-theme-text"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newPriority}
                        onChange={e => setNewPriority(e.target.value as TaskPriority)}
                        aria-label="Öncelik"
                        className="px-3 py-2.5 rounded-2xl bg-theme-cream border border-theme-light/60 text-sm font-semibold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium"
                      >
                        {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
                      </select>
                      <button type="submit" disabled={createTask.isPending || !newTask.trim()} className="btn-primary px-4 min-h-[42px]">
                        <Plus size={16} weight="bold" /> Ekle
                      </button>
                    </div>
                  </form>
                )}

                {tasksLoading && !tasks ? (
                  <div className="flex flex-col gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                ) : !tasks || tasks.length === 0 ? (
                  <p className="text-sm text-theme-muted font-medium py-3 text-center">Henüz görev yok.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
                    <AnimatePresence initial={false}>
                      {[...tasks]
                        .sort((a, b) => Number(a.status === 'TAMAMLANDI') - Number(b.status === 'TAMAMLANDI'))
                        .map(t => <TaskRow key={t.id} task={t} canEdit={canEditTasks} />)}
                    </AnimatePresence>
                  </div>
                )}
                {tasks && urgent > 0 && (
                  <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5"><PriorityBadge priority="YUKSEK" /> {urgent} yüksek öncelikli görev açık.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
