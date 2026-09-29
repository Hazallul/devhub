import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, UserCircle, ShieldCheck, Key, Eye, EyeSlash, CalendarBlank, Plus, Trash } from '@phosphor-icons/react';
import { PageHeader, Avatar, StatusBadge } from '../components/ui/primitives';
import { useMe, useUpdateProfile, useChangePassword, useHolidays, useCreateHoliday, useDeleteHoliday } from '../hooks/api';
import { AVATAR_COLORS } from '../lib/meta';
import { toDate } from '../lib/format';

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
                <li>Herkesin durumunu ve çalışma şeklini değiştirebilir</li>
                <li>Proje oluşturur, kişileri projelere atar</li>
                <li>İzin taleplerini onaylar, duyuru yayınlar</li>
                <li>Kullanıcıları ve resmi tatilleri yönetir</li>
              </> : <>
                <li>Kendi durumunu çalışma şekli ile Toplantıda arasında değiştirir</li>
                <li>Kendi görevlerini yönetir</li>
                <li>İzin için talep oluşturur</li>
              </>}
            </ul>
          </section>

          <PasswordCard />
        </div>

        <HolidaysCard />
      </div>
    </>
  );
}

function PasswordCard() {
  const me = useMe();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(next) || !/\d/.test(next)) {
      setError('Yeni şifre en az 8 karakter olmalı ve harf ile rakam içermeli.');
      return;
    }
    if (next !== repeat) { setError('Yeni şifreler birbiriyle aynı değil.'); return; }
    setError('');
    change.mutate({ currentPassword: current, newPassword: next }, {
      onSuccess: (user) => {
        setCurrent(''); setNext(''); setRepeat('');
        try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* yok say */ }
      },
    });
  };

  const type = show ? 'text' : 'password';
  return (
    <form onSubmit={submit} className={`card p-6 space-y-4 ${me.mustChangePassword ? 'ring-2 ring-[#E8C3AE]' : ''}`} aria-labelledby="pw-title">
      <div className="flex items-center justify-between">
        <h2 id="pw-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><Key size={20} weight="duotone" className="text-theme-deep" /> Şifre</h2>
        <button type="button" onClick={() => setShow(s => !s)} className="icon-btn w-9 h-9" aria-label={show ? 'Şifreleri gizle' : 'Şifreleri göster'}>
          {show ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
        </button>
      </div>
      {me.mustChangePassword && <p className="text-sm font-semibold text-[#7A3E1F]">Geçici şifreyle giriş yaptınız; lütfen yeni bir şifre belirleyin.</p>}
      <div>
        <label htmlFor="pw-current" className="label">Mevcut şifre</label>
        <input id="pw-current" type={type} autoComplete="current-password" className="input" value={current} onChange={e => setCurrent(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="pw-new" className="label">Yeni şifre</label>
        <input id="pw-new" type={type} autoComplete="new-password" className="input" value={next} onChange={e => setNext(e.target.value)} aria-describedby="pw-help" required />
        <p id="pw-help" className="text-xs text-theme-muted mt-1.5 ml-1">En az 8 karakter; harf ve rakam içermeli.</p>
      </div>
      <div>
        <label htmlFor="pw-repeat" className="label">Yeni şifre (tekrar)</label>
        <input id="pw-repeat" type={type} autoComplete="new-password" className="input" value={repeat} onChange={e => setRepeat(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[#9A3B1B]">{error}</p>}
      <button type="submit" disabled={change.isPending || !current || !next || !repeat} className="btn-primary w-full">
        {change.isPending ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
      </button>
    </form>
  );
}

const holidayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/** Resmi tatiller: herkes görür, yönetici ekler/siler. İzin iş günü hesabı bu listeye göre yapılır. */
function HolidaysCard() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { data: holidays } = useHolidays();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const years = useMemo(() => {
    const ys = new Set((holidays ?? []).map(h => Number(h.date.slice(0, 4))));
    ys.add(thisYear);
    return [...ys].sort();
  }, [holidays, thisYear]);
  const list = (holidays ?? []).filter(h => h.date.startsWith(String(year)));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !name.trim()) return;
    create.mutate({ date, name: name.trim() }, { onSuccess: () => { setDate(''); setName(''); setYear(Number(date.slice(0, 4))); } });
  };

  return (
    <section className="card p-6 sm:p-8 lg:col-span-3" aria-labelledby="holiday-title">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h2 id="holiday-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><CalendarBlank size={20} weight="duotone" className="text-theme-deep" /> Resmi Tatiller</h2>
        <div className="flex gap-1" role="tablist" aria-label="Yıl">
          {years.map(y => (
            <button key={y} type="button" role="tab" aria-selected={y === year} onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold tabular transition-colors ${y === year ? 'bg-theme-lightest text-theme-deep border border-theme-light' : 'text-theme-muted hover:text-theme-deep'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-theme-muted mb-5">İzin günleri hesaplanırken hafta sonları ve bu listedeki tam gün tatiller iş gününden düşülür. Arife yarım günleri iş günü sayılır.</p>

      {list.length === 0 ? (
        <p className="text-sm text-theme-muted py-6 text-center bg-theme-cream/60 rounded-2xl">{year} için kayıtlı resmi tatil yok.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <AnimatePresence initial={false}>
            {list.map(h => (
              <motion.li key={h.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="group flex items-center gap-3 p-3 rounded-2xl bg-theme-cream/70 border border-theme-light/50">
                <span className="w-10 h-10 rounded-xl bg-[#F3E1D6] text-[#8A4B2A] flex flex-col items-center justify-center leading-none shrink-0">
                  <span className="text-sm font-bold tabular">{toDate(h.date).getDate()}</span>
                  <span className="text-[9px] font-bold uppercase">{new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(toDate(h.date))}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{h.name}</span>
                  <span className="block text-xs text-theme-muted">{holidayFmt.format(toDate(h.date))}</span>
                </span>
                {isAdmin && (
                  <button type="button" onClick={() => remove.mutate(h.id)} className="icon-btn w-8 h-8 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#9A3B1B] hover:bg-[#FBEDE5]" aria-label={`${h.name} tatilini kaldır`}>
                    <Trash size={15} weight="bold" />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mt-5 pt-5 border-t border-theme-light/40">
          <label htmlFor="h-date" className="sr-only">Tarih</label>
          <input id="h-date" type="date" className="input sm:w-48" value={date} onChange={e => setDate(e.target.value)} required />
          <label htmlFor="h-name" className="sr-only">Tatil adı</label>
          <input id="h-name" className="input flex-1" placeholder="Tatil adı (örn: Ramazan Bayramı 1. gün)" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
          <button type="submit" disabled={create.isPending || !date || !name.trim()} className="btn-primary"><Plus size={16} weight="bold" /> Ekle</button>
        </form>
      )}
    </section>
  );
}
