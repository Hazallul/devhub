import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MagnifyingGlass, MicrosoftExcelLogo, FileCsv, CaretDown, ListDashes, Pulse, WarningOctagon, ShieldWarning, UserCircle, Funnel, X, Copy, ArrowSquareOut, User as UserIcon,
} from '@phosphor-icons/react';
import { PageHeader, StatCard, Skeleton, EmptyState, Avatar, Segmented } from '../components/ui/primitives';
import { useContextMenu, usePageMenu } from '../components/layout/ContextMenu';
import { useToast } from '../components/ui/Toast';
import Combobox from '../components/ui/Combobox';
import type { ComboOption } from '../components/ui/Combobox';
import { useAdminUsers, useMe, useLogSearch, useLogStats, downloadLogs } from '../hooks/api';
import type { LogFilters } from '../hooks/api';
import { LOG_ACTION, LOG_CATEGORY, LOG_CATEGORIES, LOG_LEVEL, logActorName } from '../lib/meta';
import { formatLongDate, parseServerDate, toIsoDay, addDays } from '../lib/format';
import type { ActionLog, LogAction, LogCategory, LogLevel, User } from '../types';

type LevelFilter = 'ALL' | LogLevel;

/** Özet kartları, kategori listesi ve gün çubukları bu "hazır filtre"lerden birini uygular: diğer filtreler sıfırlanır. */
interface Preset { category?: LogCategory; level?: LogLevel; action?: LogAction; actorId?: string; from?: string; to?: string; sinceHours?: number }
const sinceLabel = (h: number) => (h === 24 ? 'Son 24 saat' : h % 24 === 0 ? `Son ${h / 24} gün` : `Son ${h} saat`);
const dayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/** Sistem logları (yalnızca yönetici): kim, ne zaman, hangi adresten, neyi değiştirdi. */
export default function Logs() {
  const me = useMe();
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <LogsPage />;
}

function LogsPage() {
  const toast = useToast();
  const { data: users } = useAdminUsers();
  const { data: stats } = useLogStats();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<LogCategory | ''>('');
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const [actorId, setActorId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState<LogAction | ''>('');
  const [sinceHours, setSinceHours] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Arama kutusu: yazmayı bırakınca sorgula
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: LogFilters = useMemo(() => ({
    q: q || undefined,
    category: category || undefined,
    level: level === 'ALL' ? undefined : level,
    actorId: actorId === '' ? undefined : Number(actorId),
    from: from || undefined,
    to: to || undefined,
    action: action || undefined,
    sinceHours: sinceHours ?? undefined,
  }), [q, category, level, actorId, from, to, action, sinceHours]);
  const active = Object.values(filters).some(v => v !== undefined);
  const clear = () => { setSearch(''); setQ(''); setCategory(''); setLevel('ALL'); setActorId(''); setFrom(''); setTo(''); setAction(''); setSinceHours(null); };

  /** Hazır filtreyi uygular ve listeye kaydırır: kullanıcı tıkladığının sonucunu hemen görür. */
  const applyPreset = (p: Preset) => {
    clear();
    if (p.category) setCategory(p.category);
    if (p.level) setLevel(p.level);
    if (p.action) setAction(p.action);
    if (p.actorId !== undefined) setActorId(p.actorId);
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
    if (p.sinceHours) setSinceHours(p.sinceHours);
    setFlash(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 60);
  };
  /** Şu anki filtreler tam olarak bu hazır filtre mi (kart/kategori seçili görünsün, ikinci tıklama kaldırsın) */
  const isPreset = (p: Preset) =>
    !q && (p.category ?? '') === category && (p.level ?? 'ALL') === level && (p.action ?? '') === action && (p.actorId ?? '') === actorId
    && (p.from ?? '') === from && (p.to ?? '') === to && (p.sinceHours ?? null) === sinceHours;
  const togglePreset = (p: Preset) => (isPreset(p) ? clear() : applyPreset(p));

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  const result = useLogSearch(filters);
  const items = useMemo(() => result.data?.pages.flatMap(p => p.items) ?? [], [result.data]);
  const total = result.data?.pages[0]?.total ?? 0;

  const exportLogs = async (format: 'xlsx' | 'csv') => {
    setExporting(true);
    try {
      await downloadLogs(filters, format);
      toast.success(format === 'xlsx' ? `${total} kayıt Excel dosyası olarak indirildi` : `${total} kayıt CSV olarak indirildi`);
    } catch {
      toast.error('Loglar indirilemedi.');
    } finally {
      setExporting(false);
    }
  };

  usePageMenu([
    { label: 'Excel olarak indir', icon: MicrosoftExcelLogo, onSelect: () => exportLogs('xlsx') },
    { label: 'CSV olarak indir', icon: FileCsv, onSelect: () => exportLogs('csv') },
    active && { label: 'Filtreleri temizle', icon: X, onSelect: clear },
  ]);

  const toggle = (id: number) => setExpanded(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Kayıtlar gün gün gruplanır (İstanbul saati)
  const groups = useMemo(() => {
    const today = toIsoDay(new Date());
    const yesterday = toIsoDay(addDays(new Date(), -1));
    const map = new Map<string, ActionLog[]>();
    items.forEach(l => {
      const day = toIsoDay(parseServerDate(l.createdAt));
      map.set(day, [...(map.get(day) ?? []), l]);
    });
    return [...map.entries()].map(([day, list]) => ({
      day,
      label: day === today ? 'Bugün' : day === yesterday ? 'Dün' : formatLongDate(parseServerDate(list[0].createdAt)),
      list,
    }));
  }, [items]);

  const top = stats?.topActors[0];
  const categoryOptions: ComboOption[] = useMemo(() => [
    { value: '', label: 'Tüm kategoriler', leading: <span className="w-6 h-6 rounded-lg bg-theme-cream flex items-center justify-center"><ListDashes size={13} weight="bold" aria-hidden="true" /></span> },
    ...LOG_CATEGORIES.map(c => {
      const m = LOG_CATEGORY[c];
      return { value: c, label: m.label, leading: <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${m.className}`}><m.icon size={13} weight="bold" aria-hidden="true" /></span> };
    }),
  ], []);
  const personOptions: ComboOption[] = useMemo(() => [
    { value: '', label: 'Herkes', leading: <span className="w-7 h-7 rounded-lg bg-theme-cream flex items-center justify-center text-theme-deep"><UserCircle size={15} weight="bold" aria-hidden="true" /></span> },
    { value: '0', label: 'Sistem / bilinmeyen', hint: 'Zamanlanmış işler, başarısız girişler', leading: <span className="w-7 h-7 rounded-lg bg-theme-lightest flex items-center justify-center text-theme-muted"><Pulse size={15} weight="bold" aria-hidden="true" /></span> },
    ...(users ?? []).slice().sort((a: User, b: User) => a.fullName.localeCompare(b.fullName, 'tr')).map(u => ({
      value: String(u.id),
      label: u.fullName,
      hint: [u.jobTitle, u.role === 'ADMIN' ? 'Yönetici' : null, u.active === false ? 'Pasif hesap' : null].filter(Boolean).join(' · ') || undefined,
      leading: <Avatar user={{ fullName: u.fullName, avatarColor: u.avatarColor, status: null }} size="xs" />,
    })),
  ], [users]);
  // Özet sayıları son 14 günün; liste de aynı aralıkla süzülür ki sayılar tutsun.
  const windowStart = stats?.perDay[0]?.date ?? '';
  const presets = {
    all: { from: windowStart },
    failed: { action: 'GIRIS_BASARISIZ' as LogAction, sinceHours: 24 },
    critical: { level: 'KRITIK' as LogLevel, sinceHours: 24 * 7 },
    top: top ? { actorId: String(top.actorId), from: windowStart } : null,
  };
  const actorName = (id: string) => (id === '0' ? 'Sistem / bilinmeyen' : users?.find(u => String(u.id) === id)?.fullName ?? `#${id}`);
  const dayLabel = (d: string) => dayMonth.format(new Date(`${d}T00:00:00`));
  type Chip = { key: string; label: string; remove: () => void };
  const chips: Chip[] = [
    q ? { key: 'q', label: `Arama: “${q}”`, remove: () => { setSearch(''); setQ(''); } } : null,
    category ? { key: 'c', label: `Kategori: ${LOG_CATEGORY[category].label}`, remove: () => setCategory('') } : null,
    level !== 'ALL' ? { key: 'l', label: `Seviye: ${LOG_LEVEL[level].label}`, remove: () => setLevel('ALL') } : null,
    action ? { key: 'a', label: `İşlem: ${LOG_ACTION[action] ?? action}`, remove: () => setAction('') } : null,
    actorId !== '' ? { key: 'p', label: `Kişi: ${actorName(actorId)}`, remove: () => setActorId('') } : null,
    sinceHours ? { key: 's', label: sinceLabel(sinceHours), remove: () => setSinceHours(null) } : null,
    from || to ? {
      key: 'd',
      label: from && from === to ? `Tarih: ${dayLabel(from)}` : from && to ? `Tarih: ${dayLabel(from)} – ${dayLabel(to)}` : from ? `${dayLabel(from)} ve sonrası` : `${dayLabel(to)} ve öncesi`,
      remove: () => { setFrom(''); setTo(''); },
    } : null,
  ].filter((c): c is Chip => c !== null);

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Sistem Logları"
        description="Uygulamada yapılan her işlem; kimin yaptığı, ne zaman, hangi adresten ve neyi değiştirdiğiyle birlikte kayıt altında. Excel indir, listede gördüğünüz kayıtları indirir. Kişisel yapılacaklar kişiye özel olduğu için kayda geçmez."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => exportLogs('xlsx')} disabled={exporting} className="btn-secondary"
              title={active ? 'Şu an listelenen (süzülmüş) kayıtları indirir' : 'Tüm kayıtları indirir (en fazla 5000)'}>
              <MicrosoftExcelLogo size={18} weight="bold" /> {exporting ? 'Hazırlanıyor…' : 'Excel indir'}
            </button>
            <button type="button" onClick={() => exportLogs('csv')} disabled={exporting} className="btn-secondary px-3" title="Başka araçlar için virgülle ayrılmış CSV" aria-label="CSV olarak indir">
              <FileCsv size={18} weight="bold" /> <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Son 14 gün" icon={Pulse} value={stats ? stats.total : '–'} hint={stats ? `Bugün ${stats.today} kayıt · göster` : 'Yükleniyor'}
          onClick={stats ? () => togglePreset(presets.all) : undefined} active={!!stats && isPreset(presets.all)}
        />
        <StatCard
          label="Başarısız giriş" icon={WarningOctagon} value={stats ? stats.failedLogins24h : '–'}
          hint={stats && stats.failedLogins24h > 0 ? <span className="text-warn-ink font-bold">Son 24 saat · göster</span> : 'Son 24 saat · göster'}
          onClick={() => togglePreset(presets.failed)} active={isPreset(presets.failed)}
        />
        <StatCard
          label="Kritik işlem" icon={ShieldWarning} value={stats ? stats.critical7d : '–'}
          hint={stats && stats.critical7d > 0 ? <span className="text-danger font-bold">Son 7 gün · göster</span> : 'Son 7 gün · yetki, hesap, şifre'}
          onClick={() => togglePreset(presets.critical)} active={isPreset(presets.critical)}
        />
        <StatCard
          label="En aktif" icon={UserCircle} value={top ? <span className="text-xl">{top.name}</span> : '–'}
          hint={top ? `${top.count} işlem · göster` : 'Son 14 gün'}
          onClick={presets.top ? () => togglePreset(presets.top!) : undefined} active={!!presets.top && isPreset(presets.top)}
        />
      </div>

      <section className="card p-6 mb-6 grid lg:grid-cols-3 gap-6" aria-label="Son 14 günün özeti">
        <div className="lg:col-span-2 min-w-0">
          <h2 className="text-lg font-bold tracking-tight">Günlük işlem sayısı</h2>
          <p className="text-sm text-theme-muted font-medium mb-4">Son 14 gün · bir güne tıklayınca o günün kayıtları listelenir</p>
          {!stats ? <Skeleton className="h-36" /> : (
            <DayBars days={stats.perDay} selected={from && from === to && !category && level === 'ALL' && !action && !actorId && !q && !sinceHours ? from : null}
              onSelect={d => togglePreset({ from: d, to: d })} />
          )}
        </div>
        <div className="lg:border-l lg:border-theme-light/40 lg:pl-6">
          <h2 className="text-lg font-bold tracking-tight">Kategoriler</h2>
          <p className="text-sm text-theme-muted font-medium mb-3">Son 14 gün · tıklayınca listelenir</p>
          {!stats ? <Skeleton className="h-36" /> : (
            <ul className="space-y-1">
              {LOG_CATEGORIES.filter(c => stats.byCategory[c] > 0).sort((a, b) => stats.byCategory[b] - stats.byCategory[a]).map(c => {
                const meta = LOG_CATEGORY[c];
                const share = stats.total ? stats.byCategory[c] / stats.total : 0;
                const preset = { category: c, from: windowStart };
                const on = isPreset(preset);
                return (
                  <li key={c}>
                    <button type="button" onClick={() => togglePreset(preset)} aria-pressed={on}
                      title={on ? 'Filtreyi kaldır' : 'Son 14 günün bu kategorideki kayıtlarını listele'}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-sm transition-colors ${on ? 'bg-theme-lightest font-bold text-theme-deep ring-1 ring-theme-medium' : category === c ? 'bg-theme-lightest/60 font-semibold' : 'hover:bg-theme-cream font-semibold'}`}>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.className}`}><meta.icon size={14} weight="bold" aria-hidden="true" /></span>
                      <span className="flex-1">{meta.label}</span>
                      <span className="w-16 h-1.5 rounded-full bg-theme-lightest overflow-hidden" aria-hidden="true"><span className="block h-full rounded-full bg-theme-medium" style={{ width: `${share * 100}%` }} /></span>
                      <span className="tabular text-theme-muted w-8 text-right">{stats.byCategory[c]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section ref={resultsRef} className={`card p-4 sm:p-5 mb-4 scroll-mt-4 transition-shadow duration-500 ${flash ? 'ring-2 ring-theme-deep shadow-diffusion' : ''}`} aria-label="Filtreler">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara: açıklama, hedef, ayrıntı veya IP…" aria-label="Loglarda ara" className="input pl-11" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Combobox label="Kategori" value={category} onChange={v => setCategory(v as LogCategory | '')} options={categoryOptions}
              searchPlaceholder="Kategori ara…" emptyText="Eşleşen kategori yok" width={240} className="w-[215px]" />
            <Combobox label="Kişi" value={actorId} onChange={setActorId} options={personOptions}
              searchPlaceholder="İsim yazın…" emptyText="Bu isimde kimse yok" width={300} className="w-[220px]" />
            <label className="flex items-center gap-1.5 text-xs font-bold text-theme-muted">
              <span className="sr-only sm:not-sr-only">Başlangıç</span>
              <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="input w-auto py-2.5" aria-label="Başlangıç tarihi" />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-theme-muted">
              <span className="sr-only sm:not-sr-only">Bitiş</span>
              <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="input w-auto py-2.5" aria-label="Bitiş tarihi" />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Segmented<LevelFilter>
            label="Seviye"
            layoutId="log-level"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'ALL', label: 'Tüm seviyeler' },
              { value: 'BILGI', label: 'Bilgi' },
              { value: 'UYARI', label: 'Uyarı' },
              { value: 'KRITIK', label: 'Kritik' },
            ]}
          />
          <p className="ml-auto text-sm font-semibold text-theme-muted flex items-center gap-2" aria-live="polite">
            <Funnel size={15} weight="bold" aria-hidden="true" />
            {result.isLoading ? 'Yükleniyor…' : result.isPlaceholderData ? 'Güncelleniyor…' : `${total} kayıt`}
            {active && <button type="button" onClick={clear} className="font-bold text-theme-deep hover:underline underline-offset-4">Filtreleri temizle</button>}
          </p>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-theme-light/40">
            <span className="text-xs font-bold text-theme-muted">Gösterilen:</span>
            {chips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-theme-lightest text-theme-deep text-xs font-bold">
                {c.label}
                <button type="button" onClick={c.remove} className="rounded-full p-0.5 hover:bg-theme-light" aria-label={`${c.label} filtresini kaldır`}><X size={12} weight="bold" /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className={`min-h-[70vh] transition-opacity ${result.isFetching && !result.isFetchingNextPage && !result.isLoading ? 'opacity-60' : ''}`} aria-busy={result.isFetching}>
      {result.isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-3xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ListDashes} title="Kayıt bulunamadı" description={active ? 'Bu filtrelere uyan kayıt yok. Yukarıdan bir filtreyi kaldırmayı deneyin.' : 'Henüz kayıt yok.'}
          action={active ? <button type="button" onClick={clear} className="btn-secondary">Filtreleri temizle</button> : undefined} />
      ) : (
        <div className="space-y-6 pb-10">
          {groups.map(g => (
            <section key={g.day} aria-label={g.label}>
              <h3 className="eyebrow mb-2 px-1 flex items-center gap-2">{g.label} <span className="tabular font-semibold normal-case tracking-normal">· {g.list.length} kayıt</span></h3>
              <ul className="card divide-y divide-theme-light/40 overflow-hidden">
                {g.list.map(l => (
                  <LogRow key={l.id} log={l} open={expanded.has(l.id)} onToggle={() => toggle(l.id)}
                    onFilterActor={() => setActorId(l.actorId === null ? '0' : String(l.actorId))}
                    onFilterCategory={() => setCategory(l.category)}
                    onSearchTarget={() => l.targetName && setSearch(l.targetName)} />
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-theme-muted">{items.length} / {total} kayıt gösteriliyor</p>
            {result.hasNextPage && (
              <button type="button" onClick={() => result.fetchNextPage()} disabled={result.isFetchingNextPage} className="btn-secondary">
                {result.isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla yükle'}
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

/** Son 14 günün günlük kayıt sayısı (tek seri; bugün koyu). */
function DayBars({ days, selected, onSelect }: { days: { date: string; count: number; warnings: number }[]; selected: string | null; onSelect: (day: string) => void }) {
  const max = Math.max(1, ...days.map(d => d.count));
  const today = toIsoDay(new Date());
  return (
    <div className="flex items-end gap-1.5 h-36" role="group" aria-label="Günlük işlem sayısı">
      {days.map(d => {
        const date = new Date(`${d.date}T00:00:00`);
        const isToday = d.date === today;
        const on = selected === d.date;
        return (
          <button type="button" key={d.date} onClick={() => onSelect(d.date)} aria-pressed={on}
            aria-label={`${dayMonth.format(date)}: ${d.count} kayıt${d.warnings ? `, ${d.warnings} uyarı veya kritik` : ''}. ${on ? 'Filtreyi kaldır' : 'Bu günü listele'}`}
            className={`flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-medium ${on ? 'bg-theme-lightest/80' : ''}`}
            title={`${dayMonth.format(date)}: ${d.count} kayıt${d.warnings ? `, ${d.warnings} uyarı/kritik` : ''} · tıklayınca listelenir`}>
            <span className="text-[10px] font-bold tabular text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
            <motion.span
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`w-full max-w-[34px] rounded-t-lg rounded-b-sm origin-bottom ${isToday || on ? 'bg-accent' : 'bg-theme-medium group-hover:bg-theme-dark'} transition-colors`}
              style={{ height: `${Math.max((d.count / max) * 100, d.count ? 4 : 1.5)}%` }}
            />
            <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-theme-deep' : 'text-theme-muted'}`}>{dayShort.format(date)}</span>
            <span className={`text-[10px] font-semibold tabular -mt-1 ${isToday ? 'text-theme-deep' : 'text-theme-muted/70'}`}>{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

function LogRow({ log, open, onToggle, onFilterActor, onFilterCategory, onSearchTarget }: {
  log: ActionLog; open: boolean; onToggle: () => void; onFilterActor: () => void; onFilterCategory: () => void; onSearchTarget: () => void;
}) {
  const menu = useContextMenu();
  const toast = useToast();
  const cat = LOG_CATEGORY[log.category];
  const lvl = LOG_LEVEL[log.level];
  const when = parseServerDate(log.createdAt);
  const actor = logActorName(log);
  const details = (log.details ?? '').split('\n').filter(Boolean);
  const copy = () => {
    const text = [
      `#${log.id} · ${when.toLocaleString('tr-TR')}`,
      `${lvl.label} · ${cat.label} · ${LOG_ACTION[log.action] ?? log.action}`,
      `${actor}: ${log.message}`,
      ...details,
      log.ipAddress ? `IP: ${log.ipAddress}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Kayıt kopyalandı'), () => toast.error('Panoya kopyalanamadı.'));
  };

  return (
    <li onContextMenu={e => menu(e, {
      label: `Kayıt #${log.id}`,
      items: [
        { label: open ? 'Ayrıntıyı kapat' : 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: onToggle },
        { label: `${actor} kayıtları`, icon: UserIcon, onSelect: onFilterActor },
        { label: `Yalnızca ${cat.label}`, icon: Funnel, onSelect: onFilterCategory },
        !!log.targetName && { label: 'Bu hedefle ilgili kayıtlar', icon: MagnifyingGlass, onSelect: onSearchTarget },
        'divider',
        { label: 'Kaydı kopyala', icon: Copy, onSelect: copy },
      ],
    })}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-theme-cream/60 transition-colors">
        <time className="text-xs font-bold tabular text-theme-muted pt-1 w-[58px] shrink-0" dateTime={when.toISOString()}>{when.toLocaleTimeString('tr-TR')}</time>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cat.className}`} title={cat.label}><cat.icon size={16} weight="bold" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-theme-text leading-snug break-words">{log.message}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs font-semibold text-theme-muted">
            <span className="inline-flex items-center gap-1.5">
              {log.actorName ? <Avatar user={{ fullName: log.actorName, avatarColor: '#C5D89D', status: null }} size="xs" /> : null}
              <span className={log.actorName ? 'text-theme-deep' : ''}>{actor}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{cat.label} / {LOG_ACTION[log.action] ?? log.action}</span>
            {details.length > 0 && !open && <><span aria-hidden="true">·</span><span>{details.length} ayrıntı</span></>}
          </span>
        </span>
        {log.level !== 'BILGI' && (
          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 ${lvl.className}`}>
            <lvl.icon size={13} weight="bold" aria-hidden="true" /> {lvl.label}
          </span>
        )}
        <CaretDown size={15} weight="bold" className={`text-theme-muted shrink-0 mt-1.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 sm:px-5 pb-4 sm:pl-[118px] grid md:grid-cols-[1fr_260px] gap-4">
              <div>
                <p className="eyebrow mb-2">Ayrıntılar</p>
                {details.length === 0 ? <p className="text-sm text-theme-muted font-medium">Bu işlem için ek ayrıntı yok.</p> : (
                  <ul className="space-y-1.5">
                    {details.map((d, i) => <DetailLine key={i} text={d} />)}
                  </ul>
                )}
              </div>
              <dl className="rounded-2xl bg-theme-cream/70 border border-theme-light/40 p-3.5 text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt className="font-bold text-theme-muted">Kayıt no</dt><dd className="font-semibold tabular">#{log.id}</dd>
                <dt className="font-bold text-theme-muted">Zaman</dt><dd className="font-semibold tabular">{when.toLocaleString('tr-TR')}</dd>
                <dt className="font-bold text-theme-muted">Seviye</dt><dd className="font-semibold">{lvl.label}</dd>
                <dt className="font-bold text-theme-muted">İşlem kodu</dt><dd className="font-mono text-[11px]">{log.category}.{log.action}</dd>
                {log.targetType && <><dt className="font-bold text-theme-muted">Hedef</dt><dd className="font-semibold break-words">{log.targetName ?? '—'} <span className="text-theme-muted font-mono text-[11px]">({log.targetType}{log.targetId !== null ? ` #${log.targetId}` : ''})</span></dd></>}
                <dt className="font-bold text-theme-muted">IP adresi</dt><dd className="font-mono text-[11px]">{log.ipAddress ?? 'Sistem işlemi'}</dd>
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** "Alan: eski → yeni" satırını eski/yeni değer vurgulu gösterir; diğer satırlar düz metin. */
function DetailLine({ text }: { text: string }) {
  const m = text.match(/^([^:]{1,40}):\s(.*?)\s→\s(.*)$/);
  if (!m) return <li className="text-sm text-theme-text leading-relaxed">{text}</li>;
  return (
    <li className="text-sm leading-relaxed flex flex-wrap items-center gap-1.5">
      <span className="font-bold text-theme-text">{m[1]}:</span>
      <span className="px-1.5 py-0.5 rounded-md bg-danger-soft text-danger line-through decoration-danger/40">{m[2]}</span>
      <span className="text-theme-muted" aria-label="yerine">→</span>
      <span className="px-1.5 py-0.5 rounded-md bg-theme-lightest text-theme-deep font-semibold">{m[3]}</span>
    </li>
  );
}

