import { useEffect, useState } from 'react';
import type { Task } from '../types';

/**
 * İş gücü yardımcıları. Harcanan süreyi sunucu hesaplar (yalnızca mesai saatleri: hafta içi 09:00–12:00 ve 13:00–18:00,
 * tatil ve izin günleri hariç; bkz. WorkTimeService). Görev "Devam Ediyor"da ve şu an mesai saatiyse (ticking)
 * istemci, son yüklemeden bu yana geçen mesai süresini ekleyerek sayacı canlı ilerletir.
 */

/** Sunucudaki çalışma dilimleriyle aynı (Türkiye saati, dakika) */
const PERIODS: [number, number][] = [[9 * 60, 12 * 60], [13 * 60, 18 * 60]];
const TR_OFFSET_MIN = 180; // Türkiye UTC+3, yaz saati yok
export const DAY_HOURS = PERIODS.reduce((s, [a, b]) => s + (b - a), 0) / 60;
export const WEEK_HOURS = DAY_HOURS * 5;

/** fromMs → toMs arasında bugünün mesai dilimlerine düşen saniye (yalnızca canlı sayaç için; aynı gün içinde kullanılır). */
function workSecondsBetween(fromMs: number, toMs: number) {
  if (toMs <= fromMs) return 0;
  const dayStartUtc = (ms: number) => {
    const local = ms + TR_OFFSET_MIN * 60_000;
    return local - (local % 86_400_000) - TR_OFFSET_MIN * 60_000;
  };
  const base = dayStartUtc(toMs);
  let total = 0;
  for (const [a, b] of PERIODS) {
    const s = Math.max(fromMs, base + a * 60_000);
    const e = Math.min(toMs, base + b * 60_000);
    if (e > s) total += (e - s) / 1000;
  }
  return Math.floor(total);
}

/** Görevin şu anki harcanan süresi (saniye) */
export function liveSpent(task: Task, now: number) {
  const base = task.spentSeconds ?? 0;
  if (!task.ticking || !task.fetchedAt) return base;
  return base + workSecondsBetween(task.fetchedAt, now);
}

/** Saniyede bir değil, verilen aralıkta yenilenen "şimdi" (canlı sayaçlar için) */
export function useNow(intervalMs = 30_000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

/** 12600 → "3 sa 30 dk"; short: "3,5 sa" */
export function formatDuration(seconds: number, short = false) {
  const totalMin = Math.max(0, Math.round(seconds / 60));
  if (short) {
    if (totalMin === 0) return '0 sa';
    if (totalMin < 60) return `${totalMin} dk`;
    const h = Math.round((totalMin / 60) * 10) / 10;
    return `${String(h).replace('.', ',')} sa`;
  }
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m} dk`;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

/** Dakika → "8 sa" / "1 gün 2 sa" (iş günü = 8 saat) */
export function formatEstimate(minutes: number) {
  const h = minutes / 60;
  if (h >= DAY_HOURS * 2 && Number.isInteger(h / DAY_HOURS)) return `${h / DAY_HOURS} gün`;
  return formatDuration(minutes * 60, true);
}

export type EffortTone = 'none' | 'ok' | 'near' | 'over';

/** Tahmine göre durum: %90'a kadar normal, %90–100 yaklaşıyor, üstü aşıldı */
export function effortTone(spentSeconds: number, estimatedMinutes?: number | null): EffortTone {
  if (!estimatedMinutes) return 'none';
  const r = spentSeconds / (estimatedMinutes * 60);
  return r > 1 ? 'over' : r >= 0.9 ? 'near' : 'ok';
}

/** Kalan tahmini iş (saniye); tahmin yoksa 0, aşıldıysa 0 */
export function remainingSeconds(task: Task, spent: number) {
  if (!task.estimatedMinutes || task.status === 'TAMAMLANDI') return 0;
  return Math.max(0, task.estimatedMinutes * 60 - spent);
}

/** Formdaki "3,5" / "3.5" / "2:30" girişini dakikaya çevirir; geçersizse null */
export function parseHours(input: string): number | null {
  const v = input.trim();
  if (!v) return null;
  const hm = /^(\d{1,3}):([0-5]\d)$/.exec(v);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null;
}
