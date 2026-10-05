import type { ActionLog, LogCategory } from '../types';

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

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

/** "Git Akışı ve Branch" -> "git-akisi-ve-branch" (adresler ve başlık bağlantıları için; sunucudaki DocContent.slugify ile aynı kural) */
export function slugify(text: string) {
  return text
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, ch => TR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

const fullDateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/** "1 Ekim 2027": yılı belirsiz kalmaması gereken tarihler için (ör. ileri tarihli izin hakkı) */
export function formatFullDate(value: string) {
  return fullDateFmt.format(toDate(value));
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

/**
 * Yıllık izin hakkı (İş Kanunu md. 53), sunucudaki LeavePolicy ile aynı kural: 1 yıldan az kıdem 0, 1–5 yıl 14,
 * 5–15 yıl 20, 15 yıl ve üzeri 26 gün. Hak kıdem yıldönümünde kendiliğinden artar; next = bir sonraki artış.
 */
export function leaveEntitlement(hireDate: string | null) {
  if (!hireDate) return null;
  const hire = toDate(hireDate);
  const today = toDate(toIsoDay(new Date()));
  const steps: [number, number][] = [[1, 14], [5, 20], [15, 26]];
  const anniversary = (y: number) => new Date(hire.getFullYear() + y, hire.getMonth(), hire.getDate());
  let days = 0;
  steps.forEach(([y, d]) => { if (anniversary(y) <= today) days = d; });
  const nextStep = steps.find(([y]) => anniversary(y) > today);
  const next = nextStep ? { date: toIsoDay(anniversary(nextStep[0])), days: nextStep[1] } : null;
  const note = days === 0 ? '1 yıldan az kıdem: henüz yıllık izin hakkı yok' : days === 14 ? '1–5 yıl kıdem' : days === 20 ? '5–15 yıl kıdem' : '15 yıl ve üzeri kıdem';
  return { days, next, note };
}

export function seniorityLabel(hireDate: string | null) {
  if (!hireDate) return null;
  const months = Math.max(0, Math.floor((Date.now() - toDate(hireDate).getTime()) / (30.44 * 86_400_000)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} ay`;
  return m ? `${y} yıl ${m} ay` : `${y} yıl`;
}

/** "3 gün kaldı", "Bugün", "2 gün gecikti"; bir haftadan uzaksa "Son tarih 14 Eki" */
export function dueLabel(value: string) {
  const diff = daysBetween(new Date(), toDate(value));
  if (diff === 0) return { text: 'Bugün', tone: 'warn' as const };
  if (diff === 1) return { text: 'Yarın', tone: 'warn' as const };
  if (diff < 0) return { text: `${-diff} gün gecikti`, tone: 'danger' as const };
  if (diff <= 7) return { text: `${diff} gün kaldı`, tone: 'normal' as const };
  return { text: `Son tarih ${formatDate(value)}`, tone: 'normal' as const };
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
/** Log satırı: saat ("30.09.2026 14:05"), metin ve kategori. Eski kayıtların başındaki "[...] " damgası atılır. */
export function parseLog(log: ActionLog): { time: string; text: string; type: LogCategory } {
  const text = log.message.replace(/^\[[^\]]*\]\s*/, '');
  const d = parseServerDate(log.createdAt);
  const time = `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  return { time, text, type: log.category };
}
