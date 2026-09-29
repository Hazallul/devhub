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
