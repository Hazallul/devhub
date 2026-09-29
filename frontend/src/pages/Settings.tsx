import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, UserCircle, ShieldCheck } from '@phosphor-icons/react';
import { PageHeader, Avatar, StatusBadge } from '../components/ui/primitives';
import { useMe, useUpdateProfile } from '../hooks/api';
import { AVATAR_COLORS } from '../lib/meta';

export default function Settings() {
  const me = useMe();
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState(me.fullName);
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? '');
  const [color, setColor] = useState(me.avatarColor ?? AVATAR_COLORS[1]);
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(me.fullName);
    setJobTitle(me.jobTitle ?? '');
    setColor(me.avatarColor ?? AVATAR_COLORS[1]);
  }, [me.fullName, me.jobTitle, me.avatarColor]);

  const dirty = fullName !== me.fullName || jobTitle !== (me.jobTitle ?? '') || color !== me.avatarColor;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) { setError('Ad soyad en az 3 karakter olmalı.'); return; }
    setError('');
    update.mutate({ userId: me.id, fullName: fullName.trim(), jobTitle: jobTitle.trim(), avatarColor: color }, {
      onSuccess: (user) => {
        // Oturumdaki kullanıcı bilgisini de tazele.
        try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* yok say */ }
      },
    });
  };

  return (
    <>
      <PageHeader eyebrow="Ayarlar" title="Ayarlar" description="Profilinizi ve uygulama tercihlerinizi yönetin." />

      <div className="grid lg:grid-cols-3 gap-6 pb-10">
        <form onSubmit={save} className="card p-6 sm:p-8 lg:col-span-2 space-y-6" aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><UserCircle size={22} weight="duotone" className="text-theme-deep" /> Profil</h2>

          <div className="flex items-center gap-5">
            <motion.div key={color} initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <Avatar user={{ fullName: fullName || me.fullName, avatarColor: color, status: me.status }} size="lg" />
            </motion.div>
            <div>
              <p className="text-lg font-bold">{fullName || me.fullName}</p>
              <p className="text-sm text-theme-muted font-medium">{jobTitle || 'Unvan belirtilmedi'}</p>
              <div className="mt-2"><StatusBadge status={me.status} size="sm" /></div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="s-name" className="label">Ad soyad</label>
              <input id="s-name" value={fullName} onChange={e => setFullName(e.target.value)} aria-invalid={!!error} aria-describedby="s-name-err" className="input" autoComplete="name" />
              {error && <p id="s-name-err" role="alert" className="text-xs font-semibold text-[#9A3B1B] mt-1.5 ml-1">{error}</p>}
            </div>
            <div>
              <label htmlFor="s-title" className="label">Unvan</label>
              <input id="s-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Örn: Backend Developer" className="input" autoComplete="organization-title" />
            </div>
          </div>

          <fieldset>
            <legend className="label">Avatar rengi</legend>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Renk ${c}`}
                  aria-pressed={color === c}
                  className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-transform hover:scale-105 ${color === c ? 'border-theme-deep' : 'border-white shadow-soft'}`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check size={18} weight="bold" className="text-theme-text" />}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-theme-light/40">
            <p className="text-sm text-theme-muted font-medium pt-4">{me.email}</p>
            <div className="flex gap-3 pt-4">
              {dirty && (
                <button type="button" onClick={() => { setFullName(me.fullName); setJobTitle(me.jobTitle ?? ''); setColor(me.avatarColor ?? AVATAR_COLORS[1]); setError(''); }} className="btn-ghost">
                  Geri al
                </button>
              )}
              <button type="submit" disabled={!dirty || update.isPending} className="btn-primary">{update.isPending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}</button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="role-title">
            <h2 id="role-title" className="text-lg font-bold tracking-tight flex items-center gap-2 mb-3"><ShieldCheck size={20} weight="duotone" className="text-theme-deep" /> Yetkiler</h2>
            <p className="text-sm font-semibold mb-2">{me.role === 'ADMIN' ? 'Yönetici' : 'Çalışan'}</p>
            <ul className="text-sm text-theme-muted space-y-1.5 list-disc pl-5">
              {me.role === 'ADMIN' ? <>
                <li>Herkesin durumunu (İzinli dahil) değiştirebilir</li>
                <li>Proje oluşturur, kişileri projelere atar</li>
                <li>İzin taleplerini onaylar, duyuru yayınlar</li>
              </> : <>
                <li>Kendi durumunu Aktif / Toplantıda / Uzaktan yapabilir</li>
                <li>Kendi görevlerini yönetir</li>
                <li>İzin için talep oluşturur</li>
              </>}
            </ul>
          </section>

        </div>
      </div>
    </>
  );
}
