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

/**
 * İzin süresi: hafta sonları (Cmt/Paz) ve resmi tatiller iş gününden sayılmaz.
 * holidays: yyyy-MM-dd biçiminde resmi tatil günleri (useHolidays'ten).
 */
export function leaveDays(start: string, end: string, holidays: ReadonlySet<string> = new Set()) {
  const s = toDate(start);
  const total = daysBetween(s, toDate(end)) + 1;
  let workdays = 0;
  let holidayCount = 0;
  for (let i = 0; i < total; i++) {
    const d = addDays(s, i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    if (weekend) continue;
    if (holidays.has(toIsoDay(d))) holidayCount++;
    else workdays++;
  }
  return { total, workdays, holidays: holidayCount };
}

/** "3 iş günü (toplam 5 gün · 1 resmi tatil)"; hafta sonu/tatil yoksa yalnızca "3 iş günü". */
export function leaveDaysLabel(start: string, end: string, holidays: ReadonlySet<string> = new Set()) {
  const r = leaveDays(start, end, holidays);
  if (r.workdays === r.total) return `${r.workdays} iş günü`;
  return `${r.workdays} iş günü (toplam ${r.total} gün${r.holidays ? ` · ${r.holidays} resmi tatil` : ''})`;
}

/** İş Kanunu md. 53: 1–5 yıl 14, 5–15 yıl 20, 15 yıl ve üzeri 26 gün (1 yıldan az kıdemde yasal hak yoktur). */
export function suggestedLeaveDays(hireDate: string | null) {
  if (!hireDate) return null;
  const years = (Date.now() - toDate(hireDate).getTime()) / (365.25 * 86_400_000);
  if (years < 1) return { years, days: 14, note: '1 yıldan az kıdem: yasal hak yok, şirket politikasıyla 14 gün' };
  if (years < 5) return { years, days: 14, note: '1–5 yıl kıdem: 14 gün' };
  if (years < 15) return { years, days: 20, note: '5–15 yıl kıdem: 20 gün' };
  return { years, days: 26, note: '15 yıl ve üzeri kıdem: 26 gün' };
}

export function seniorityLabel(hireDate: string | null) {
  if (!hireDate) return null;
  const months = Math.max(0, Math.floor((Date.now() - toDate(hireDate).getTime()) / (30.44 * 86_400_000)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} ay`;
  return m ? `${y} yıl ${m} ay` : `${y} yıl`;
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

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

/** Sunucu zamanını "3 dakika önce", "dün" gibi göreli metne çevirir. */
export function timeAgo(iso: string) {
  const mins = Math.round((parseServerDate(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(mins) < 1) return 'az önce';
  if (Math.abs(mins) < 60) return relative.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  return formatDate(toIsoDay(parseServerDate(iso)));
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
