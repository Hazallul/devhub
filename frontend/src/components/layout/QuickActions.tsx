import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TaskFormModal, ProjectFormModal, LeaveFormModal, AnnouncementFormModal } from '../forms/FormModals';
import LogsModal from './LogsModal';
import type { User } from '../../types';

interface QuickActionsApi {
  newTask: (userId?: number) => void;
  newProject: (assignUser?: User | null) => void;
  /** forUser: yönetici başka biri adına onaylı izin kaydı açar. */
  newLeave: (forUser?: User) => void;
  newAnnouncement: () => void;
  openLogs: () => void;
}

const Ctx = createContext<QuickActionsApi | null>(null);

type Open =
  | { kind: 'task'; userId?: number }
  | { kind: 'project'; assignUser?: User | null }
  | { kind: 'leave'; forUser?: User }
  | { kind: 'announcement' }
  | { kind: 'logs' }
  | null;

/** Uygulamanın her yerinden açılabilen modallar tek bir yerde yönetilir. */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);

  const api = useMemo<QuickActionsApi>(() => ({
    newTask: userId => setOpen({ kind: 'task', userId }),
    newProject: assignUser => setOpen({ kind: 'project', assignUser }),
    newLeave: forUser => setOpen({ kind: 'leave', forUser }),
    newAnnouncement: () => setOpen({ kind: 'announcement' }),
    openLogs: () => setOpen({ kind: 'logs' }),
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      <TaskFormModal open={open?.kind === 'task'} onClose={close} defaultUserId={open?.kind === 'task' ? open.userId : undefined} />
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
