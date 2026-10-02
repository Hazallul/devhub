import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { SignOut, SlidersHorizontal, CaretDown, Gear, Sun, Moon } from '@phosphor-icons/react';
import { Menu, MenuItem, MenuLabel, MenuDivider } from '../ui/Menu';
import { useQuickActions } from './QuickActions';
import { setThemePref, useTheme } from '../../lib/theme';
import { USER_STATUS, statusOptions, statusHint } from '../../lib/meta';
import type { UserStatus } from '../../types';
import { Avatar } from '../ui/primitives';
import { useMe, useUpdateStatus } from '../../hooks/api';
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

/**
 * Kenar çubuğunun altındaki kullanıcı kartı (uygulama menüsü ve kişisel alanda ortak): ad, durum seçici ve
 * ayarlar menüsü (Ayarlar, tema, çıkış). Durum kuralları statusOptions'ta (çalışan yalnızca izinli değilse değiştirir).
 */
export default function UserCard() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const updateStatus = useUpdateStatus();
  const [, dark] = useTheme();
  const [statusEl, setStatusEl] = useState<HTMLButtonElement | null>(null);
  const [menuEl, setMenuEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<'status' | 'menu' | null>(null);
  const statuses = statusOptions(me, me);
  const hint = statusHint(me, me);
  const meta = me.status ? USER_STATUS[me.status] : null;

  const pick = (s: UserStatus) => {
    setOpen(null);
    if (s === me.status) return;
    if (s === 'IZINLI') actions.newLeave(me);
    else updateStatus.mutate({ userId: me.id, status: s });
  };

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-surface border border-theme-light">
      <Avatar user={me} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-theme-text truncate leading-tight">{me.fullName}</p>
        <button
          ref={setStatusEl}
          type="button"
          onClick={() => setOpen(o => (o === 'status' ? null : 'status'))}
          aria-haspopup="menu"
          aria-expanded={open === 'status'}
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-theme-muted hover:text-theme-text rounded-md"
          aria-label={`Durumun: ${meta?.label ?? 'belirtilmedi'}, değiştir`}
        >
          {meta && <meta.icon size={12} weight="fill" aria-hidden="true" />}
          {meta?.label ?? 'Durum yok'}
          <CaretDown size={11} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <button ref={setMenuEl} type="button" onClick={() => setOpen(o => (o === 'menu' ? null : 'menu'))} aria-haspopup="menu" aria-expanded={open === 'menu'}
        className="icon-btn w-8 h-8" aria-label="Hesap ve ayarlar" title="Hesap ve ayarlar">
        <SlidersHorizontal size={18} />
      </button>

      <Menu open={open === 'status'} onClose={() => setOpen(null)} anchor={statusEl} width={210} label="Durumunu değiştir">
        <MenuLabel>Durumunu değiştir</MenuLabel>
        {statuses.map(s => (
          <MenuItem key={s} icon={USER_STATUS[s].icon} active={me.status === s} onSelect={() => pick(s)}>{USER_STATUS[s].label}</MenuItem>
        ))}
        {hint && <p className="text-[0.6875rem] text-theme-muted px-2.5 pt-1.5 pb-1 leading-snug">{hint}</p>}
      </Menu>

      <Menu open={open === 'menu'} onClose={() => setOpen(null)} anchor={menuEl} width={210} label="Hesap">
        <MenuItem icon={Gear} onSelect={() => { setOpen(null); navigate('/settings'); }}>Ayarlar</MenuItem>
        <MenuItem icon={dark ? Sun : Moon} onSelect={() => { setOpen(null); setThemePref(dark ? 'light' : 'dark'); }}>{dark ? 'Açık tema' : 'Koyu tema'}</MenuItem>
        <MenuDivider />
        <MenuItem icon={SignOut} tone="danger" onSelect={() => { setOpen(null); logout(); }}>Çıkış yap</MenuItem>
      </Menu>
    </div>
  );
}
