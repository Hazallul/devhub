import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SignOut } from '@phosphor-icons/react';
import { Avatar } from '../ui/primitives';
import { useMe } from '../../hooks/api';
import api from '../../services/api';
import { clearSession } from '../../lib/session';

/**
 * Oturumu kapatır: önce sunucuya bildirilir (sistem loglarına "Oturumu kapattı" düşer), yanıt beklenmeden de olsa
 * belirteç silinir ve önbellek temizlenir; böylece bir sonraki kullanıcı öncekinin verisini görmez.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLogout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return () => {
    api.post('/auth/logout').catch(() => undefined).finally(() => {
      clearSession();
      qc.clear();
      navigate('/login');
    });
  };
}

/** Kenar çubuğunun altındaki kullanıcı kartı: ad, rol/unvan ve çıkış (uygulama menüsü ve kişisel alanda ortak). */
export default function UserCard() {
  const me = useMe();
  const logout = useLogout();
  return (
    <div className="bg-theme-cream p-3 rounded-3xl flex items-center gap-3 border border-theme-light/40">
      <Avatar user={me} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-theme-text truncate">{me.fullName}</p>
        <p className="text-xs text-theme-muted font-medium truncate">{me.role === 'ADMIN' ? 'Yönetici' : me.jobTitle || 'Çalışan'}</p>
      </div>
      <button onClick={logout} className="icon-btn hover:text-[#9A3B1B] hover:bg-[#FBEDE5]" aria-label="Çıkış yap" title="Çıkış yap">
        <SignOut size={20} weight="bold" />
      </button>
    </div>
  );
}
