import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { useToast } from '../components/ui/Toast';
import type { DocDetail, DocNode, DocRevision, DocSummary } from '../types';

/*
 * Dokümantasyon: dokümanlar veritabanında, içerik editörün JSON'u. Çalışanın değişikliği öneri olarak onaya gider,
 * yöneticininki doğrudan yayınlanır (sunucu karar verir). Anahtarlar ['docs', ...] altında.
 */

const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

export const useDocs = () => useQuery({ queryKey: ['docs', 'list'], queryFn: get<DocSummary[]>('/docs'), staleTime: 30_000 });

export const useDoc = (slug: string | undefined) =>
  useQuery({ queryKey: ['docs', 'doc', slug], queryFn: get<DocDetail>(`/docs/${slug}`), enabled: !!slug, retry: false });

export const useDocHistory = (slug: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ['docs', 'history', slug], queryFn: get<DocRevision[]>(`/docs/${slug}/history`), enabled: !!slug && enabled });

/** pending: onay bekleyenler (yönetici). mine: kişinin kendi önerileri. */
export const useDocRevisions = (scope: 'pending' | 'mine', enabled = true) =>
  useQuery({ queryKey: ['docs', 'revisions', scope], queryFn: get<DocRevision[]>(`/docs/revisions?scope=${scope}`), enabled, refetchInterval: 30_000 });

export const useDocRevision = (id: number | null) =>
  useQuery({ queryKey: ['docs', 'revision', id], queryFn: get<DocRevision>(`/docs/revisions/${id}`), enabled: id !== null, retry: false });

export const useDocPendingCount = (enabled: boolean) =>
  useQuery({ queryKey: ['docs', 'count'], queryFn: get<{ count: number }>('/docs/revisions/pending-count'), enabled, refetchInterval: 30_000 });

export interface DocDraft {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  content: DocNode;
}

export interface SubmitDocInput extends DocDraft {
  docId?: number;
  baseVersion?: number;
  note?: string;
  /** kişinin yerine geçecek bekleyen önerisi */
  replaces?: number;
  /** yönetici: arada yapılan değişikliğin üzerine yaz */
  force?: boolean;
}

/** Hata mesajını çağıran gösterir (409 çakışmasında "yine de yayınla" sorulur). */
export function useSubmitDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitDocInput) => api.post<DocRevision>('/docs/revisions', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });
}

function useDocAction<T>(fn: (v: T) => Promise<unknown>, success: (v: T) => string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['docs'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
      toast.success(success(v));
    },
    onError: err => toast.error(errorMessage(err)),
  });
}

export const useDecideDocRevision = () =>
  useDocAction(
    ({ id, ...body }: { id: number; decision: 'ONAYLANDI' | 'REDDEDILDI'; note?: string }) => api.put<DocRevision>(`/docs/revisions/${id}/decision`, body),
    ({ decision }) => (decision === 'ONAYLANDI' ? 'Öneri onaylandı ve yayınlandı' : 'Öneri reddedildi'),
  );

export const useWithdrawDocRevision = () => useDocAction((id: number) => api.delete(`/docs/revisions/${id}`), () => 'Öneri geri çekildi');

export const useDeleteDoc = () => useDocAction((id: number) => api.delete(`/docs/${id}`), () => 'Doküman silindi');

/** Görseli yükler, dokümanda saklanacak (göreli) adresini döndürür. */
export async function uploadDocImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  return (await api.post<{ url: string }>('/docs/images', form)).data.url;
}

const API_ORIGIN = String(api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');

/** Dokümanda "/api/docs/images/…" olarak saklanan görsel adresini tarayıcının yükleyebileceği tam adrese çevirir. */
export const imageSrc = (src: string) => (src.startsWith('/api/') ? API_ORIGIN + src : src);
/** Tam adresi saklanacak göreli biçime çevirir. */
export const storedImageSrc = (src: string) => (API_ORIGIN && src.startsWith(API_ORIGIN + '/api/') ? src.slice(API_ORIGIN.length) : src);
