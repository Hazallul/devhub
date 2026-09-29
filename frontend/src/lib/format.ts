import type { ActionLog, ActionLogType } from '../types';

export function initials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toLocaleUpperCase('tr-TR');
}

export function firstName(fullName: string) {
  return fullName.split(' ')[0];
}

export function trLower(s: string) {
  return s.toLocaleLowerCase('tr-TR');
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const longDateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/** Backend zaman damgaları (LocalDateTime) UTC'dir ama ofset içermez; 'Z' eklenerek doğru yerel saate çevrilir. */
export function parseServerDate(value: string) {
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

/** yyyy-MM-dd veya ISO string → Date (yerel saat, gün kaymasını önler) */
export function toDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function formatDate(value: string) {
  return dateFmt.format(toDate(value));
}

export function formatLongDate(d: Date) {
  return longDateFmt.format(d);
}

export function toIsoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function daysBetween(a: Date, b: Date) {
  const ms = toDate(toIsoDay(b)).getTime() - toDate(toIsoDay(a)).getTime();
  return Math.round(ms / 86_400_000);
}

/** İzin süresi: hafta sonları (Cmt/Paz) iş gününden sayılmaz. Resmi tatiller hesaba katılmaz. */
export function leaveDays(start: string, end: string) {
  const s = toDate(start);
  const total = daysBetween(s, toDate(end)) + 1;
  let workdays = 0;
  for (let i = 0; i < total; i++) {
    const day = addDays(s, i).getDay();
    if (day !== 0 && day !== 6) workdays++;
  }
  return { total, workdays };
}

/** "2 iş günü (toplam 4 gün)"; hafta sonu yoksa yalnızca "3 iş günü". */
export function leaveDaysLabel(start: string, end: string) {
  const { total, workdays } = leaveDays(start, end);
  return workdays === total ? `${workdays} iş günü` : `${workdays} iş günü (toplam ${total} gün)`;
}

/** "3 gün kaldı", "Bugün", "2 gün gecikti" */
export function dueLabel(value: string) {
  const diff = daysBetween(new Date(), toDate(value));
  if (diff === 0) return { text: 'Bugün', tone: 'warn' as const };
  if (diff === 1) return { text: 'Yarın', tone: 'warn' as const };
  if (diff < 0) return { text: `${-diff} gün gecikti`, tone: 'danger' as const };
  if (diff <= 7) return { text: `${diff} gün kaldı`, tone: 'normal' as const };
  return { text: formatDate(value), tone: 'normal' as const };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** Backend log mesajı "[28.09.2026 16:42] ..." biçiminde; zamanı ve metni ayırır, türünü tahmin eder. */
export function parseLog(log: ActionLog): { time: string; text: string; type: ActionLogType } {
  const match = log.message.match(/^\[(.*?)\]\s*(.*)$/);
  const text = match ? match[2] : log.message;
  const time = match ? match[1] : '';
  const lower = trLower(text);
  let type: ActionLogType = 'SISTEM';
  if (lower.includes('izin')) type = 'IZIN';
  else if (lower.includes('görev')) type = 'GOREV';
  else if (lower.includes('proje')) type = 'PROJE';
  return { time, text, type };
}
