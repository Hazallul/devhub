import { daysBetween, toDate } from './format';
import type { Task } from '../types';

/** Açık bir görevin dikkat isteyen durumları: gecikme (gün) ve yüksek öncelik. Tamamlanan görevde ikisi de yoktur. */
export function taskUrgency(task: Pick<Task, 'status' | 'priority' | 'dueDate'>) {
  const open = task.status !== 'TAMAMLANDI';
  const diff = open && task.dueDate ? daysBetween(new Date(), toDate(task.dueDate)) : 0;
  return { overdue: diff < 0 ? -diff : 0, high: open && task.priority === 'YUKSEK' };
}

/**
 * Kartın yüzeyi: gecikmiş görev kırmızı tonlu, yüksek öncelikli görev turuncu tonlu zemin + çerçeve alır.
 * İkisi birden varsa gecikme baskındır (öncelik etiketi yine görünür).
 */
export function urgencySurface(u: ReturnType<typeof taskUrgency>) {
  if (u.overdue) return 'bg-danger-soft border-danger-line hover:border-danger/50';
  if (u.high) return 'bg-clay-soft/70 border-clay-line hover:border-clay/60';
  return 'bg-surface border-theme-light hover:border-theme-dark/30';
}

/** Sıralama: gecikenler önce (en çok geciken en üstte), sonra yüksek öncelik. */
export function byUrgency(a: Task, b: Task) {
  const ua = taskUrgency(a), ub = taskUrgency(b);
  return ub.overdue - ua.overdue || Number(ub.high) - Number(ua.high);
}
