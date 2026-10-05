import type { SurveySummary } from '../hooks/surveys';
import { parseServerDate, timeAgo } from './format';

export const SURVEY_STATE: Record<SurveySummary['state'], { label: string; cls: string }> = {
  TASLAK: { label: 'Taslak', cls: 'bg-theme-lightest text-theme-muted border-theme-light' },
  ACIK: { label: 'Açık', cls: 'bg-good-soft text-good-ink border-good/30' },
  KAPALI: { label: 'Kapandı', cls: 'bg-theme-lightest text-theme-text/70 border-theme-light' },
};

/** "3 gün sonra kapanıyor" / "Kapandı 2 saat önce" */
export function closesText(s: Pick<SurveySummary, 'closesAt' | 'state' | 'closedAt'>) {
  if (s.state === 'KAPALI') return s.closedAt ? `Kapandı ${timeAgo(s.closedAt)}` : 'Kapandı';
  if (!s.closesAt) return 'Son tarih yok';
  return `${timeAgo(s.closesAt)} kapanıyor`.replace('önce kapanıyor', 'önce kapanmalıydı');
}

export function closesFull(iso: string) {
  return parseServerDate(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
