import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../services/api';
import { livePoll } from '../lib/realtime';
import { useToast } from '../components/ui/Toast';
import type { OnboardingProgress, OnboardingRule, OnboardingStatus, OnboardingStep } from '../types';

/**
 * İşe başlangıç listesi. Anahtarlar ['onboarding', ...]: kişi şifresini değiştirince, iletişim bilgisi ekleyince ya da
 * bir doküman açınca sunucu anlık duyuru yollar, kart kendiliğinden tazelenir.
 */
const get = <T,>(url: string) => async () => (await api.get<T>(url)).data;

export const useMyOnboarding = () =>
  useQuery({ queryKey: ['onboarding', 'me'], queryFn: get<OnboardingStatus>('/onboarding/me'), staleTime: 0 });

export const useOnboardingSteps = (enabled = true) =>
  useQuery({ queryKey: ['onboarding', 'steps'], queryFn: get<OnboardingStep[]>('/onboarding/steps'), enabled });

export const useOnboardingProgress = (enabled = true) =>
  useQuery({ queryKey: ['onboarding', 'progress'], queryFn: get<OnboardingProgress[]>('/onboarding/progress'), enabled, refetchInterval: livePoll(60_000) });

/** Adımı işaretler; kart beklemeden güncellenir (sunucu yanıtı gerçek durumu yazar). */
export function useToggleOnboardingStep() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.put<OnboardingStatus>(`/onboarding/me/steps/${id}`, { done }).then(r => r.data),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['onboarding', 'me'] });
      const prev = qc.getQueryData<OnboardingStatus>(['onboarding', 'me']);
      if (prev) {
        const steps = prev.steps.map(s => (s.id === id ? { ...s, done, doneAt: done ? new Date().toISOString() : null } : s));
        qc.setQueryData<OnboardingStatus>(['onboarding', 'me'], { ...prev, steps, done: steps.filter(s => s.done).length });
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['onboarding', 'me'], ctx.prev);
      toast.error(errorMessage(err));
    },
    onSuccess: data => qc.setQueryData(['onboarding', 'me'], data),
  });
}

export function useCloseOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/onboarding/me/close'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  });
}

function useAdminAction<V>(fn: (v: V) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] });
      if (success) toast.success(success);
    },
    onError: err => toast.error(errorMessage(err)),
  });
}

export interface StepInput { title: string; description: string | null; link: string | null; autoRule: OnboardingRule | null }

export const useSaveOnboardingStep = () =>
  useAdminAction(({ id, ...body }: StepInput & { id?: number }) => (id ? api.put(`/onboarding/steps/${id}`, body) : api.post('/onboarding/steps', body)));

export const useDeleteOnboardingStep = () => useAdminAction((id: number) => api.delete(`/onboarding/steps/${id}`), 'Adım silindi');

export const useReorderOnboardingSteps = () => useAdminAction((ids: number[]) => api.put('/onboarding/steps/order', { ids }));

export const useSetUserOnboarding = () =>
  useAdminAction(({ userId, active }: { userId: number; active: boolean }) => api.put(`/onboarding/users/${userId}`, { active }));

/** Kural etiketleri (kart, yönetici formu) */
export const RULE_LABEL: Record<OnboardingRule, string> = {
  SIFRE: 'Şifresini belirleyince',
  ILETISIM: 'İletişim bilgisi ekleyince',
  DOKUMAN: 'Dokümanı açınca',
};
