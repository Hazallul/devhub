import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { getStoredUser } from '../lib/session';
import { useToast } from '../components/ui/Toast';
import type {
  User, Project, Task, TaskActivity, ActionLog, LeaveRequest, Announcement,
  UserStatus, TaskStatus, TaskPriority, ProjectStatus, LeaveType, LeaveState,
  Holiday, LeaveBalance, AppNotification, Role, MonitorOverview,
} from '../types';

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

// ---------- Queries ----------
// Durumlar başka ekranlarda değişebilir: ekip listesi 30 sn'de bir tazelenir.
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: get<User[]>('/users'), refetchInterval: 30_000 });
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: get<Project[]>('/projects') });
export const useAllTasks = () => useQuery({ queryKey: ['tasks'], queryFn: get<Task[]>('/tasks') });
export const useUserTasks = (userId: number, enabled = true) =>
  useQuery({ queryKey: ['tasks', 'user', userId], queryFn: get<Task[]>(`/tasks/user/${userId}`), enabled });
export const useTaskActivity = (taskId: number | null) =>
  useQuery({ queryKey: ['tasks', 'activity', taskId], queryFn: get<TaskActivity[]>(`/tasks/${taskId}/activity`), enabled: taskId !== null });
export const useLogs = (enabled = true) => useQuery({ queryKey: ['logs'], queryFn: get<ActionLog[]>('/logs'), enabled });
export const useLeaves = () => useQuery({ queryKey: ['leaves'], queryFn: get<LeaveRequest[]>('/leaves') });
export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: get<Announcement[]>('/announcements') });
export const useHolidays = () => useQuery({ queryKey: ['holidays'], queryFn: get<Holiday[]>('/holidays'), staleTime: 10 * 60_000 });
/** Yönetici herkesin, çalışan yalnızca kendi bakiyesini alır. */
export const useLeaveBalances = (year?: number) =>
  useQuery({ queryKey: ['leaves', 'balances', year ?? 'current'], queryFn: get<LeaveBalance[]>(`/leaves/balances${year ? `?year=${year}` : ''}`) });
export const useAdminUsers = (enabled = true) => useQuery({ queryKey: ['admin-users'], queryFn: get<User[]>('/admin/users'), enabled });
export const useNotifications = (enabled = true) =>
  useQuery({ queryKey: ['notifications', 'list'], queryFn: get<AppNotification[]>('/notifications?limit=30'), enabled });
export const useUnreadCount = () =>
  useQuery({ queryKey: ['notifications', 'unread'], queryFn: get<{ count: number }>('/notifications/unread-count'), refetchInterval: 30_000 });

/** Sistem İzleme: canlıyken 5 sn'de bir tazelenir (sunucu 10 sn'de bir örnekler); önceki veri yenisi gelene kadar ekranda kalır. */
export const useMonitoring = (minutes: number, live: boolean) =>
  useQuery({
    queryKey: ['monitoring', minutes],
    queryFn: get<MonitorOverview>(`/admin/monitoring?minutes=${minutes}`),
    refetchInterval: live ? 5_000 : false,
    placeholderData: prev => prev,
  });

/** Resmi tatil günleri (yyyy-MM-dd) ve adları; iş günü hesabında ve takvimde kullanılır. */
export function useHolidayMap() {
  const { data } = useHolidays();
  return useMemo(() => {
    const names = new Map<string, string>((data ?? []).map(h => [h.date, h.name]));
    return { names, set: new Set(names.keys()) as ReadonlySet<string> };
  }, [data]);
}

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

export const useChangePassword = () =>
  useAction(
    (body: { currentPassword: string; newPassword: string }) => api.put<User>('/users/me/password', body).then(r => r.data),
    { invalidate: [['users']], success: 'Şifreniz değiştirildi' },
  );

export interface UserInput {
  fullName: string; email: string; role: Role; jobTitle?: string; hireDate?: string; annualLeaveDays?: number; currentProject?: string;
}

export const useCreateUser = () =>
  useAction(
    (body: UserInput) => api.post<{ user: User; temporaryPassword: string }>('/admin/users', body).then(r => r.data),
    { invalidate: [['admin-users'], ['users'], ['leaves', 'balances']], success: ({ fullName }) => `${fullName} eklendi` },
  );

export const useUpdateUser = () =>
  useAction(
    ({ id, ...body }: Partial<UserInput> & { id: number }) => api.put<User>(`/admin/users/${id}`, body).then(r => r.data),
    { invalidate: [['admin-users'], ['users'], ['leaves', 'balances']], success: 'Kullanıcı güncellendi' },
  );

export const useSetUserActive = () =>
  useAction(
    ({ id, active }: { id: number; active: boolean }) => api.put<User>(`/admin/users/${id}/active`, { active }).then(r => r.data),
    { invalidate: [['admin-users'], ['users']], success: ({ active }) => (active ? 'Hesap yeniden aktifleştirildi' : 'Hesap pasifleştirildi') },
  );

export const useResetPassword = () =>
  useAction(
    (id: number) => api.post<{ temporaryPassword: string }>(`/admin/users/${id}/reset-password`).then(r => r.data),
    { invalidate: [['admin-users']] },
  );

export const useCreateHoliday = () =>
  useAction(
    (body: { date: string; name: string }) => api.post<Holiday>('/holidays', body).then(r => r.data),
    { invalidate: [['holidays'], ['leaves', 'balances']], success: 'Resmi tatil eklendi' },
  );

export const useDeleteHoliday = () =>
  useAction((id: number) => api.delete(`/holidays/${id}`), { invalidate: [['holidays'], ['leaves', 'balances']], success: 'Resmi tatil kaldırıldı' });

export const useMarkNotificationRead = () =>
  useAction((id: number) => api.put(`/notifications/${id}/read`), { invalidate: [['notifications']] });

export const useMarkAllNotificationsRead = () =>
  useAction(() => api.put('/notifications/read-all'), { invalidate: [['notifications']] });

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

/** Birden fazla kişi seçilirse her kişiye ayrı görev oluşur. projectId yalnızca yöneticide dikkate alınır (null = projesiz). */
export interface TaskInput {
  userIds: number[]; content: string; description?: string; priority?: TaskPriority; dueDate?: string; projectId?: number | null;
}

export const useCreateTask = () =>
  useAction(
    (body: TaskInput) => api.post<Task[]>('/tasks', body).then(r => r.data),
    { invalidate: [['tasks'], ['logs']], success: ({ userIds }) => (userIds.length > 1 ? `${userIds.length} kişiye görev atandı` : 'Görev eklendi') },
  );

type TaskPatch = {
  id: number; content?: string; description?: string | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null;
  userId?: number; projectId?: number | null;
};

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

export const useAddTaskComment = () =>
  useAction(
    ({ taskId, text }: { taskId: number; text: string }) => api.post<TaskActivity>(`/tasks/${taskId}/comments`, { text }).then(r => r.data),
    { invalidate: [['tasks']] },
  );

export const useDeleteTaskComment = () =>
  useAction(
    ({ taskId, commentId }: { taskId: number; commentId: number }) => api.delete(`/tasks/${taskId}/comments/${commentId}`),
    { invalidate: [['tasks']], success: 'Yorum silindi' },
  );

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
