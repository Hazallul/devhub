import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAction } from './api';
import { clearSession } from '../lib/session';

export type BackupKind = 'OTOMATIK' | 'ELLE' | 'GERI_YUKLEME_ONCESI' | 'YUKLENEN';

export interface Backup {
  name: string;
  kind: BackupKind;
  kindLabel: string;
  /** UTC, ofsetsiz (parseServerDate ile okunur) */
  createdAt: string;
  sizeBytes: number;
  schemaVersion: number | null;
  createdBy: string | null;
  /** Uygulamanın şimdiki sürümüyle aynı şemada: geri yüklenebilir */
  restorable: boolean;
}

export interface BackupOverview {
  items: Backup[];
  intervalDays: number;
  keepAuto: number;
  lastAutomaticAt: string | null;
  nextAutomaticAt: string | null;
}

export const useBackups = () =>
  useQuery({ queryKey: ['backups'], queryFn: async () => (await api.get<BackupOverview>('/admin/backups')).data });

export const useCreateBackup = () =>
  useAction(() => api.post<Backup>('/admin/backups').then(r => r.data), { invalidate: [['backups'], ['logs']], success: 'Yedek alındı' });

export const useDeleteBackup = () =>
  useAction((name: string) => api.delete(`/admin/backups/${name}`), { invalidate: [['backups'], ['logs']], success: 'Yedek silindi' });

export const useUploadBackup = () =>
  useAction(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Backup>('/admin/backups/upload', form).then(r => r.data);
    },
    { invalidate: [['backups']], success: 'Yedek dosyası yüklendi. Listeden geri yükleyebilirsiniz.' },
  );

/**
 * Geri yükleme bütün veriyi değiştirir ve herkesin oturumunu kapatır: başarılı olunca oturum temizlenir ve giriş sayfası
 * tamamen yeniden yüklenir (eski veriyle dolu önbellek kalmasın).
 */
export const useRestoreBackup = () =>
  useAction(
    ({ name, confirm }: { name: string; confirm: string }) => api.post(`/admin/backups/${name}/restore`, { confirm }).then(() => {
      clearSession();
      window.location.assign('/login?geriYuklendi=1');
    }),
    { invalidate: [] },
  );
