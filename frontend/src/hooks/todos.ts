import { useMutation, useQuery, useQueryClient, useIsMutating } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { useToast } from '../components/ui/Toast';
import { scheduleDelete, usePendingDeletes, UNDO_MS } from '../lib/pendingDelete';
import type { TodoComment, TodoData, TodoItem, TodoList, TodoListRole, TodoRepeat, TodoStep } from '../types';

/*
 * Kişisel alan verisi. "Kaydet" düğmesi yoktur: her değişiklik önce ekrana (iyimser), sonra sunucuya yazılır;
 * sunucu reddederse ekran eski hâline döner ve hata gösterilir.
 */

const KEY = ['todos'];
const MUTATION = ['todos-write'];

// Ortak listelerde başkalarının yaptığı değişiklikler de görünsün diye düzenli tazelenir.
export const useTodos = () => {
  // Silinmek üzere bekleyen ("Geri al" süresi dolmamış) kartlar görünmez.
  const hidden = usePendingDeletes();
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<TodoData>('/todos')).data,
    refetchInterval: 20_000,
    select: d => (hidden.size ? { ...d, items: d.items.filter(i => !hidden.has(`todo:${i.id}`)) } : d),
  });
};

/** Kenar çubuğundaki rozet: açılmamış gelen kart sayısı */
export const useTodoUnseen = () =>
  useQuery({ queryKey: ['todos', 'unseen'], queryFn: async () => (await api.get<{ count: number }>('/todos/unseen-count')).data, refetchInterval: 30_000 });

/** Bekleyen yazma var mı ("Kaydediliyor…" göstergesi için) */
export const useTodoSaving = () => useIsMutating({ mutationKey: MUTATION }) > 0;

interface Options<V, R> {
  /** istek gitmeden ekrana uygulanır */
  optimistic?: (data: TodoData, vars: V) => TodoData;
  /** sunucu yanıtıyla ekrana uygulanır (ör. yeni kaydın id'si) */
  apply?: (data: TodoData, result: R, vars: V) => TodoData;
  success?: (result: R, vars: V) => string;
}

function useTodoMutation<V, R = unknown>(fn: (vars: V) => Promise<R>, opts: Options<V, R> = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: MUTATION,
    mutationFn: fn,
    onMutate: async (vars: V) => {
      if (!opts.optimistic) return { prev: undefined };
      await qc.cancelQueries({ queryKey: KEY, exact: true });
      const prev = qc.getQueryData<TodoData>(KEY);
      if (prev) qc.setQueryData<TodoData>(KEY, opts.optimistic(prev, vars));
      return { prev };
    },
    onSuccess: (result, vars) => {
      if (opts.apply) qc.setQueryData<TodoData>(KEY, d => (d ? opts.apply!(d, result, vars) : d));
      if (opts.success) toast.success(opts.success(result, vars));
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error(errorMessage(err));
    },
    // Art arda gelen yazmalarda yalnızca sonuncusundan sonra tazele (ara tazelemeler ekranı geri sardırmasın).
    onSettled: () => {
      if (qc.isMutating({ mutationKey: MUTATION }) !== 1) return;
      qc.invalidateQueries({ queryKey: KEY });
      // Göreve bağlı kart tamamlanınca DevHub görevi de tamamlanır.
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

const mapItem = (d: TodoData, id: number, fn: (i: TodoItem) => TodoItem): TodoData => ({ ...d, items: d.items.map(i => (i.id === id ? fn(i) : i)) });

// ---------------- kartlar ----------------

export interface NewTodo {
  title: string; listId?: number | null; myDay?: boolean; important?: boolean; dueDate?: string | null;
  dueTime?: string | null; repeatRule?: TodoRepeat | null;
  /** Kişinin kendi DevHub görevi: kart o göreve bağlanır */
  taskId?: number;
}

export const useCreateTodo = () =>
  useTodoMutation<NewTodo, TodoItem>(
    body => api.post<TodoItem>('/todos/items', body).then(r => r.data),
    { apply: (d, item) => ({ ...d, items: [item, ...d.items.filter(i => i.id !== item.id)] }) },
  );

export type TodoPatch = { id: number } & Partial<Pick<TodoItem, 'title' | 'note' | 'done' | 'important' | 'myDay' | 'dueDate' | 'dueTime' | 'repeatRule' | 'listId' | 'seen'>>;

export const useUpdateTodo = () =>
  useTodoMutation<TodoPatch>(
    ({ id, ...body }) => api.put(`/todos/items/${id}`, body),
    {
      optimistic: (d, { id, ...patch }) => mapItem(d, id, i => ({
        ...i, ...patch,
        doneAt: patch.done === undefined ? i.doneAt : patch.done ? new Date().toISOString() : null,
        ...(patch.done === false ? { doneById: null, doneByName: null } : {}),
      })),
    },
  );

export const useDeleteTodo = () =>
  useTodoMutation<number>(id => api.delete(`/todos/items/${id}`), { optimistic: (d, id) => ({ ...d, items: d.items.filter(i => i.id !== id) }) });

/** Sağ tık menüsünden silme: onay sormaz ama birkaç saniye "Geri al" sunar. */
export function useDeleteTodoWithUndo() {
  const qc = useQueryClient();
  const toast = useToast();
  return (id: number) => {
    const undo = scheduleDelete(`todo:${id}`, () => api.delete(`/todos/items/${id}`), error => {
      if (error) toast.error(errorMessage(error));
      return qc.invalidateQueries({ queryKey: KEY });
    });
    toast.success('Kart silindi', { label: 'Geri al', onClick: undo, duration: UNDO_MS });
  };
}

export const useClearCompleted = () =>
  useTodoMutation<number[]>(
    ids => api.delete(`/todos/items?ids=${ids.join(',')}`),
    { optimistic: (d, ids) => ({ ...d, items: d.items.filter(i => !ids.includes(i.id)) }), success: (_r, ids) => `${ids.length} tamamlanan kart silindi` },
  );

/** ids: görünen sırayla kart id'leri; konumlar bu sıraya göre verilir. */
export const useReorderTodos = () =>
  useTodoMutation<number[]>(
    ids => api.put('/todos/items/reorder', { ids }),
    {
      optimistic: (d, ids) => {
        const pos = new Map(ids.map((id, i) => [id, i]));
        return { ...d, items: d.items.map(i => (pos.has(i.id) ? { ...i, position: pos.get(i.id)! } : i)) };
      },
    },
  );

export const useSendTodo = () =>
  useTodoMutation<{ id: number; userIds: number[]; message?: string }, { sent: number; names: string[] }>(
    ({ id, ...body }) => api.post(`/todos/items/${id}/send`, body).then(r => r.data),
    { success: r => (r.sent === 1 ? `${r.names[0]} kişisine gönderildi` : `${r.sent} kişiye gönderildi`) },
  );

// ---------------- adımlar ----------------

export const useAddStep = () =>
  useTodoMutation<{ itemId: number; title: string }, TodoStep>(
    ({ itemId, title }) => api.post<TodoStep>(`/todos/items/${itemId}/steps`, { title }).then(r => r.data),
    { apply: (d, step, { itemId }) => mapItem(d, itemId, i => ({ ...i, steps: [...i.steps.filter(s => s.id !== step.id), step] })) },
  );

export const useUpdateStep = () =>
  useTodoMutation<{ itemId: number; id: number; title?: string; done?: boolean }>(
    ({ id, itemId: _itemId, ...body }) => api.put(`/todos/steps/${id}`, body),
    { optimistic: (d, { itemId, id, ...patch }) => mapItem(d, itemId, i => ({ ...i, steps: i.steps.map(s => (s.id === id ? { ...s, ...patch } : s)) })) },
  );

export const useDeleteStep = () =>
  useTodoMutation<{ itemId: number; id: number }>(
    ({ id }) => api.delete(`/todos/steps/${id}`),
    { optimistic: (d, { itemId, id }) => mapItem(d, itemId, i => ({ ...i, steps: i.steps.filter(s => s.id !== id) })) },
  );

// ---------------- yorumlar ----------------
// Yorumlar ['todos', 'comments', id] anahtarında durur; her yazmadan sonra ['todos'] ön ekiyle birlikte tazelenir.

export const useTodoComments = (itemId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['todos', 'comments', itemId],
    queryFn: async () => (await api.get<TodoComment[]>(`/todos/items/${itemId}/comments`)).data,
    enabled,
    refetchInterval: 20_000,
  });

export const useAddTodoComment = () =>
  useTodoMutation<{ itemId: number; body: string }, TodoComment>(
    ({ itemId, body }) => api.post<TodoComment>(`/todos/items/${itemId}/comments`, { body }).then(r => r.data),
    { optimistic: (d, { itemId }) => mapItem(d, itemId, i => ({ ...i, commentCount: i.commentCount + 1 })) },
  );

export const useDeleteTodoComment = () =>
  useTodoMutation<{ itemId: number; id: number }>(
    ({ id }) => api.delete(`/todos/comments/${id}`),
    { optimistic: (d, { itemId }) => mapItem(d, itemId, i => ({ ...i, commentCount: Math.max(0, i.commentCount - 1) })) },
  );

// ---------------- listeler ----------------

export const useCreateTodoList = () =>
  useTodoMutation<{ name: string; color?: string }, TodoList>(
    body => api.post<TodoList>('/todos/lists', body).then(r => r.data),
    { apply: (d, list) => ({ ...d, lists: [...d.lists.filter(l => l.id !== list.id), list] }) },
  );

export const useUpdateTodoList = () =>
  useTodoMutation<{ id: number; name?: string; color?: string }>(
    ({ id, ...body }) => api.put(`/todos/lists/${id}`, body),
    { optimistic: (d, { id, ...patch }) => ({ ...d, lists: d.lists.map(l => (l.id === id ? { ...l, ...patch } : l)) }) },
  );

export const useDeleteTodoList = () =>
  useTodoMutation<number>(
    id => api.delete(`/todos/lists/${id}`),
    { optimistic: (d, id) => ({ lists: d.lists.filter(l => l.id !== id), items: d.items.filter(i => i.listId !== id) }), success: () => 'Liste silindi' },
  );

// ---------------- ortak liste üyeleri ----------------

const replaceList = (d: TodoData, list: TodoList): TodoData => ({ ...d, lists: d.lists.map(l => (l.id === list.id ? list : l)) });

export const useAddListMembers = () =>
  useTodoMutation<{ id: number; userIds: number[] }, TodoList>(
    ({ id, userIds }) => api.post<TodoList>(`/todos/lists/${id}/members`, { userIds }).then(r => r.data),
    { apply: replaceList, success: (_l, { userIds }) => (userIds.length === 1 ? 'Kişi listeye eklendi' : `${userIds.length} kişi listeye eklendi`) },
  );

export const useSetListRole = () =>
  useTodoMutation<{ id: number; userId: number; role: TodoListRole }, TodoList>(
    ({ id, userId, role }) => api.put<TodoList>(`/todos/lists/${id}/members/${userId}`, { role }).then(r => r.data),
    { apply: replaceList, success: (_l, { role }) => (role === 'ADMIN' ? 'Yöneticilik verildi' : 'Yöneticilik alındı') },
  );

/** self: kişi kendisi ayrılıyor (liste ve kartları onun ekranından kalkar). */
export const useRemoveListMember = () =>
  useTodoMutation<{ id: number; userId: number; self: boolean }>(
    ({ id, userId }) => api.delete(`/todos/lists/${id}/members/${userId}`),
    {
      optimistic: (d, { id, userId, self }) => (self
        ? { lists: d.lists.filter(l => l.id !== id), items: d.items.filter(i => i.listId !== id) }
        : { ...d, lists: d.lists.map(l => (l.id === id ? { ...l, members: l.members.filter(m => m.userId !== userId) } : l)) }),
      success: (_r, { self }) => (self ? 'Listeden ayrıldınız' : 'Kişi listeden çıkarıldı'),
    },
  );
