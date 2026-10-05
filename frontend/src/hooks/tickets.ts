import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAction } from './api';
import { livePoll } from '../lib/realtime';

export type TicketType = 'ARIZA' | 'ERISIM' | 'EKIPMAN' | 'DIGER';
export type TicketPriority = 'DUSUK' | 'NORMAL' | 'YUKSEK' | 'ACIL';
export type TicketStatus = 'YENI' | 'INCELENIYOR' | 'YANIT_BEKLENIYOR' | 'COZULDU' | 'KAPANDI';

export interface Ticket {
  id: number; number: string; title: string; description: string | null;
  type: TicketType; priority: TicketPriority; status: TicketStatus;
  assigneeId: number | null; assigneeName: string | null; requesterId: number | null; requesterName: string | null;
  projectId: number | null; taskId: number | null; taskStatus: string | null;
  /** Çözüm hedefi (UTC) */
  dueAt: string | null; overdue: boolean;
  firstResponseAt: string | null; resolvedAt: string | null; closedAt: string | null; createdAt: string; updatedAt: string;
  commentCount: number; attachmentCount: number;
}

export interface TicketActivity { id: number; actorId: number | null; actorName: string | null; actorAvatarColor: string | null; kind: 'EVENT' | 'COMMENT'; message: string; createdAt: string }

export interface TicketInput {
  title: string; description?: string; type: TicketType; priority: TicketPriority;
  assigneeId?: number | null; projectId?: number | null;
}

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

export const useTickets = () => useQuery({ queryKey: ['tickets'], queryFn: get<Ticket[]>('/tickets'), refetchInterval: livePoll(60_000) });
export const useTicketActivity = (id: number) => useQuery({ queryKey: ['tickets', 'activity', id], queryFn: get<TicketActivity[]>(`/tickets/${id}/activity`) });

export const useCreateTicket = () =>
  useAction((body: TicketInput) => api.post<Ticket>('/tickets', body).then(r => r.data), { invalidate: [['tickets']], success: t => `Talep açıldı: ${t.title}` });

export const useUpdateTicket = () =>
  useAction(({ id, ...body }: Partial<TicketInput> & { id: number; status?: TicketStatus }) => api.put<Ticket>(`/tickets/${id}`, body).then(r => r.data),
    { invalidate: [['tickets']] });

export const useDeleteTicket = () =>
  useAction((id: number) => api.delete(`/tickets/${id}`), { invalidate: [['tickets']], success: 'Talep silindi' });

export const useTicketComment = (id: number) =>
  useAction((text: string) => api.post(`/tickets/${id}/comments`, { text }), { invalidate: [['tickets']] });

export const useDeleteTicketComment = (id: number) =>
  useAction((commentId: number) => api.delete(`/tickets/${id}/comments/${commentId}`), { invalidate: [['tickets', 'activity', id]] });

export const useTicketTask = (id: number) =>
  useAction((body: { userId?: number; estimatedMinutes: number }) => api.post<Ticket>(`/tickets/${id}/task`, body).then(r => r.data),
    { invalidate: [['tickets'], ['tasks']], success: 'Görev oluşturuldu' });
