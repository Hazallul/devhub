import { ShieldCheck, Palette, Sun, Moon, Desktop } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { setThemePref, setUiScale, useTheme, useUiScale } from '../lib/theme';
import type { ThemePref, UiScale } from '../lib/theme';
import { PageHeader } from '../components/ui/primitives';
import ProfileCard from '../components/settings/ProfileCard';
import { useMe } from '../hooks/api';
import PasswordCard from '../components/settings/PasswordCard';

export default function Settings() {
  const me = useMe();

  return (
    <>
      <PageHeader eyebrow="Ayarlar" title="Ayarlar" description="Profilinizi ve uygulama tercihlerinizi yönetin." />

      <div className="grid lg:grid-cols-3 gap-6 pb-10">
        <ProfileCard />

        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="role-title">
            <h2 id="role-title" className="text-lg font-bold tracking-tight flex items-center gap-2 mb-3"><ShieldCheck size={20} weight="duotone" className="text-theme-deep" /> Yetkiler</h2>
            <p className="text-sm font-semibold mb-2">{me.role === 'ADMIN' ? 'Yönetici' : 'Çalışan'}</p>
            <ul className="text-sm text-theme-muted space-y-1.5 list-disc pl-5">
              {me.role === 'ADMIN' ? <>
                <li>Herkesin durumunu ve çalışma şeklini değiştirebilir</li>
                <li>Proje oluşturur, kişileri projelere atar</li>
                <li>İzin taleplerini onaylar, duyuru yayınlar</li>
                <li>Kullanıcıları yönetir</li>
                <li>Profil değişikliği taleplerini onaylar</li>
              </> : <>
                <li>Kendi durumunu çalışma şekli ile Toplantıda arasında değiştirir</li>
                <li>Kendi görevlerini yönetir</li>
                <li>İzin için talep oluşturur</li>
                <li>Ad soyad ve unvan değişikliğini yönetici onayına gönderir</li>
              </>}
            </ul>
          </section>

          <AppearanceCard />

          <PasswordCard />
        </div>

      </div>
    </>
  );
}

const THEMES: { value: ThemePref; label: string; hint: string; icon: Icon }[] = [
  { value: 'light', label: 'Açık', hint: 'Bej zemin', icon: Sun },
  { value: 'dark', label: 'Koyu', hint: 'Akşam için', icon: Moon },
  { value: 'system', label: 'Sistem', hint: 'Cihaza uyar', icon: Desktop },
];

const SCALES: { value: UiScale; label: string; hint: string }[] = [
  { value: '0.75', label: 'Kompakt', hint: 'Daha çok içerik' },
  { value: '0.875', label: 'Orta', hint: '%87' },
  { value: '1', label: 'Rahat', hint: 'Büyük yazı' },
];

/** Tema ve ölçek tercihi: bu cihaza kaydedilir. Üst bardaki güneş/ay düğmesi de temayı değiştirir. */
function AppearanceCard() {
  const [pref] = useTheme();
  const scale = useUiScale();
  return (
    <section className="card p-6" aria-labelledby="theme-title">
      <h2 id="theme-title" className="text-lg font-bold tracking-tight flex items-center gap-2 mb-1"><Palette size={20} weight="duotone" className="text-theme-deep" /> Görünüm</h2>
      <p className="text-sm text-theme-muted mb-4">Bu cihazda kullanılacak tema.</p>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {THEMES.map(t => {
          const on = pref === t.value;
          return (
            <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => setThemePref(t.value)}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border text-sm font-semibold transition-colors ${
                on ? 'bg-theme-lightest border-theme-medium text-theme-deep' : 'border-theme-light/60 text-theme-muted hover:border-theme-medium hover:text-theme-deep'}`}>
              <t.icon size={22} weight={on ? 'fill' : 'duotone'} />
              {t.label}
              <span className="text-[0.6875rem] font-medium text-theme-muted">{t.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold mt-5 mb-2">Arayüz boyutu</p>
      <div role="radiogroup" aria-label="Arayüz boyutu" className="grid grid-cols-3 gap-2">
        {SCALES.map(s => {
          const on = scale === s.value;
          return (
            <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => setUiScale(s.value)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-2xl border text-sm font-semibold transition-colors ${
                on ? 'bg-theme-lightest border-theme-medium text-theme-deep' : 'border-theme-light/60 text-theme-muted hover:border-theme-medium hover:text-theme-deep'}`}>
              <span style={{ fontSize: `${Number(s.value) * 1.1}rem` }} className="font-bold leading-none" aria-hidden="true">Aa</span>
              {s.label}
              <span className="text-[0.6875rem] font-medium text-theme-muted">{s.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
