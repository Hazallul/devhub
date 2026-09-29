import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CaretDown, Cpu, Memory, Cube, Pulse, Pause, Play, WarningCircle, ArrowsClockwise, HardDrives, ArrowDown, Info,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { PageHeader, Segmented, Skeleton, Pill } from '../components/ui/primitives';
import { LineChart, Sparkline, StateTimeline } from '../components/charts/TimeSeries';
import { STATUS_COLOR, SERIES_COLOR } from '../components/charts/palette';
import { useMe, useMonitoring } from '../hooks/api';
import { HEALTH_STATUS } from '../lib/meta';
import type { HealthStatus, MonitorOverview, MonitorService } from '../types';

type Range = '15' | '30' | '60';

const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const pct = (v: number) => `%${nf1.format(v)}`;
const mb = (v: number) => (v >= 1024 ? `${nf1.format(v / 1024)} GB` : `${Math.round(v)} MB`);
const ms = (v: number) => `${Math.round(v)} ms`;
function rate(b: number) {
  if (b >= 1024 * 1024) return `${nf1.format(b / 1024 / 1024)} MB/sn`;
  if (b >= 1024) return `${nf1.format(b / 1024)} KB/sn`;
  return `${Math.round(b)} B/sn`;
}
function uptime(startedAt: number | null, now: number) {
  if (!startedAt) return '—';
  const mins = Math.max(0, Math.floor((now - startedAt) / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d) return `${d} gün ${h} sa`;
  if (h) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

/** Saniyede bir güncellenen "şimdi" (son örneğin yaşı ve çalışma süreleri için). */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Monitoring() {
  const me = useMe();
  const [range, setRange] = useState<Range>('15');
  const [live, setLive] = useState(true);
  const { data, isLoading, isError, dataUpdatedAt } = useMonitoring(Number(range), live && me.role === 'ADMIN');
  const now = useNow();

  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;

  const age = data?.sampledAt ? Math.max(0, Math.round((now - data.sampledAt) / 1000)) : null;

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Sistem İzleme"
        description="Docker üzerinde çalışan DevHub servislerinin sağlığı ve kaynak kullanımı. Veriler 10 saniyede bir toplanır."
        actions={<>
          <button
            type="button"
            onClick={() => setLive(l => !l)}
            aria-pressed={live}
            className={`btn min-h-[44px] px-4 border ${live ? 'bg-white border-theme-light/70 text-theme-deep' : 'bg-theme-lightest border-theme-light text-theme-muted'}`}
            title={live ? 'Otomatik yenilemeyi duraklat' : 'Otomatik yenilemeyi başlat'}
          >
            {live ? (
              <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
                <span className="absolute inset-0 rounded-full animate-ping motion-reduce:animate-none" style={{ backgroundColor: STATUS_COLOR.UP, opacity: 0.5 }} />
                <span className="relative w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.UP }} />
              </span>
            ) : <Pause size={16} weight="bold" aria-hidden="true" />}
            {live ? 'Canlı' : 'Duraklatıldı'}
            {live ? <Pause size={14} weight="bold" className="opacity-60" aria-hidden="true" /> : <Play size={14} weight="bold" aria-hidden="true" />}
          </button>
          <Segmented<Range>
            label="Zaman aralığı"
            layoutId="mon-range"
            value={range}
            onChange={setRange}
            options={[{ value: '15', label: '15 dk' }, { value: '30', label: '30 dk' }, { value: '60', label: '1 sa' }]}
          />
        </>}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}
        </div>
      ) : isError || !data ? (
        <div role="alert" className="card p-6 flex items-center gap-3 text-[#9A3B1B]">
          <WarningCircle size={22} weight="bold" /> İzleme verisi alınamadı. Backend çalışıyor mu?
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-theme-muted mb-4 flex items-center gap-1.5" aria-live="polite">
            <ArrowsClockwise size={13} weight="bold" aria-hidden="true" />
            {age === null ? 'İlk örnek bekleniyor…' : `Son örnek ${age < 2 ? 'az önce' : `${age} sn önce`}`}
            {!live && dataUpdatedAt ? ' · otomatik yenileme duraklatıldı' : ''}
          </p>

          {!data.host.dockerAvailable && (
            <div role="status" className="mb-6 flex items-start gap-3 p-4 rounded-3xl bg-[#F7ECD0] border border-[#E8D39C] text-[#6E5210]">
              <Info size={22} weight="duotone" className="shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-bold">Docker bilgisine ulaşılamıyor</p>
                <p className="font-medium mt-0.5">Konteyner CPU/bellek verileri gösterilemiyor; sağlık kontrolleri çalışmaya devam ediyor. Ayrıntı: {data.host.dockerError}</p>
              </div>
            </div>
          )}

          <Summary data={data} />

          <div className="flex items-center justify-between mt-10 mb-4">
            <h2 className="text-lg font-bold text-theme-text">Servisler <span className="text-theme-muted font-semibold tabular">({data.services.length})</span></h2>
            <Legend />
          </div>
          <ServiceList data={data} minutes={Number(range)} now={now} />
        </>
      )}
    </>
  );
}

function Legend() {
  return (
    <ul className="hidden sm:flex items-center gap-4 text-xs font-semibold text-theme-muted" aria-label="Durum renkleri">
      {(['UP', 'WARN', 'DOWN'] as HealthStatus[]).map(s => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden="true" /> {HEALTH_STATUS[s].label}
        </li>
      ))}
    </ul>
  );
}

function HealthPill({ status, size = 'md' }: { status: HealthStatus; size?: 'sm' | 'md' }) {
  const meta = HEALTH_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full border whitespace-nowrap ${meta.className} ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-3 py-1.5'}`}>
      <meta.icon size={size === 'sm' ? 12 : 14} weight="bold" aria-hidden="true" /> {meta.label}
    </span>
  );
}

// ---------------- Özet ----------------

function Summary({ data }: { data: MonitorOverview }) {
  const s = data.services;
  const down = s.filter(x => x.status === 'DOWN').length;
  const warn = s.filter(x => x.status === 'WARN').length;
  const overall: HealthStatus = down ? 'DOWN' : warn ? 'WARN' : s.length ? 'UP' : 'UNKNOWN';
  const headline = down ? `${down} servis çalışmıyor` : warn ? `${warn} serviste uyarı var` : 'Tüm servisler sağlıklı';
  const cores = s.reduce((a, x) => a + (x.cpuPercent ?? 0), 0) / 100;
  const memUsed = s.reduce((a, x) => a + (x.memUsedMb ?? 0), 0);
  const memTotal = data.host.memTotalMb;
  const OverallIcon = HEALTH_STATUS[overall].icon;

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Tile icon={Pulse} label="Genel durum">
        <p className="flex items-center gap-2 text-lg font-bold text-theme-text leading-tight">
          <OverallIcon size={22} weight="fill" style={{ color: STATUS_COLOR[overall] }} aria-hidden="true" /> {headline}
        </p>
        <p className="text-xs text-theme-muted font-semibold mt-1.5 tabular">{s.length} servis izleniyor · {s.length - down - warn} sağlıklı</p>
      </Tile>
      <Tile icon={Cpu} label="CPU (servislerin toplamı)">
        <p className="text-2xl font-bold text-theme-text tabular">{nf2.format(cores)} <span className="text-sm font-semibold text-theme-muted">çekirdek</span></p>
        <p className="text-xs text-theme-muted font-semibold mt-1 tabular">{data.host.cpus ? `${data.host.cpus} çekirdekten · %100 = 1 çekirdek` : 'Docker bilgisi yok'}</p>
      </Tile>
      <Tile icon={Memory} label="Bellek (servislerin toplamı)">
        <p className="text-2xl font-bold text-theme-text tabular">{mb(memUsed)}</p>
        {memTotal ? (
          <>
            <div className="h-2 rounded-full bg-theme-lightest overflow-hidden mt-2" role="meter" aria-valuenow={Math.round((memUsed / memTotal) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Docker belleği kullanımı">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (memUsed / memTotal) * 100)}%`, backgroundColor: SERIES_COLOR }} />
            </div>
            <p className="text-xs text-theme-muted font-semibold mt-1.5 tabular">{mb(memTotal)} Docker belleğinin {pct((memUsed / memTotal) * 100)}'i</p>
          </>
        ) : <p className="text-xs text-theme-muted font-semibold mt-1">Docker bilgisi yok</p>}
      </Tile>
      <Tile icon={Cube} label="Docker motoru">
        <p className="text-2xl font-bold text-theme-text tabular">{data.host.containersRunning ?? '—'}<span className="text-sm font-semibold text-theme-muted"> / {data.host.containersTotal ?? '—'} konteyner çalışıyor</span></p>
        <p className="text-xs text-theme-muted font-semibold mt-1 truncate">{data.host.serverVersion ? `Docker ${data.host.serverVersion} · ${data.host.operatingSystem}` : 'Bağlantı yok'}</p>
      </Tile>
    </div>
  );
}

function Tile({ icon: IconCmp, label, children }: { icon: Icon; label: string; children: React.ReactNode }) {
  return (
    <section className="card p-5" aria-label={label}>
      <p className="eyebrow flex items-center gap-1.5 mb-3"><IconCmp size={14} weight="bold" aria-hidden="true" /> {label}</p>
      {children}
    </section>
  );
}

// ---------------- Servisler ----------------

function ServiceList({ data, minutes, now }: { data: MonitorOverview; minutes: number; now: number }) {
  // Varsayılan: ilk servis (veya ilk sorunlu servis) açık gelir.
  const [open, setOpen] = useState<Set<string> | null>(null);
  const defaultOpen = useMemo(() => {
    const troubled = data.services.find(s => s.status === 'DOWN' || s.status === 'WARN');
    return new Set([(troubled ?? data.services[0])?.id].filter(Boolean) as string[]);
  }, [data.services]);
  const expanded = open ?? defaultOpen;
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
  };

  if (data.services.length === 0) {
    return <p className="card p-8 text-center text-sm font-medium text-theme-muted">İzlenecek servis bulunamadı. monitoring.yml dosyasına servis ekleyin.</p>;
  }

  return (
    <div className="space-y-3 pb-10">
      {data.services.map(s => (
        <ServiceRow key={s.id} service={s} open={expanded.has(s.id)} onToggle={() => toggle(s.id)} minutes={minutes} now={now} warnPercent={data.warnPercent} sampleSeconds={data.sampleSeconds} />
      ))}
    </div>
  );
}

function ServiceRow({ service: s, open, onToggle, minutes, now, warnPercent, sampleSeconds }: {
  service: MonitorService; open: boolean; onToggle: () => void; minutes: number; now: number; warnPercent: number; sampleSeconds: number;
}) {
  const running = s.state === 'running';
  const cpuHistory = s.history.map(h => h.cpu);
  const memHistory = s.history.map(h => h.memMb);

  return (
    <motion.section layout="position" className="card overflow-hidden" aria-label={s.name}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left p-4 sm:px-5 grid gap-4 items-center grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,1.6fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_24px] hover:bg-theme-cream/40 transition-colors">
        <div className="min-w-0 flex items-center gap-3">
          <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[s.status] }} aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-theme-text">{s.name}</span>
              {s.kind && <Pill className="bg-theme-cream text-theme-muted">{s.kind}</Pill>}
              {!s.configured && <Pill className="bg-theme-lightest text-theme-deep">otomatik bulundu</Pill>}
            </div>
            <p className="text-xs text-theme-muted font-medium truncate mt-0.5 font-mono">{s.container ?? s.check?.target ?? '—'}{s.image && s.image !== s.container ? ` · ${s.image}` : ''}</p>
          </div>
        </div>

        <div className="lg:justify-self-start"><HealthPill status={s.status} size="sm" /></div>

        <Metric label="CPU" value={s.cpuPercent !== null ? pct(s.cpuPercent) : running ? '…' : '—'} spark={<Sparkline values={cpuHistory} />} className="hidden lg:flex" />
        <Metric
          label="Bellek"
          value={s.memUsedMb !== null ? mb(s.memUsedMb) : '—'}
          sub={s.memPercent !== null ? (s.memLimited ? `sınırın ${pct(s.memPercent)}'i` : `Docker belleğinin ${pct(s.memPercent)}'i`) : undefined}
          spark={<Sparkline values={memHistory} />}
          className="hidden lg:flex"
        />
        <div className="hidden lg:block min-w-0">
          <p className="eyebrow mb-0.5">Sağlık kontrolü</p>
          <p className="text-sm font-semibold text-theme-text truncate tabular">{s.check ? `${s.check.message} · ${ms(s.check.latencyMs)}` : 'Tanımlı değil'}</p>
          <p className="text-xs text-theme-muted font-medium tabular">{running ? `${uptime(s.startedAt, now)} çalışıyor` : s.state ?? 'Docker dışı'}</p>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="hidden lg:flex text-theme-muted justify-self-end" aria-hidden="true"><CaretDown size={18} weight="bold" /></motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { type: 'spring', stiffness: 260, damping: 32 }, opacity: { duration: 0.2, delay: 0.05 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.2 }, opacity: { duration: 0.1 } } }}
            className="overflow-hidden"
          >
            <ServiceDetail s={s} minutes={minutes} now={now} warnPercent={warnPercent} sampleSeconds={sampleSeconds} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Metric({ label, value, sub, spark, className = '' }: { label: string; value: string; sub?: string; spark: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 flex-col ${className}`}>
      <p className="eyebrow mb-0.5">{label}</p>
      <div className="flex items-center gap-3">
        <p className="text-sm font-bold text-theme-text tabular w-16 shrink-0">{value}</p>
        {spark}
      </div>
      {sub && <p className="text-[11px] text-theme-muted font-medium tabular truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function ServiceDetail({ s, minutes, now, warnPercent, sampleSeconds }: { s: MonitorService; minutes: number; now: number; warnPercent: number; sampleSeconds: number }) {
  const to = s.history.length ? Math.max(s.history[s.history.length - 1].t, now - 2000) : now;
  const from = to - minutes * 60_000;
  const gap = sampleSeconds * 2500;
  const cpu = s.history.map(h => ({ t: h.t, v: h.cpu }));
  const mem = s.history.map(h => ({ t: h.t, v: h.memMb }));
  const lat = s.history.map(h => ({ t: h.t, v: h.latency }));
  const hasResources = s.container !== null && s.history.some(h => h.cpu !== null || h.memMb !== null);

  return (
    <div className="border-t border-theme-light/40 p-4 sm:p-6 space-y-6 bg-theme-cream/30">
      {s.description && <p className="text-sm text-theme-muted font-medium">{s.description}</p>}

      {s.reasons.length > 0 && s.status !== 'UP' && (
        <ul className={`rounded-2xl border p-4 space-y-1 text-sm font-semibold ${HEALTH_STATUS[s.status].className}`}>
          {s.reasons.map(r => <li key={r} className="flex items-start gap-2"><WarningCircle size={16} weight="bold" className="shrink-0 mt-0.5" aria-hidden="true" /> {r}</li>)}
        </ul>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">Durum geçmişi</p>
          <p className="text-[11px] font-semibold text-theme-muted">son {minutes === 60 ? '1 saat' : `${minutes} dakika`}</p>
        </div>
        <StateTimeline samples={s.history} from={from} to={to} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hasResources && (
          <ChartCard title="CPU kullanımı" current={s.cpuPercent !== null ? pct(s.cpuPercent) : '—'} values={cpu} format={pct}
            note={`%100 = 1 çekirdek · uyarı eşiği %${warnPercent}`}>
            <LineChart points={cpu} from={from} to={to} format={pct} label="CPU kullanımı" minMax={5} gapMs={gap} />
          </ChartCard>
        )}
        {hasResources && (
          <ChartCard title="Bellek" current={s.memUsedMb !== null ? mb(s.memUsedMb) : '—'} values={mem} format={mb}
            note={s.memLimitMb ? (s.memLimited ? `sınır ${mb(s.memLimitMb)}` : `sınır yok · Docker belleği ${mb(s.memLimitMb)}`) : undefined}>
            <LineChart points={mem} from={from} to={to} format={mb} label="Bellek kullanımı" minMax={64} gapMs={gap} />
          </ChartCard>
        )}
        {s.check && (
          <ChartCard title={`Yanıt süresi (${s.check.type})`} current={ms(s.check.latencyMs)} values={lat} format={ms} note={s.check.target ?? undefined}>
            <LineChart points={lat} from={from} to={to} format={ms} label="Sağlık kontrolü yanıt süresi" minMax={10} gapMs={gap} />
          </ChartCard>
        )}
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {s.container && <>
          <Fact label="Konteyner durumu" value={s.statusText ?? '—'} />
          <Fact label="Çalışma süresi" value={s.state === 'running' ? uptime(s.startedAt, now) : '—'} hint={s.restartCount ? `${s.restartCount} kez yeniden başladı` : 'yeniden başlama yok'} />
          <Fact label="Docker sağlık kontrolü" value={s.dockerHealth ? ({ healthy: 'Sağlıklı', unhealthy: 'Başarısız', starting: 'Başlıyor' } as Record<string, string>)[s.dockerHealth] ?? s.dockerHealth : 'Tanımlı değil'} />
          <Fact label="Süreç (PID)" value={s.pids !== null ? String(s.pids) : '—'} />
          <Fact label="Ağ" icon={<ArrowDown size={12} weight="bold" aria-hidden="true" />} value={s.netRxRate !== null ? `gelen ${rate(s.netRxRate)}` : '—'} hint={s.netTxRate !== null ? `giden ${rate(s.netTxRate)}` : undefined} />
          <Fact label="Disk" icon={<HardDrives size={12} weight="bold" aria-hidden="true" />} value={s.diskReadRate !== null ? `okuma ${rate(s.diskReadRate)}` : '—'} hint={s.diskWriteRate !== null ? `yazma ${rate(s.diskWriteRate)}` : undefined} />
        </>}
        {s.details.map(d => <Fact key={d.label} label={d.label} value={d.value} hint={d.hint ?? undefined} />)}
      </dl>
    </div>
  );
}

function ChartCard({ title, current, values, format, note, children }: {
  title: string; current: string; values: { v: number | null }[]; format: (v: number) => string; note?: string; children: React.ReactNode;
}) {
  const nums = values.map(v => v.v).filter((v): v is number => v !== null);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const max = nums.length ? Math.max(...nums) : null;
  return (
    <section className="bg-white rounded-3xl border border-theme-light/50 p-4" aria-label={title}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-theme-text">{title}</h3>
          {note && <p className="text-[11px] text-theme-muted font-medium truncate">{note}</p>}
        </div>
        <p className="text-lg font-bold text-theme-text tabular shrink-0">{current}</p>
      </div>
      {children}
      <p className="flex gap-4 mt-2 text-[11px] font-semibold text-theme-muted tabular">
        <span>Ort. {avg !== null ? format(avg) : '—'}</span>
        <span>Maks. {max !== null ? format(max) : '—'}</span>
        <span>{nums.length} örnek</span>
      </p>
    </section>
  );
}

function Fact({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-theme-light/40 p-3 min-w-0">
      <dt className="eyebrow flex items-center gap-1">{icon}{label}</dt>
      <dd className="text-sm font-bold text-theme-text mt-1 truncate tabular" title={value}>{value}</dd>
      {hint && <dd className="text-[11px] text-theme-muted font-medium truncate" title={hint}>{hint}</dd>}
    </div>
  );
}
