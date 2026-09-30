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
    annualLeaveDays: number;
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

export type ActionLogType = 'PROJE' | 'IZIN' | 'GOREV' | 'SISTEM';

export interface ActionLog {
    id: number;
    message: string;
    createdAt: string;
    /** İşlemi yapan kişi; null ise sistem */
    actorId: number | null;
    actorName: string | null;
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
    | 'PROJECT_ASSIGNED' | 'STATUS_CHANGED' | 'ANNOUNCEMENT';

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
