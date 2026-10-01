import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, CalendarBlank, Plus, Trash } from '@phosphor-icons/react';
import { PageHeader } from '../components/ui/primitives';
import ProfileCard from '../components/settings/ProfileCard';
import { useMe, useHolidays, useCreateHoliday, useDeleteHoliday } from '../hooks/api';
import PasswordCard from '../components/settings/PasswordCard';
import { toDate } from '../lib/format';

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
                <li>Kullanıcıları ve resmi tatilleri yönetir</li>
                <li>Profil değişikliği taleplerini onaylar</li>
              </> : <>
                <li>Kendi durumunu çalışma şekli ile Toplantıda arasında değiştirir</li>
                <li>Kendi görevlerini yönetir</li>
                <li>İzin için talep oluşturur</li>
                <li>Ad soyad ve unvan değişikliğini yönetici onayına gönderir</li>
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
