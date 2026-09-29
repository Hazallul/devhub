export type Role = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'AKTIF' | 'TOPLANTIDA' | 'UZAKTAN' | 'IZINLI';

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
    type: LeaveType;
    startDate: string; // yyyy-MM-dd
    endDate: string;   // yyyy-MM-dd
    note: string | null;
    state: LeaveState;
    createdAt: string;
    /** Kesinleşen onay/ret kararı geri alınamaz. */
    finalized: boolean;
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
    | 'TASK_ASSIGNED' | 'TASK_DUE' | 'TASK_COMPLETED' | 'TASK_COMMENT' | 'LEAVE_REQUESTED' | 'LEAVE_DECIDED' | 'LEAVE_REOPENED'
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
