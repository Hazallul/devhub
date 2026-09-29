import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { getStoredUser } from '../lib/session';
import { useToast } from '../components/ui/Toast';
import type {
  User, Project, Task, ActionLog, LeaveRequest, Announcement,
  UserStatus, TaskStatus, TaskPriority, ProjectStatus, LeaveType, LeaveState,
} from '../types';

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

// ---------- Queries ----------
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: get<User[]>('/users') });
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: get<Project[]>('/projects') });
export const useAllTasks = () => useQuery({ queryKey: ['tasks'], queryFn: get<Task[]>('/tasks') });
export const useUserTasks = (userId: number, enabled = true) =>
  useQuery({ queryKey: ['tasks', 'user', userId], queryFn: get<Task[]>(`/tasks/user/${userId}`), enabled });
export const useLogs = (enabled = true) => useQuery({ queryKey: ['logs'], queryFn: get<ActionLog[]>('/logs'), enabled });
export const useLeaves = () => useQuery({ queryKey: ['leaves'], queryFn: get<LeaveRequest[]>('/leaves') });
export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: get<Announcement[]>('/announcements') });

/** Oturumdaki kullanıcı; kullanıcı listesi yüklendiyse en güncel hali döner. */
export function useMe(): User {
  const stored = getStoredUser()!;
  const { data } = useUsers();
  return data?.find(u => u.id === stored.id) ?? stored;
}

// ---------- Mutations ----------
function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { invalidate: string[][]; success?: string | ((vars: TVars) => string) },
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      opts.invalidate.forEach(queryKey => qc.invalidateQueries({ queryKey }));
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(vars) : opts.success);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export const useUpdateStatus = () =>
  useAction(
    ({ userId, status }: { userId: number; status: UserStatus }) => api.put(`/users/${userId}/status`, { status }),
    // İzinli'ye giriş/çıkış sunucuda izin kayıtlarını da günceller.
    { invalidate: [['users'], ['logs'], ['leaves']] },
  );

export const useAssignProject = () =>
  useAction(
    ({ userId, project }: { userId: number; project: string | null }) =>
      api.put(`/users/${userId}/project`, { currentProject: project }),
    {
      invalidate: [['users'], ['logs']],
      success: ({ project }) => (project ? `"${project}" projesine atandı` : 'Projeden çıkarıldı'),
    },
  );

export const useUpdateProfile = () =>
  useAction(
    ({ userId, ...body }: { userId: number; fullName: string; jobTitle: string; avatarColor: string }) =>
      api.put<User>(`/users/${userId}/profile`, body).then(r => r.data),
    { invalidate: [['users']], success: 'Profil güncellendi' },
  );

export interface ProjectInput { name: string; description?: string; deadline?: string; status?: ProjectStatus }

export const useCreateProject = () =>
  useAction(
    (body: ProjectInput) => api.post<Project>('/projects', body).then(r => r.data),
    { invalidate: [['projects'], ['logs']], success: ({ name }) => `"${name}" projesi oluşturuldu` },
  );

export const useUpdateProject = () =>
  useAction(
    ({ id, ...body }: ProjectInput & { id: number }) => api.put<Project>(`/projects/${id}`, body).then(r => r.data),
    { invalidate: [['projects'], ['users']], success: 'Proje güncellendi' },
  );

export interface TaskInput { userId: number; content: string; priority?: TaskPriority; dueDate?: string }

export const useCreateTask = () =>
  useAction(
    ({ userId, ...body }: TaskInput) => api.post<Task>(`/tasks/user/${userId}`, body).then(r => r.data),
    { invalidate: [['tasks'], ['logs']], success: 'Görev eklendi' },
  );

type TaskPatch = { id: number; content?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null };

/** İyimser güncelleme: kart sunucu yanıtını beklemeden yeni sütununa kayar, hata olursa geri alınır. */
export function useUpdateTask() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, ...body }: TaskPatch) => api.put<Task>(`/tasks/${id}`, body).then(r => r.data),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      snapshot.forEach(([key, list]) => {
        if (list) qc.setQueryData<Task[]>(key, list.map(t => (t.id === id ? { ...t, ...patch } : t)));
      });
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, list]) => qc.setQueryData(key, list));
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export const useDeleteTask = () =>
  useAction((id: number) => api.delete(`/tasks/${id}`), { invalidate: [['tasks']], success: 'Görev silindi' });

export const useCreateLeave = () =>
  useAction(
    // userId: yönetici başka biri adına doğrudan onaylı izin kaydı açar (bugünü kapsıyorsa kişi İzinli olur).
    (body: { type: LeaveType; startDate: string; endDate: string; note?: string; userId?: number }) => api.post('/leaves', body),
    {
      invalidate: [['leaves'], ['users'], ['logs']],
      success: ({ userId }) => (userId ? 'İzin kaydedildi' : 'İzin talebiniz yöneticiye iletildi'),
    },
  );

export const useDecideLeave = () =>
  useAction(
    ({ id, decision }: { id: number; decision: Exclude<LeaveState, 'BEKLIYOR'> }) =>
      api.put(`/leaves/${id}/decision`, { decision }),
    {
      invalidate: [['leaves'], ['users'], ['logs']],
      success: ({ decision }) => `${decision === 'ONAYLANDI' ? 'İzin onaylandı' : 'İzin reddedildi'}; kesinleştirene kadar geri alabilirsiniz`,
    },
  );

/** Kesinleşmemiş onay/ret kararını geri alır; talep tekrar onay bekler. */
export const useUndoLeaveDecision = () =>
  useAction((id: number) => api.put(`/leaves/${id}/undo`), {
    invalidate: [['leaves'], ['users'], ['logs']],
    success: 'Karar geri alındı; talep tekrar onay bekliyor',
  });

/** Kararı kalıcı yapar; sonrasında geri alınamaz. */
export const useFinalizeLeaveDecision = () =>
  useAction((id: number) => api.put(`/leaves/${id}/finalize`), {
    invalidate: [['leaves']],
    success: 'Karar kesinleştirildi',
  });

export const useWithdrawLeave = () =>
  useAction((id: number) => api.delete(`/leaves/${id}`), { invalidate: [['leaves']], success: 'Talep geri çekildi' });

export const useCreateAnnouncement = () =>
  useAction(
    (body: { title: string; content: string; pinned: boolean }) => api.post('/announcements', body),
    { invalidate: [['announcements']], success: 'Duyuru yayınlandı' },
  );

export const useDeleteAnnouncement = () =>
  useAction((id: number) => api.delete(`/announcements/${id}`), { invalidate: [['announcements']], success: 'Duyuru kaldırıldı' });
