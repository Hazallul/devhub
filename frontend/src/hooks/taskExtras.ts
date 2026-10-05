import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { useAction } from './api';
import { useToast } from '../components/ui/Toast';
import type { AttachmentInfo, Label, LabelColor, Subtask, Task, TaskDependencies } from '../types';

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

// ---------- Etiketler ----------
export const useLabels = () => useQuery({ queryKey: ['labels'], queryFn: get<Label[]>('/labels'), staleTime: 60_000 });

export const useCreateLabel = () =>
  useAction((body: { name: string; color?: LabelColor }) => api.post<Label>('/labels', body).then(r => r.data), { invalidate: [['labels']] });

export const useUpdateLabel = () =>
  useAction(({ id, ...body }: { id: number; name?: string; color?: LabelColor }) => api.put<Label>(`/labels/${id}`, body).then(r => r.data),
    { invalidate: [['labels']], success: 'Etiket güncellendi' });

export const useDeleteLabel = () =>
  useAction((id: number) => api.delete(`/labels/${id}`), { invalidate: [['labels'], ['tasks']], success: 'Etiket silindi' });

/** İyimser: etiketler kartta hemen değişir. */
export function useSetTaskLabels() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ taskId, labelIds }: { taskId: number; labelIds: number[] }) => api.put(`/tasks/${taskId}/labels`, { labelIds }),
    onMutate: async ({ taskId, labelIds }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      snapshot.forEach(([key, list]) => {
        if (Array.isArray(list)) qc.setQueryData<Task[]>(key, list.map(t => (t.id === taskId ? { ...t, labelIds } : t)));
      });
      return { snapshot };
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshot.forEach(([key, list]) => qc.setQueryData(key, list));
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', 'activity'] }),
  });
}

// ---------- Alt görevler ----------
export const useSubtasks = (taskId: number) =>
  useQuery({ queryKey: ['tasks', 'subtasks', taskId], queryFn: get<Subtask[]>(`/tasks/${taskId}/subtasks`) });

/** Alt görev değişince kartlardaki "2/5" ilerlemesi de tazelenir. */
const subtaskKeys = (taskId: number) => [['tasks', 'subtasks', taskId], ['tasks']];

export const useAddSubtask = (taskId: number) =>
  useAction((title: string) => api.post<Subtask>(`/tasks/${taskId}/subtasks`, { title }).then(r => r.data), { invalidate: subtaskKeys(taskId) });

export function useUpdateSubtask(taskId: number) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['tasks', 'subtasks', taskId];
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; title?: string; done?: boolean }) => api.put<Subtask>(`/tasks/subtasks/${id}`, body).then(r => r.data),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<Subtask[]>(key);
      if (before) qc.setQueryData<Subtask[]>(key, before.map(s => (s.id === id ? { ...s, ...patch } : s)));
      return { before };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
      toast.error(errorMessage(err));
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); },
  });
}

export const useDeleteSubtask = (taskId: number) =>
  useAction((id: number) => api.delete(`/tasks/subtasks/${id}`), { invalidate: subtaskKeys(taskId) });

export const useReorderSubtasks = (taskId: number) =>
  useAction((ids: number[]) => api.put(`/tasks/${taskId}/subtasks/order`, { ids }), { invalidate: [['tasks', 'subtasks', taskId]] });

// ---------- Bağımlılıklar ----------
export const useDependencies = (taskId: number) =>
  useQuery({ queryKey: ['tasks', 'dependencies', taskId], queryFn: get<TaskDependencies>(`/tasks/${taskId}/dependencies`) });

export const useAddDependency = (taskId: number) =>
  useAction((blockedById: number) => api.post(`/tasks/${taskId}/dependencies`, { blockedById }),
    { invalidate: [['tasks']], success: 'Bağımlılık eklendi' });

export const useRemoveDependency = (taskId: number) =>
  useAction((blockedById: number) => api.delete(`/tasks/${taskId}/dependencies/${blockedById}`), { invalidate: [['tasks']] });

// ---------- Dosya ekleri ----------
/** Görev ya da destek talebinin dosyaları (scope: 'tasks' | 'tickets'). */
export type AttachmentScope = 'tasks' | 'tickets';

export const useAttachments = (scope: AttachmentScope, id: number) =>
  useQuery({ queryKey: [scope, 'attachments', id], queryFn: get<AttachmentInfo[]>(`/${scope}/${id}/attachments`) });

export const useUploadAttachment = (scope: AttachmentScope, id: number) =>
  useAction((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/${scope}/${id}/attachments`, form);
  }, { invalidate: [[scope]], success: 'Dosya eklendi' });

export const useDeleteAttachment = () =>
  useAction((id: number) => api.delete(`/attachments/${id}`), { invalidate: [['tasks'], ['tickets']], success: 'Dosya silindi' });

/** Atanmamış görevi üstlen (çalışan kendine alır). */
export const useClaimTask = () =>
  useAction((id: number) => api.post<Task>(`/tasks/${id}/claim`).then(r => r.data), { invalidate: [['tasks'], ['logs']], success: 'Görev size atandı' });
