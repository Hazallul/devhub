import type { Icon } from '@phosphor-icons/react';
import {
  Lightning, VideoCamera, Laptop, Airplane,
  CircleDashed, Hourglass, CheckCircle,
  Umbrella, FirstAid, Clock,
  PencilSimple, Target, Pause, Flag,
  Briefcase, ListDashes, Gear, SignIn, UserGear, IdentificationCard, Megaphone, Info, Warning, ShieldWarning,
  WarningCircle, XCircle, Question, BookOpenText,
  EnvelopeSimple, Phone, LinkedinLogo, GithubLogo, Globe, LinkSimple,
} from '@phosphor-icons/react';
import type {
  User, UserStatus, TaskStatus, TaskPriority, ProjectStatus, LeaveType, LeaveState, LogCategory, LogLevel, LogAction, HealthStatus, UserLink, UserLinkType,
} from '../types';

interface Meta { label: string; icon: Icon; className: string }

// Durumlar yalnızca renkle değil ikon + etiketle de ayrışır (erişilebilirlik).
export const USER_STATUS: Record<UserStatus, Meta & { dot: string }> = {
  // Durum rengi anlam taşır (yeşil = çalışıyor, amber = meşgul, mavi = uzaktan, gri = yok); rozette ikon + yazı da her zaman var.
  AKTIF: { label: 'Aktif', icon: Lightning, className: 'bg-good-soft text-good-ink border-good/25', dot: 'bg-good' },
  TOPLANTIDA: { label: 'Toplantıda', icon: VideoCamera, className: 'bg-warn-soft text-warn-ink border-warn-line', dot: 'bg-warn' },
  UZAKTAN: { label: 'Uzaktan', icon: Laptop, className: 'bg-theme-lightest text-theme-deep border-theme-medium/35', dot: 'bg-theme-medium' },
  IZINLI: { label: 'İzinli', icon: Airplane, className: 'bg-theme-lightest text-theme-muted border-theme-light border-dashed', dot: 'bg-theme-muted/50' },
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
  DEVAM: { label: 'Devam ediyor', icon: Hourglass, className: 'text-theme-deep' },
  TAMAMLANDI: { label: 'Tamamlandı', icon: CheckCircle, className: 'text-good' },
};
export const TASK_STATUSES: TaskStatus[] = ['YAPILACAK', 'DEVAM', 'TAMAMLANDI'];

export const TASK_PRIORITY: Record<TaskPriority, Meta & { rank: number }> = {
  YUKSEK: { label: 'Yüksek', icon: Flag, className: 'bg-clay-soft text-clay-ink', rank: 0 },
  ORTA: { label: 'Orta', icon: Flag, className: 'bg-theme-lightest text-theme-muted', rank: 1 },
  DUSUK: { label: 'Düşük', icon: Flag, className: 'text-theme-muted', rank: 2 },
};
export const TASK_PRIORITIES: TaskPriority[] = ['YUKSEK', 'ORTA', 'DUSUK'];

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  PLANLAMA: { label: 'Planlama', icon: PencilSimple, className: 'bg-theme-lightest text-theme-deep' },
  AKTIF: { label: 'Aktif', icon: Target, className: 'bg-good-soft text-good-ink' },
  BEKLEMEDE: { label: 'Beklemede', icon: Pause, className: 'bg-theme-lightest text-theme-muted' },
  TAMAMLANDI: { label: 'Tamamlandı', icon: CheckCircle, className: 'bg-accent text-white' },
};
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANLAMA', 'AKTIF', 'BEKLEMEDE', 'TAMAMLANDI'];

export const LEAVE_TYPE: Record<LeaveType, Meta> = {
  YILLIK: { label: 'Yıllık izin', icon: Umbrella, className: 'bg-theme-medium' },
  HASTALIK: { label: 'Hastalık', icon: FirstAid, className: 'bg-clay-mid' },
  MAZERET: { label: 'Mazeret', icon: Clock, className: 'bg-theme-dark' },
};
export const LEAVE_TYPES: LeaveType[] = ['YILLIK', 'HASTALIK', 'MAZERET'];
/** Türü gizlenmiş (başkasına ait) izin: çalışanlar ekip arkadaşlarının yalnızca izinli olduğunu görür. */
export const LEAVE_GENERIC: Meta = { label: 'İzinli', icon: Airplane, className: 'bg-theme-light' };
export const leaveTypeMeta = (type: LeaveType | null | undefined): Meta => (type ? LEAVE_TYPE[type] : LEAVE_GENERIC);

export const LEAVE_STATE: Record<LeaveState, { label: string; className: string }> = {
  BEKLIYOR: { label: 'Onay bekliyor', className: 'bg-theme-lightest text-theme-deep border border-theme-light' },
  ONAYLANDI: { label: 'Onaylandı', className: 'bg-good-soft text-good-ink' },
  REDDEDILDI: { label: 'Reddedildi', className: 'bg-theme-lightest text-theme-muted line-through' },
  IPTAL: { label: 'İptal edildi', className: 'bg-theme-lightest text-theme-muted line-through' },
};

/** Sistem logu kategorileri (renk tek başına anlam taşımaz: her yerde simge ve adla birlikte gösterilir) */
export const LOG_CATEGORY: Record<LogCategory, Meta> = {
  OTURUM: { label: 'Oturum', icon: SignIn, className: 'bg-theme-lightest text-theme-deep' },
  KULLANICI: { label: 'Kullanıcı', icon: UserGear, className: 'bg-theme-light text-theme-deep' },
  PROFIL: { label: 'Profil', icon: IdentificationCard, className: 'bg-theme-lightest text-theme-deep' },
  PROJE: { label: 'Proje', icon: Briefcase, className: 'bg-theme-light text-theme-deep' },
  GOREV: { label: 'Görev', icon: ListDashes, className: 'bg-theme-medium/30 text-theme-deep' },
  IZIN: { label: 'İzin', icon: Airplane, className: 'bg-theme-lightest text-theme-deep' },
  DUYURU: { label: 'Duyuru', icon: Megaphone, className: 'bg-theme-medium/30 text-theme-deep' },
  DOKUMAN: { label: 'Doküman', icon: BookOpenText, className: 'bg-theme-light text-theme-deep' },
  SISTEM: { label: 'Sistem', icon: Gear, className: 'bg-theme-lightest text-theme-muted' },
};
export const LOG_CATEGORIES: LogCategory[] = ['OTURUM', 'KULLANICI', 'PROFIL', 'PROJE', 'GOREV', 'IZIN', 'DUYURU', 'DOKUMAN', 'SISTEM'];
/** Eski ad */
export const LOG_TYPE = LOG_CATEGORY;

export const LOG_LEVEL: Record<LogLevel, Meta> = {
  BILGI: { label: 'Bilgi', icon: Info, className: 'bg-theme-lightest text-theme-deep' },
  UYARI: { label: 'Uyarı', icon: Warning, className: 'bg-warn-soft text-warn-ink' },
  KRITIK: { label: 'Kritik', icon: ShieldWarning, className: 'bg-danger-soft text-danger' },
};

export const LOG_ACTION: Record<LogAction, string> = {
  GIRIS: 'Giriş', GIRIS_BASARISIZ: 'Başarısız giriş', CIKIS: 'Çıkış', SIFRE_DEGISTIRME: 'Şifre değişikliği', SIFRE_SIFIRLAMA: 'Şifre sıfırlama',
  OLUSTURMA: 'Oluşturma', GUNCELLEME: 'Güncelleme', SILME: 'Silme', TAMAMLAMA: 'Tamamlama', YORUM: 'Yorum',
  DURUM_DEGISIKLIGI: 'Durum değişikliği', PROJE_ATAMA: 'Projeye atama', PROJEDEN_CIKARMA: 'Projeden çıkarma', GOREV_AKTARMA: 'Görev aktarma',
  AKTIFLESTIRME: 'Hesap açma', PASIFLESTIRME: 'Hesap kapatma', YETKI_DEGISIKLIGI: 'Yetki değişikliği',
  TALEP: 'Talep', ONAY: 'Onay', RET: 'Ret', GERI_ALMA: 'Karar geri alma', KESINLESTIRME: 'Kesinleştirme', GERI_CEKME: 'Geri çekme', KAYIT: 'Yönetici kaydı',
  YAYIN: 'Yayın', BILGI: 'Bilgi',
};

/** Logda işlemi yapan: kişi, sistem ya da (başarısız girişte) tanınmayan biri */
export function logActorName(log: { actorName: string | null; action: LogAction }) {
  if (log.actorName) return log.actorName;
  return log.action === 'GIRIS_BASARISIZ' ? 'Bilinmeyen kişi' : 'Sistem';
}

/** Avatar zemini: soğuk pastel aile, üzerinde koyu yazı (her biri koyu yazıyla 7:1 üstü). */
export const AVATAR_COLORS = ['#DCE7F8', '#D3E4F0', '#DDE3EE', '#E4DFF3', '#D6EBE7', '#EFE5D8'];
/** Eski (zeytin) paletle kaydedilmiş avatar/liste renkleri yeni karşılıklarıyla gösterilir; veritabanı değişmez. */
const LEGACY_COLOR: Record<string, string> = {
  '#F6F0D7': '#EFE5D8', '#C5D89D': '#DCE7F8', '#9CAB84': '#D3E4F0', '#89986D': '#DDE3EE', '#E4D9B4': '#E4DFF3', '#B7C4A0': '#D6EBE7',
  '#D8CFA6': '#E4DFF3', '#D9A88A': '#EFE5D8', '#A9B58F': '#D6EBE7',
};
export function avatarBg(color?: string | null) {
  const c = (color || AVATAR_COLORS[0]).toUpperCase();
  return LEGACY_COLOR[c] ?? c;
}
/** Liste/proje renk noktası: eski zeytin tonları yeni kategori renklerine çevrilir. */
const LEGACY_LIST: Record<string, string> = {
  '#9CAB84': '#5C87D8', '#C5D89D': '#3A9E9A', '#89986D': '#7A8BA6', '#D8CFA6': '#C9932C', '#D9A88A': '#D0728C', '#B7C4A0': '#8B7BD8',
};
export function listColor(color?: string | null) {
  if (!color) return '#7A8BA6';
  return LEGACY_LIST[color.toUpperCase()] ?? color;
}

/** Proje adından paletteki sabit bir renk üretir. */
export function projectColor(name: string) {
  // Kategori renkleri: aynı doygunlukta, birbirinden ayrışan sakin tonlar (yalnızca küçük nokta/şerit olarak, yanında ad yazar)
  const palette = ['#5C87D8', '#3A9E9A', '#8B7BD8', '#C9932C', '#D0728C', '#7A8BA6'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Sistem İzleme servis durumları; pill metni renkli yüzeyde en az 4.5:1 kontrastlıdır. */
export const HEALTH_STATUS: Record<HealthStatus, Meta> = {
  UP: { label: 'Sağlıklı', icon: CheckCircle, className: 'bg-good-soft text-good-ink border-good/25' },
  WARN: { label: 'Uyarı', icon: WarningCircle, className: 'bg-warn-soft text-warn-ink border-warn-line' },
  DOWN: { label: 'Çalışmıyor', icon: XCircle, className: 'bg-danger-soft text-danger border-danger-line' },
  UNKNOWN: { label: 'Bilinmiyor', icon: Question, className: 'bg-theme-lightest text-theme-muted border-theme-light' },
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
