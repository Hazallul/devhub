import { DAY_HOURS, liveSpent, remainingSeconds } from './effort';
import { TASK_PRIORITY } from './meta';
import { addDays, daysBetween, toDate, toIsoDay } from './format';
import type { Task } from '../types';

/**
 * Kişinin açık görevlerini takvime yerleştirir (Kişiler panosundaki Takvim görünümü).
 * Çubuğun uzunluğu tahminden gelir: kalan tahmini iş, kişinin mesai saatlerine (günde DAY_HOURS saat) sırayla dizilir;
 * hafta sonu, resmi tatil ve kişinin onaylı izin günleri atlanır. Son tarih ayrıca işaretlenir; plan son tarihi
 * aşıyorsa görev "gecikecek" sayılır. Atanır atanmaz planlanır, "Devam ediyor"a alınmasını beklemez.
 * Sıra: önce sürmekte olanlar, sonra son tarihi yakın olan, sonra önceliği yüksek olan; bekleyen (bağımlı) görevler en sonda.
 */

/** Konum: bugünden itibaren gün sayısı + o günün mesai kesri (0 = mesai başı, 1 = mesai sonu). */
export interface PlannedTask {
  task: Task;
  start: number;
  end: number;
  /** Planlanan saat (kalan iş) */
  hours: number;
  /** Son tarih bugüne göre kaçıncı gün (yoksa null) */
  dueIndex: number | null;
  /** Plan son tarihi kaç iş günü aşıyor (0 = yetişiyor) */
  lateDays: number;
  /** Yetişiyorsa işin bittiği günden son tarihe kadar kalan iş günü (son tarih yoksa ya da gecikiyorsa null) */
  slackDays: number | null;
  /** Başka bir görevin bitmesini bekliyor */
  blocked: boolean;
}

/** Tahmini olmayan eski görevler için varsayılan süre (saat) */
const DEFAULT_HOURS = 4;
/** Tahmini aşılmış ama hâlâ açık görev için ayrılan süre (saat) */
const OVERRUN_HOURS = 1;
/** Sonsuz döngü koruması: en fazla bu kadar gün ileriye planlanır */
const HORIZON_DAYS = 365;

/** Bugün mesai saatlerinin ne kadarı geçti (0–1). Tarayıcı saati Türkiye saatiyle aynı kabul edilir. */
export function todayWorkFraction(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const periods: [number, number][] = [[9 * 60, 12 * 60], [13 * 60, 18 * 60]];
  let done = 0;
  for (const [a, b] of periods) done += Math.max(0, Math.min(minutes, b) - a);
  return Math.min(1, done / (DAY_HOURS * 60));
}

const order = (a: Task, b: Task) => {
  const blockedA = (a.openBlockerIds?.length ?? 0) > 0, blockedB = (b.openBlockerIds?.length ?? 0) > 0;
  if (blockedA !== blockedB) return blockedA ? 1 : -1;
  const runA = a.status === 'DEVAM', runB = b.status === 'DEVAM';
  if (runA !== runB) return runA ? -1 : 1;
  if (runA && runB) return (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank
    || a.createdAt.localeCompare(b.createdAt);
};

/**
 * @param tasks kişinin açık görevleri
 * @param isOff gün (yyyy-MM-dd) çalışılmayan bir gün mü (hafta sonu, tatil, kişinin izni)
 */
export function planTasks(tasks: Task[], isOff: (isoDay: string) => boolean, nowMs = Date.now()): PlannedTask[] {
  const now = new Date(nowMs);
  const today = toDate(toIsoDay(now));
  let day = 0;
  let frac = isOff(toIsoDay(today)) ? 0 : todayWorkFraction(now);
  if (frac >= 1) { day = 1; frac = 0; }

  const skipOff = () => {
    for (let guard = 0; guard < HORIZON_DAYS && isOff(toIsoDay(addDays(today, day))); guard++) { day++; frac = 0; }
  };

  const out: PlannedTask[] = [];
  for (const task of [...tasks].sort(order)) {
    const remaining = remainingSeconds(task, liveSpent(task, nowMs)) / 3600;
    const hours = !task.estimatedMinutes ? DEFAULT_HOURS : remaining > 0 ? remaining : OVERRUN_HOURS;
    skipOff();
    const start = day + frac;
    let left = hours;
    for (let guard = 0; left > 1e-6 && guard < HORIZON_DAYS; guard++) {
      skipOff();
      const avail = (1 - frac) * DAY_HOURS;
      const take = Math.min(left, avail);
      left -= take;
      frac += take / DAY_HOURS;
      if (frac >= 1 - 1e-6 && left > 1e-6) { day++; frac = 0; }
    }
    const end = day + frac;
    const lastDay = Math.ceil(end - 1e-6) - 1; // işin bittiği gün
    const dueIndex = task.dueDate ? daysBetween(today, toDate(task.dueDate)) : null;
    let lateDays = 0;
    if (dueIndex !== null && Math.max(lastDay, 0) > dueIndex) {
      // Aradaki iş günleri kadar gecikme (hafta sonu sayılmaz); geçmiş son tarihte bugüne kadarki takvim günü
      for (let d = Math.max(dueIndex + 1, 0); d <= lastDay; d++) if (!isOff(toIsoDay(addDays(today, d)))) lateDays++;
      if (dueIndex < 0) lateDays += -dueIndex;
      lateDays = Math.max(lateDays, 1);
    }
    let slackDays: number | null = null;
    if (dueIndex !== null && lateDays === 0) {
      slackDays = 0;
      for (let d = Math.max(lastDay, 0) + 1; d <= dueIndex; d++) if (!isOff(toIsoDay(addDays(today, d)))) slackDays++;
    }
    out.push({ task, start, end, hours, dueIndex, lateDays, slackDays, blocked: (task.openBlockerIds?.length ?? 0) > 0 });
    if (frac >= 1 - 1e-6) { day++; frac = 0; }
  }
  return out;
}
