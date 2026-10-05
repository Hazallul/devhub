import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAction } from './api';
import { livePoll } from '../lib/realtime';

export type SurveyState = 'TASLAK' | 'ACIK' | 'KAPALI';
export type QuestionType = 'TEK_SECIM' | 'COKLU_SECIM' | 'PUAN' | 'METIN';
export type AudienceType = 'HERKES' | 'DEPARTMAN' | 'KISILER';

export interface SurveySummary {
  id: number; title: string; description: string | null; state: SurveyState; anonymous: boolean; resultsPublic: boolean;
  audienceType: AudienceType; audienceValues: string[]; audienceLabel: string;
  /** UTC, ofsetsiz */
  closesAt: string | null; createdByName: string | null; createdAt: string; publishedAt: string | null; closedAt: string | null;
  questionCount: number; recipientCount: number; respondedCount: number;
  /** Bu anket bana gönderildi mi, yanıtladım mı */
  recipient: boolean; responded: boolean;
}

export interface SurveyQuestion { id: number; position: number; type: QuestionType; text: string; required: boolean; options: string[] }

export interface SurveyDetail {
  survey: SurveySummary;
  questions: SurveyQuestion[];
  /** Adıyla ankette kişinin kendi yanıtları (soru kimliği → değer) */
  myAnswers: Record<string, number | number[] | string>;
  canSeeResults: boolean;
}

export interface QuestionResult {
  questionId: number; type: QuestionType; text: string; options: string[]; answered: number;
  counts?: number[]; distribution?: number[]; average?: number | null; texts?: { text: string; name: string | null }[];
}

export interface SurveyResults {
  survey: SurveySummary;
  questions: QuestionResult[];
  /** Yalnızca yönetici: henüz yanıtlamayanlar */
  pending?: { id: number; fullName: string; department: string | null; remindedAt: string | null }[];
}

/** Anket formu (taslak oluşturma/düzenleme). closesAt: "yyyy-MM-ddTHH:mm" İstanbul saati ya da boş. */
export interface SurveyInput {
  title: string; description: string; anonymous: boolean; resultsPublic: boolean;
  audienceType: AudienceType; audienceValues: string[]; closesAt: string;
  questions: { type: QuestionType; text: string; required: boolean; options: string[] }[];
}

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

export const useSurveys = () => useQuery({ queryKey: ['surveys'], queryFn: get<SurveySummary[]>('/surveys') });
export const useSurvey = (id: number | null) =>
  useQuery({ queryKey: ['surveys', 'detail', id], queryFn: get<SurveyDetail>(`/surveys/${id}`), enabled: id !== null });
export const useSurveyResults = (id: number | null, enabled = true) =>
  useQuery({ queryKey: ['surveys', 'results', id], queryFn: get<SurveyResults>(`/surveys/${id}/results`), enabled: id !== null && enabled });
export const usePendingSurveyCount = () =>
  useQuery({ queryKey: ['surveys', 'pending'], queryFn: get<{ count: number }>('/surveys/pending-count'), refetchInterval: livePoll(60_000) });

export const useCreateSurvey = () =>
  useAction((body: SurveyInput) => api.post<{ id: number }>('/surveys', body).then(r => r.data), { invalidate: [['surveys']] });
export const useUpdateSurvey = () =>
  useAction(({ id, ...body }: SurveyInput & { id: number }) => api.put(`/surveys/${id}`, body), { invalidate: [['surveys']] });
export const useSurveySettings = () =>
  useAction(({ id, ...body }: { id: number; closesAt?: string; resultsPublic?: boolean }) => api.put(`/surveys/${id}/settings`, body),
    { invalidate: [['surveys']], success: 'Anket ayarları kaydedildi' });
export const usePublishSurvey = () =>
  useAction((id: number) => api.post(`/surveys/${id}/publish`), { invalidate: [['surveys']], success: 'Anket yayınlandı; kitledeki herkese bildirim gitti' });
export const useCloseSurvey = () =>
  useAction((id: number) => api.post(`/surveys/${id}/close`), { invalidate: [['surveys']], success: 'Anket kapatıldı' });
export const useReopenSurvey = () =>
  useAction((id: number) => api.post(`/surveys/${id}/reopen`), { invalidate: [['surveys']], success: 'Anket yeniden açıldı' });
export const useDeleteSurvey = () =>
  useAction((id: number) => api.delete(`/surveys/${id}`), { invalidate: [['surveys']], success: 'Anket silindi' });
export const useRemindSurvey = () =>
  useAction((id: number) => api.post<{ sent: number }>(`/surveys/${id}/remind`).then(r => r.data), { invalidate: [['surveys', 'results']] });
export const useRespondSurvey = () =>
  useAction(({ id, answers }: { id: number; answers: Record<string, unknown> }) => api.post(`/surveys/${id}/responses`, { answers }),
    { invalidate: [['surveys']], success: 'Yanıtınız gönderildi, teşekkürler' });
