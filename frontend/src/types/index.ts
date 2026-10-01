export type Role = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'AKTIF' | 'TOPLANTIDA' | 'UZAKTAN' | 'IZINLI';

export type UserLinkType = 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'GITHUB' | 'WEBSITE' | 'OTHER';

export interface UserLink { type: UserLinkType; label: string | null; value: string }

export interface User {
    id: number;
    email: string;
    fullName: string;
    role: Role;
    jobTitle: string | null;
    currentProject: string | null;
    status: UserStatus | null;
    /** Yöneticinin belirlediği çalışma şekli; çalışan yalnızca bununla TOPLANTIDA arasında geçiş yapabilir. */
    workMode: 'AKTIF' | 'UZAKTAN';
    avatarColor: string | null;
    active: boolean;
    hireDate: string | null;
    /** Yıllık izin hakkı (iş günü) */
    /** Bugünkü kıdeme göre yıllık izin hakkı (sunucu işe giriş tarihinden hesaplar) */
    annualLeaveDays: number;
    /** Hakkın bir sonraki artışı (ör. 1. yıl dolunca 14 gün) */
    annualLeaveNextDate?: string | null;
    annualLeaveNextDays?: number | null;
    /** Yönetici şifreyi sıfırladıysa kullanıcı şifresini değiştirmelidir */
    mustChangePassword: boolean;
    /** Profildeki iletişim bilgileri ve bağlantılar (kişi kendisi düzenler) */
    links?: UserLink[];
}

export interface LoginResponse {
    token: string;
    user: User;
}

export type ProjectStatus = 'PLANLAMA' | 'AKTIF' | 'BEKLEMEDE' | 'TAMAMLANDI';

// Mevcut backend yalnızca id + name döner; diğer alanlar yeni tasarım için opsiyonel.
export interface Project {
    id: number;
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    deadline?: string | null;
}

export type LogCategory = 'OTURUM' | 'KULLANICI' | 'PROFIL' | 'PROJE' | 'GOREV' | 'IZIN' | 'DUYURU' | 'DOKUMAN' | 'SISTEM';
export type LogLevel = 'BILGI' | 'UYARI' | 'KRITIK';
export type LogAction =
    | 'GIRIS' | 'GIRIS_BASARISIZ' | 'CIKIS' | 'SIFRE_DEGISTIRME' | 'SIFRE_SIFIRLAMA'
    | 'OLUSTURMA' | 'GUNCELLEME' | 'SILME' | 'TAMAMLAMA' | 'YORUM'
    | 'DURUM_DEGISIKLIGI' | 'PROJE_ATAMA' | 'PROJEDEN_CIKARMA' | 'GOREV_AKTARMA'
    | 'AKTIFLESTIRME' | 'PASIFLESTIRME' | 'YETKI_DEGISIKLIGI'
    | 'TALEP' | 'ONAY' | 'RET' | 'GERI_ALMA' | 'KESINLESTIRME' | 'GERI_CEKME' | 'KAYIT'
    | 'YAYIN' | 'BILGI';
/** Eski ad: log türü = kategori */
export type ActionLogType = LogCategory;

/** Sistem logu (denetim kaydı) */
export interface ActionLog {
    id: number;
    category: LogCategory;
    action: LogAction;
    level: LogLevel;
    message: string;
    createdAt: string;
    /** İşlemi yapan kişi; null ise sistem veya tanınmayan biri (başarısız giriş) */
    actorId: number | null;
    actorName: string | null;
    /** Etkilenen kayıt (KULLANICI, PROJE, GOREV, IZIN, DUYURU, TATIL, PROFIL_TALEBI) */
    targetType: string | null;
    targetId: number | null;
    targetName: string | null;
    /** Satır satır değişiklikler ("Alan: eski → yeni") */
    details: string | null;
    /** Yalnızca yöneticiye gelir */
    ipAddress: string | null;
}

export interface LogPage { items: ActionLog[]; total: number; page: number; size: number }

export interface LogStats {
    total: number;
    today: number;
    failedLogins24h: number;
    critical7d: number;
    perDay: { date: string; count: number; warnings: number }[];
    byCategory: Record<LogCategory, number>;
    topActors: { actorId: number; name: string; count: number }[];
}

export type TaskStatus = 'YAPILACAK' | 'DEVAM' | 'TAMAMLANDI';
export type TaskPriority = 'DUSUK' | 'ORTA' | 'YUKSEK';

export interface Task {
    id: number;
    userId: number;
    content: string;
    createdAt: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    projectId?: number | null;
    completedAt?: string | null;
    description?: string | null;
    /** Görevi oluşturan/atayan kişi; null = bilinmiyor (eski kayıtlar) */
    createdById?: number | null;
    createdByName?: string | null;
    commentCount?: number;
    /** Tahmini iş gücü (dakika); eski görevlerde null */
    estimatedMinutes?: number | null;
    /** Harcanan çalışma süresi (saniye; yalnızca mesai saatleri, elle düzeltme dahil) */
    spentSeconds?: number;
    /** Görev Devam Ediyor'da: çalışma oturumu açık */
    running?: boolean;
    /** Oturum açık ve şu an mesai saati: süre canlı artıyor */
    ticking?: boolean;
    /** İlk kez Devam Ediyor'a alındığı an; hiç başlanmadıysa null */
    startedAt?: string | null;
    /** İstemci: verinin yüklendiği an (canlı sayaç için) */
    fetchedAt?: number;
}

/** Görevin "Devam Ediyor"da geçen bir aralığı */
export interface TaskSession {
    id: number;
    userId: number;
    userName: string;
    startedAt: string;
    endedAt: string | null;
    /** Aralığın mesaiye düşen kısmı (saniye) */
    workSeconds: number;
}

/** Kişinin bu haftaki çalışması */
export interface Workload {
    userId: number;
    weekWorkedSeconds: number;
    todayWorkedSeconds: number;
    /** Haftalık mesai kapasitesi (tatil ve izin günleri düşülmüş) */
    weekCapacitySeconds: number;
    weekStart: string;
}

export type TaskActivityKind = 'EVENT' | 'COMMENT';

/** Görev geçmişi ve yorumları tek akışta. message işlemi yapanın adını içermez; ad actorName'den gelir. */
export interface TaskActivity {
    id: number;
    kind: TaskActivityKind;
    message: string;
    createdAt: string;
    actorId: number | null;
    actorName: string | null;
    actorAvatarColor: string | null;
}

export type LeaveType = 'YILLIK' | 'HASTALIK' | 'MAZERET';
// IPTAL: kişi İzinli'den erken çıkarıldığında o gün başlayan izin iptal edilir.
export type LeaveState = 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI' | 'IPTAL';

export interface LeaveRequest {
    id: number;
    userId: number;
    /** Çalışan, başkasının izninde türü göremez (null): yalnızca "İzinli" bilgisi */
    type: LeaveType | null;
    startDate: string; // yyyy-MM-dd
    endDate: string;   // yyyy-MM-dd
    note: string | null;
    state: LeaveState;
    createdAt: string;
    /** Kesinleşen onay/ret kararı geri alınamaz. */
    finalized: boolean;
    /** Yöneticinin karara eklediği açıklama (ör. ret nedeni) */
    decisionNote: string | null;
    decidedByName: string | null;
}

export interface Announcement {
    id: number;
    title: string;
    content: string;
    authorId: number;
    createdAt: string;
    pinned: boolean;
}

export interface ApiError {
    message: string;
}

export interface Holiday {
    id: number;
    date: string; // yyyy-MM-dd
    name: string;
}

export interface LeaveBalance {
    userId: number;
    year: number;
    entitlement: number;
    used: number;
    pending: number;
    remaining: number;
}

export type NotificationType =
    | 'TASK_ASSIGNED' | 'TASK_DUE' | 'TASK_COMPLETED' | 'TASK_COMMENT' | 'TODO_RECEIVED' | 'TODO_REMINDER' | 'TODO_LIST_ADDED' | 'TODO_COMMENT' | 'PROFILE_REQUESTED' | 'PROFILE_DECIDED' | 'LEAVE_REQUESTED' | 'LEAVE_DECIDED' | 'LEAVE_REOPENED'
    | 'PROJECT_ASSIGNED' | 'STATUS_CHANGED' | 'ANNOUNCEMENT' | 'DOC_REVISION_REQUESTED' | 'DOC_REVISION_DECIDED' | 'ONBOARDING_DONE';

export interface AppNotification {
    id: number;
    type: NotificationType;
    title: string;
    body: string | null;
    link: string | null;
    read: boolean;
    createdAt: string;
    actorId: number | null;
    actorName: string | null;
}

// ---------------- Sistem İzleme ----------------
export type HealthStatus = 'UP' | 'WARN' | 'DOWN' | 'UNKNOWN';

export interface MonitorHost {
    dockerAvailable: boolean;
    dockerError: string | null;
    serverVersion: string | null;
    operatingSystem: string | null;
    cpus: number | null;
    memTotalMb: number | null;
    containersRunning: number | null;
    containersTotal: number | null;
}

export interface MonitorSample {
    /** epoch ms */
    t: number;
    cpu: number | null;
    memMb: number | null;
    memPct: number | null;
    rx: number | null;
    tx: number | null;
    latency: number | null;
    status: HealthStatus;
}

export interface MonitorService {
    id: string;
    name: string;
    kind: string | null;
    description: string | null;
    /** false: ayarlarda tanımlı değil, compose projesinde otomatik bulundu */
    configured: boolean;
    container: string | null;
    image: string | null;
    state: string | null;
    statusText: string | null;
    startedAt: number | null;
    restartCount: number | null;
    dockerHealth: string | null;
    status: HealthStatus;
    reasons: string[];
    cpuPercent: number | null;
    memUsedMb: number | null;
    memLimitMb: number | null;
    memPercent: number | null;
    /** false: konteynerin bellek sınırı yok; yüzde Docker makinesinin belleğine göre */
    memLimited: boolean;
    netRxRate: number | null;
    netTxRate: number | null;
    diskReadRate: number | null;
    diskWriteRate: number | null;
    pids: number | null;
    check: { type: string; target: string | null; up: boolean; latencyMs: number; message: string } | null;
    details: { label: string; value: string; hint: string | null }[];
    history: MonitorSample[];
}

export interface MonitorOverview {
    sampledAt: number;
    sampleSeconds: number;
    historyMinutes: number;
    warnPercent: number;
    host: MonitorHost;
    services: MonitorService[];
}

// ---------------- Kişisel alan: yapılacaklar ----------------
export interface TodoStep { id: number; title: string; done: boolean; position: number }

export type TodoListRole = 'ADMIN' | 'MEMBER';

export interface TodoListMember { userId: number; fullName: string; role: TodoListRole }

export interface TodoList {
    id: number;
    name: string;
    color: string | null;
    position: number;
    /** Oturumdaki kişinin bu listedeki yetkisi (uygulamadaki rolünden bağımsız) */
    myRole: TodoListRole;
    /** Birden fazla üye varsa liste ortaktır: üyeler içindeki tüm kartları görür */
    members: TodoListMember[];
}

export type TodoRepeat = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY';

export interface TodoItem {
    id: number;
    /** null = varsayılan "Genel" listesi */
    listId: number | null;
    title: string;
    note: string | null;
    done: boolean;
    doneAt: string | null;
    important: boolean;
    /** "Bugün" görünümüne eklendi mi (ertesi gün kendiliğinden düşer) */
    myDay: boolean;
    dueDate: string | null;
    /** "SS:dd"; tarihle birlikte hatırlatma zamanı */
    dueTime: string | null;
    /** Tamamlanınca sonraki tarihe yenisi açılır */
    repeatRule: TodoRepeat | null;
    /** Kart bir DevHub görevinden plana eklendiyse o görev */
    taskId: number | null;
    position: number;
    /** Kart başka birinden geldiyse gönderen */
    sentById: number | null;
    sentByName: string | null;
    sentMessage: string | null;
    seen: boolean;
    /** Kartı ekleyen kişi (ortak listelerde başkası olabilir) */
    ownerId: number;
    ownerName: string;
    /** Kartı tamamlayan kişi */
    doneById: number | null;
    doneByName: string | null;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
    steps: TodoStep[];
}

export interface TodoComment { id: number; userId: number; userName: string; body: string; createdAt: string }

export interface TodoData { lists: TodoList[]; items: TodoItem[] }

// ---------------- Profil değişikliği talepleri ----------------
export type ProfileRequestState = 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI' | 'IPTAL';

/** Ad soyad / unvan değişikliği: çalışan ister, yönetici onaylar. */
export interface ProfileRequest {
    id: number;
    userId: number;
    fullName: string;
    jobTitle: string | null;
    previousFullName: string;
    previousJobTitle: string | null;
    state: ProfileRequestState;
    decisionNote: string | null;
    decidedByName: string | null;
    decidedAt: string | null;
    createdAt: string;
}

// ---------- Dokümantasyon ----------
/** Editörün (TipTap / ProseMirror) belge düğümü; dokümanlar bu biçimde saklanır. */
export interface DocMark { type: string; attrs?: Record<string, unknown> }
export interface DocNode { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; text?: string; marks?: DocMark[] }

export interface DocSummary {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  tags: string[];
  sortOrder: number;
  version: number;
  plainText: string;
  createdById: number | null;
  createdByName: string | null;
  updatedById: number | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocDetail extends DocSummary {
  content: DocNode;
  /** yönetici için: bu dokümanda onay bekleyen öneri sayısı */
  pendingCount: number;
  /** oturumdaki kişinin bu doküman için bekleyen önerisi */
  myPendingRevisionId: number | null;
}

export type DocRevisionStatus = 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI' | 'GERI_CEKILDI';

export interface DocRevision {
  id: number;
  docId: number | null;
  docSlug: string | null;
  docTitle: string | null;
  docVersion: number | null;
  isNew: boolean;
  title: string;
  summary: string | null;
  category: string;
  tags: string[];
  baseVersion: number | null;
  /** öneri hazırlandıktan sonra doküman başka bir değişiklikle güncellendi */
  outdated: boolean;
  note: string | null;
  status: DocRevisionStatus;
  authorId: number | null;
  authorName: string | null;
  decidedById: number | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** listelerde null */
  content: DocNode | null;
}

// ---------- İşe başlangıç listesi ----------
/** Adımın kendiliğinden tamamlanma kuralı; null = kişi işaretler */
export type OnboardingRule = 'SIFRE' | 'ILETISIM' | 'DOKUMAN';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string | null;
  /** uygulama içi adres (/docs/...) ya da https bağlantısı */
  link: string | null;
  autoRule: OnboardingRule | null;
  position: number;
}

export interface OnboardingMyStep extends Omit<OnboardingStep, 'position'> {
  done: boolean;
  doneAt: string | null;
}

export interface OnboardingStatus {
  /** false: kişi için liste açılmamış */
  active: boolean;
  startedAt: string | null;
  completedAt: string | null;
  /** tamamlanan kart Genel Bakış'tan kaldırıldı */
  closed: boolean;
  done: number;
  total: number;
  steps: OnboardingMyStep[];
}

export interface OnboardingProgress {
  userId: number;
  fullName: string;
  startedAt: string;
  completedAt: string | null;
  done: number;
  total: number;
  doneStepIds: number[];
}
