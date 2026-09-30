import type { Icon } from '@phosphor-icons/react';
import {
  Lightning, VideoCamera, Laptop, Airplane,
  CircleDashed, Hourglass, CheckCircle,
  Umbrella, FirstAid, Clock,
  PencilSimple, Target, Pause, Flag,
  Briefcase, ListDashes, Gear,
  WarningCircle, XCircle, Question,
  EnvelopeSimple, Phone, LinkedinLogo, GithubLogo, Globe, LinkSimple,
} from '@phosphor-icons/react';
import type {
  User, UserStatus, TaskStatus, TaskPriority, ProjectStatus, LeaveType, LeaveState, ActionLogType, HealthStatus, UserLink, UserLinkType,
} from '../types';

interface Meta { label: string; icon: Icon; className: string }

// Durumlar yalnızca renkle değil ikon + etiketle de ayrışır (erişilebilirlik).
export const USER_STATUS: Record<UserStatus, Meta & { dot: string }> = {
  AKTIF: { label: 'Aktif', icon: Lightning, className: 'bg-theme-light text-theme-text border-theme-light', dot: 'bg-theme-deep' },
  TOPLANTIDA: { label: 'Toplantıda', icon: VideoCamera, className: 'bg-white text-theme-text border-theme-dark', dot: 'bg-theme-dark' },
  UZAKTAN: { label: 'Uzaktan', icon: Laptop, className: 'bg-theme-lightest text-theme-text border-theme-medium/60', dot: 'bg-theme-medium' },
  IZINLI: { label: 'İzinli', icon: Airplane, className: 'bg-theme-cream text-theme-muted border-theme-light/70 border-dashed', dot: 'bg-theme-muted/40' },
};

export const ALL_STATUSES: UserStatus[] = ['AKTIF', 'TOPLANTIDA', 'UZAKTAN', 'IZINLI'];
/**
 * Bir kullanıcının durum menüsünde gösterilecek seçenekler (backend'deki kuralın aynısı):
 * yönetici hepsini seçer; çalışan yalnızca çalışma şekli (Aktif/Uzaktan) ile Toplantıda arasında geçer,
 * İzinliyken kendi durumunu değiştiremez.
 */
export function statusOptions(viewer: User, target: User): UserStatus[] {
  if (viewer.role === 'ADMIN') return ALL_STATUSES;
  if (target.status === 'IZINLI') return [];
  const mode = target.workMode ?? 'AKTIF';
  return ALL_STATUSES.filter(s => s === mode || s === 'TOPLANTIDA');
}

export function statusHint(viewer: User, target: User): string | null {
  if (viewer.role === 'ADMIN') return 'Aktif veya Uzaktan kişinin çalışma şeklini de belirler. İzinli seçince izin türü ve tarihleri sorulur.';
  if (target.status === 'IZINLI') return 'İzinliyken durumunu yalnızca yönetici değiştirebilir.';
  return `Çalışma şeklini (${USER_STATUS[target.workMode ?? 'AKTIF'].label}) yönetici belirler. İzin için İzinler sayfasından talep oluşturun.`;
}

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  YAPILACAK: { label: 'Yapılacak', icon: CircleDashed, className: 'text-theme-muted' },
  DEVAM: { label: 'Devam Ediyor', icon: Hourglass, className: 'text-theme-dark' },
  TAMAMLANDI: { label: 'Tamamlandı', icon: CheckCircle, className: 'text-theme-deep' },
};
export const TASK_STATUSES: TaskStatus[] = ['YAPILACAK', 'DEVAM', 'TAMAMLANDI'];

export const TASK_PRIORITY: Record<TaskPriority, Meta & { rank: number }> = {
  YUKSEK: { label: 'Yüksek', icon: Flag, className: 'bg-[#F3E1D6] text-[#8A4B2A]', rank: 0 },
  ORTA: { label: 'Orta', icon: Flag, className: 'bg-theme-lightest text-theme-deep', rank: 1 },
  DUSUK: { label: 'Düşük', icon: Flag, className: 'bg-gray-100 text-theme-muted', rank: 2 },
};
export const TASK_PRIORITIES: TaskPriority[] = ['YUKSEK', 'ORTA', 'DUSUK'];

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  PLANLAMA: { label: 'Planlama', icon: PencilSimple, className: 'bg-theme-lightest text-theme-deep' },
  AKTIF: { label: 'Aktif', icon: Target, className: 'bg-theme-light text-theme-text' },
  BEKLEMEDE: { label: 'Beklemede', icon: Pause, className: 'bg-gray-100 text-theme-muted' },
  TAMAMLANDI: { label: 'Tamamlandı', icon: CheckCircle, className: 'bg-theme-deep text-white' },
};
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANLAMA', 'AKTIF', 'BEKLEMEDE', 'TAMAMLANDI'];

export const LEAVE_TYPE: Record<LeaveType, Meta> = {
  YILLIK: { label: 'Yıllık İzin', icon: Umbrella, className: 'bg-theme-medium' },
  HASTALIK: { label: 'Hastalık', icon: FirstAid, className: 'bg-[#D9A88A]' },
  MAZERET: { label: 'Mazeret', icon: Clock, className: 'bg-theme-dark' },
};
export const LEAVE_TYPES: LeaveType[] = ['YILLIK', 'HASTALIK', 'MAZERET'];

export const LEAVE_STATE: Record<LeaveState, { label: string; className: string }> = {
  BEKLIYOR: { label: 'Onay Bekliyor', className: 'bg-theme-lightest text-theme-deep border border-theme-light' },
  ONAYLANDI: { label: 'Onaylandı', className: 'bg-theme-light text-theme-text' },
  REDDEDILDI: { label: 'Reddedildi', className: 'bg-gray-100 text-theme-muted line-through' },
  IPTAL: { label: 'İptal edildi', className: 'bg-gray-100 text-theme-muted line-through' },
};

export const LOG_TYPE: Record<ActionLogType, Meta> = {
  PROJE: { label: 'Proje', icon: Briefcase, className: 'bg-theme-light text-theme-deep' },
  IZIN: { label: 'İzin', icon: Airplane, className: 'bg-theme-lightest text-theme-deep' },
  GOREV: { label: 'Görev', icon: ListDashes, className: 'bg-theme-medium/30 text-theme-deep' },
  SISTEM: { label: 'Sistem', icon: Gear, className: 'bg-gray-100 text-theme-muted' },
};

export const AVATAR_COLORS = ['#F6F0D7', '#C5D89D', '#9CAB84', '#89986D', '#E4D9B4', '#B7C4A0'];

/** Proje adından paletteki sabit bir renk üretir. */
export function projectColor(name: string) {
  const palette = ['#9CAB84', '#C5D89D', '#89986D', '#B7C4A0', '#D8CFA6', '#A9B58F'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Sistem İzleme servis durumları; pill metni renkli yüzeyde en az 4.5:1 kontrastlıdır. */
export const HEALTH_STATUS: Record<HealthStatus, Meta> = {
  UP: { label: 'Sağlıklı', icon: CheckCircle, className: 'bg-theme-lightest text-theme-deep border-theme-light' },
  WARN: { label: 'Uyarı', icon: WarningCircle, className: 'bg-[#F7ECD0] text-[#6E5210] border-[#E8D39C]' },
  DOWN: { label: 'Çalışmıyor', icon: XCircle, className: 'bg-[#FBEDE5] text-[#9A3B1B] border-[#EFC9B5]' },
  UNKNOWN: { label: 'Bilinmiyor', icon: Question, className: 'bg-gray-100 text-theme-muted border-gray-200' },
};

/** Profildeki iletişim/bağlantı türleri */
export const LINK_TYPE: Record<UserLinkType, { label: string; icon: Icon; placeholder: string }> = {
  EMAIL: { label: 'E-posta', icon: EnvelopeSimple, placeholder: 'ad@ornek.com' },
  PHONE: { label: 'Telefon', icon: Phone, placeholder: '+90 5xx xxx xx xx' },
  LINKEDIN: { label: 'LinkedIn', icon: LinkedinLogo, placeholder: 'linkedin.com/in/kullanici-adi' },
  GITHUB: { label: 'GitHub', icon: GithubLogo, placeholder: 'github.com/kullanici-adi' },
  WEBSITE: { label: 'Web sitesi', icon: Globe, placeholder: 'ornek.com' },
  OTHER: { label: 'Diğer bağlantı', icon: LinkSimple, placeholder: 'https://…' },
};
export const LINK_TYPES: UserLinkType[] = ['EMAIL', 'PHONE', 'LINKEDIN', 'GITHUB', 'WEBSITE', 'OTHER'];

/** Bağlantının tıklanınca açacağı adres. Web adresleri yalnızca http(s) ise bağlantı olur (sunucu da bunu doğrular). */
export function linkHref(link: UserLink): string | undefined {
  if (link.type === 'EMAIL') return `mailto:${link.value}`;
  if (link.type === 'PHONE') return `tel:${link.value.replace(/[^+\d]/g, '')}`;
  return /^https?:\/\//i.test(link.value) ? link.value : undefined;
}

/** Çipte görünen kısa metin: etiket varsa o; e-posta/telefonda değerin kendisi; web adresinde tür adı veya alan adı. */
export function linkText(link: UserLink): string {
  if (link.label) return link.label;
  if (link.type === 'EMAIL' || link.type === 'PHONE') return link.value;
  if (link.type === 'LINKEDIN' || link.type === 'GITHUB') return LINK_TYPE[link.type].label;
  try { return new URL(link.value).hostname.replace(/^www\./, ''); } catch { return link.value; }
}
