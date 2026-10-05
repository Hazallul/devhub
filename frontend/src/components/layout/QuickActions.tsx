import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMe } from '../../hooks/api';
import { ProjectFormModal, LeaveFormModal, AnnouncementFormModal } from '../forms/FormModals';
import TaskFormModal from '../tasks/TaskFormModal';
import TaskDrawer from '../tasks/TaskDrawer';
import LogsModal from './LogsModal';
import type { User } from '../../types';

interface QuickActionsApi {
  /**
   * userId: kişi önceden seçili gelir; projectId: proje önceden seçili gelir (liste o projenin ekibini gösterir);
   * unassigned: yönetici için "Şimdilik kimseye atama" işaretli açılır.
   */
  newTask: (userId?: number, projectId?: number, opts?: { unassigned?: boolean }) => void;
  newProject: (assignUser?: User | null) => void;
  /** forUser: yönetici başka biri adına onaylı izin kaydı açar. */
  newLeave: (forUser?: User) => void;
  newAnnouncement: () => void;
  openLogs: () => void;
  /** Görev ayrıntı panelini açar (geçmiş ve yorumlar dahil). */
  openTask: (taskId: number) => void;
}

const Ctx = createContext<QuickActionsApi | null>(null);

type Open =
  | { kind: 'task'; userId?: number; projectId?: number; unassigned?: boolean }
  | { kind: 'project'; assignUser?: User | null }
  | { kind: 'leave'; forUser?: User }
  | { kind: 'announcement' }
  | { kind: 'logs' }
  | null;

/** Uygulamanın her yerinden açılabilen modallar tek bir yerde yönetilir. */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useMe().role === 'ADMIN';
  const close = useCallback(() => setOpen(null), []);
  const closeTask = useCallback(() => setTaskId(null), []);

  // Bildirimlerdeki "?task=ID" bağlantısı hangi sayfada olursa olsun görevi açar; parametre adres çubuğundan temizlenir.
  const linkedTask = params.get('task');
  useEffect(() => {
    if (!linkedTask) return;
    const id = Number(linkedTask);
    if (Number.isInteger(id) && id > 0) setTaskId(id);
    setParams(p => { p.delete('task'); return p; }, { replace: true });
  }, [linkedTask, setParams]);

  const api = useMemo<QuickActionsApi>(() => ({
    newTask: (userId, projectId, opts) => setOpen({ kind: 'task', userId, projectId, unassigned: opts?.unassigned }),
    newProject: assignUser => setOpen({ kind: 'project', assignUser }),
    newLeave: forUser => setOpen({ kind: 'leave', forUser }),
    newAnnouncement: () => setOpen({ kind: 'announcement' }),
    // Yönetici ayrıntılı log sayfasına gider; çalışan ekip akışını pencerede görür.
    openLogs: () => (isAdmin ? navigate('/logs') : setOpen({ kind: 'logs' })),
    openTask: id => setTaskId(id),
  }), [isAdmin, navigate]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <TaskDrawer taskId={taskId} onClose={closeTask} />
      <TaskFormModal
        open={open?.kind === 'task'}
        onClose={close}
        defaultUserId={open?.kind === 'task' ? open.userId : undefined}
        defaultProjectId={open?.kind === 'task' ? open.projectId : undefined}
        defaultUnassigned={open?.kind === 'task' ? open.unassigned : undefined}
      />
      <ProjectFormModal open={open?.kind === 'project'} onClose={close} assignUser={open?.kind === 'project' ? open.assignUser : null} />
      <LeaveFormModal open={open?.kind === 'leave'} onClose={close} forUser={open?.kind === 'leave' ? open.forUser : null} />
      <AnnouncementFormModal open={open?.kind === 'announcement'} onClose={close} />
      <LogsModal open={open?.kind === 'logs'} onClose={close} />
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useQuickActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQuickActions, QuickActionsProvider içinde kullanılmalı');
  return ctx;
}
