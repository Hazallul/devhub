import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Users as UsersIcon, CheckSquare, CheckCircle, CalendarBlank, DownloadSimple, Warning } from '@phosphor-icons/react';
import { PageHeader, StatCard, Skeleton, Avatar, PriorityBadge } from '../components/ui/primitives';
import { HBarStack, ColumnChart, Legend, Meter, DataTable } from '../components/charts/Charts';
import { OLIVE_RAMP } from '../components/charts/palette';
import type { Series, StackRow, ColumnDatum } from '../components/charts/Charts';
import { useMe, useUsers, useAllTasks, useProjects, useLeaves, useLeaveBalances, useHolidayMap } from '../hooks/api';
import { addDays, daysBetween, formatDate, parseServerDate, toDate, toIsoDay } from '../lib/format';
import { LEAVE_TYPE, LEAVE_TYPES } from '../lib/meta';
import { downloadCsv } from '../lib/csv';
import type { LeaveType, TaskPriority, TaskStatus } from '../types';

// Sıralı veriler tek tonlu zeytin rampasıyla: düşük/başlanmamış açık, yüksek/bitmiş koyu.
const PRIORITY_SERIES: Series[] = [
  { key: 'YUKSEK', label: 'Yüksek', color: OLIVE_RAMP[2] },
  { key: 'ORTA', label: 'Orta', color: OLIVE_RAMP[1] },
  { key: 'DUSUK', label: 'Düşük', color: OLIVE_RAMP[0] },
];
const STATUS_SERIES: Series[] = [
  { key: 'TAMAMLANDI', label: 'Tamamlandı', color: OLIVE_RAMP[2] },
  { key: 'DEVAM', label: 'Devam ediyor', color: OLIVE_RAMP[1] },
  { key: 'YAPILACAK', label: 'Yapılacak', color: OLIVE_RAMP[0] },
];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const weekFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

export default function Reports() {
  const me = useMe();
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <ReportsPage />;
}

function ReportsPage() {
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { data: tasks } = useAllTasks();
  const { data: projects } = useProjects();
  const { data: leaves } = useLeaves();
  const { data: balances } = useLeaveBalances();
  const holidays = useHolidayMap();

  const year = new Date().getFullYear();
  const today = toIsoDay(new Date());
  const userById = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users]);
  const projectById = useMemo(() => new Map((projects ?? []).map(p => [p.id, p])), [projects]);
  const openTasks = useMemo(() => (tasks ?? []).filter(t => t.status !== 'TAMAMLANDI' && userById.has(t.userId)), [tasks, userById]);

  // ---------- İş yükü: kişi başı açık görev, önceliğe göre ----------
  const workload = useMemo(() => {
    const rows = (users ?? []).map(u => {
      const own = openTasks.filter(t => t.userId === u.id);
      const values: Record<string, number> = { YUKSEK: 0, ORTA: 0, DUSUK: 0 };
      own.forEach(t => { values[(t.priority ?? 'ORTA') as TaskPriority] += 1; });
      return { user: u, values, total: own.length };
    });
    return {
      busy: rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total || b.values.YUKSEK - a.values.YUKSEK || a.user.fullName.localeCompare(b.user.fullName, 'tr')),
      idle: rows.filter(r => r.total === 0 && r.user.status !== 'IZINLI'),
    };
  }, [users, openTasks]);

  // ---------- Proje ilerlemesi: göreve bağlı proje ----------
  const projectRows = useMemo(() => (projects ?? []).map(p => {
    const own = (tasks ?? []).filter(t => t.projectId === p.id);
    const values: Record<string, number> = { TAMAMLANDI: 0, DEVAM: 0, YAPILACAK: 0 };
    own.forEach(t => { values[(t.status ?? 'YAPILACAK') as TaskStatus] += 1; });
    return { project: p, values, total: own.length };
  }).filter(r => r.total > 0).sort((a, b) => b.values.TAMAMLANDI / b.total - a.values.TAMAMLANDI / a.total), [projects, tasks]);

  // ---------- Son 8 hafta tamamlanan görevler ----------
  const weekly = useMemo(() => {
    const now = new Date();
    const monday = addDays(toDate(toIsoDay(now)), -((now.getDay() + 6) % 7));
    return Array.from({ length: 8 }, (_, i) => {
      const start = addDays(monday, (i - 7) * 7);
      const end = addDays(start, 7);
      const done = (tasks ?? []).filter(t => {
        if (!t.completedAt) return false;
        const d = parseServerDate(t.completedAt);
        return d >= start && d < end;
      });
      return { start, count: done.length };
    });
  }, [tasks]);
  const completed30 = useMemo(() => (tasks ?? []).filter(t => t.completedAt && daysBetween(parseServerDate(t.completedAt), new Date()) <= 30).length, [tasks]);

  // ---------- Aylık izin kullanımı (onaylı, iş günü), bu yıl ----------
  const monthly = useMemo(() => {
    const perMonth = MONTHS.map(() => ({ total: 0, byType: { YILLIK: 0, HASTALIK: 0, MAZERET: 0 } as Record<LeaveType, number> }));
    (leaves ?? []).filter(l => l.state === 'ONAYLANDI').forEach(l => {
      const s = toDate(l.startDate);
      const n = daysBetween(s, toDate(l.endDate)) + 1;
      for (let i = 0; i < n; i++) {
        const d = addDays(s, i);
        if (d.getFullYear() !== year || d.getDay() === 0 || d.getDay() === 6 || holidays.set.has(toIsoDay(d))) continue;
        perMonth[d.getMonth()].total += 1;
        perMonth[d.getMonth()].byType[l.type] += 1;
      }
    });
    return perMonth;
  }, [leaves, holidays.set, year]);
  const leaveByType = LEAVE_TYPES.map(t => ({ type: t, days: monthly.reduce((s, m) => s + m.byType[t], 0) }));
  const leaveTotal = leaveByType.reduce((s, x) => s + x.days, 0);

  // ---------- Bakiyeler ----------
  const balanceRows = useMemo(() => (balances ?? [])
    .map(b => ({ ...b, user: userById.get(b.userId) }))
    .filter(b => b.user)
    .sort((a, b) => a.remaining - b.remaining || a.user!.fullName.localeCompare(b.user!.fullName, 'tr')), [balances, userById]);
  const usedAnnual = balanceRows.reduce((s, b) => s + b.used, 0);
  const entitlementTotal = balanceRows.reduce((s, b) => s + b.entitlement, 0);

  // ---------- Gecikmiş görevler ----------
  const overdue = useMemo(() => openTasks
    .filter(t => t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')), [openTasks, today]);

  const loading = !users || !tasks || !projects || !leaves;

  const workloadRows: StackRow[] = workload.busy.map(r => ({
    id: r.user.id,
    label: <span className="flex items-center gap-2"><Avatar user={r.user} size="xs" /><span className="truncate">{r.user.fullName}</span></span>,
    ariaLabel: r.user.fullName,
    values: r.values,
    end: `${r.total}`,
  }));
  const projectStackRows: StackRow[] = projectRows.map(r => ({
    id: r.project.id,
    label: r.project.name,
    ariaLabel: r.project.name,
    values: r.values,
    end: `%${Math.round((r.values.TAMAMLANDI / r.total) * 100)}`,
  }));
  const weeklyData: ColumnDatum[] = weekly.map(w => ({
    id: toIsoDay(w.start), label: weekFmt.format(w.start), value: w.count, ariaLabel: `${weekFmt.format(w.start)} haftası`,
  }));
  const monthlyData: ColumnDatum[] = monthly.map((m, i) => ({
    id: String(i), label: MONTHS[i], value: m.total, ariaLabel: `${MONTHS[i]} ${year}`,
    extra: m.total ? LEAVE_TYPES.filter(t => m.byType[t]).map(t => `${LEAVE_TYPE[t].label}: ${m.byType[t]}`).join(' · ') : undefined,
  }));

  return (
    <>
      <PageHeader eyebrow="Raporlar" title="Raporlar" description={`Ekip iş yükü, proje ilerlemesi ve ${year} izin kullanımı. Tüm grafiklerin verisi tablo olarak da görüntülenebilir.`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Aktif çalışan" icon={UsersIcon} value={users?.length ?? '–'} hint={`${workload.idle.length} kişinin açık görevi yok`} />
        <StatCard label="Açık görev" icon={CheckSquare} value={openTasks.length} hint={overdue.length ? <span className="text-[#9A3B1B] font-bold">{overdue.length} gecikmiş</span> : 'Gecikmiş görev yok'} />
        <StatCard label="Son 30 günde tamamlanan" icon={CheckCircle} value={completed30} hint="Görev" />
        <StatCard label={`${year} yıllık izin kullanımı`} icon={CalendarBlank} value={<>{usedAnnual}<span className="text-lg text-theme-muted font-semibold">/{entitlementTotal}</span></>} hint="İş günü (onaylı / toplam hak)" />
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-6"><Skeleton className="h-80 rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 pb-10">
          {/* İş yükü */}
          <section className="card p-6" aria-labelledby="r-workload">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 id="r-workload" className="text-lg font-bold tracking-tight">İş yükü</h2>
                <p className="text-sm text-theme-muted">Kişi başı açık görev, önceliğe göre</p>
              </div>
              <Legend series={PRIORITY_SERIES} />
            </div>
            {workloadRows.length ? <HBarStack rows={workloadRows} series={PRIORITY_SERIES} unit="görev" labelWidth={160} /> : <p className="text-sm text-theme-muted py-8 text-center">Açık görev yok.</p>}
            {workload.idle.length > 0 && (
              <p className="text-xs text-theme-muted mt-4">
                <span className="font-bold text-theme-text">Açık görevi olmayan:</span> {workload.idle.map(r => r.user.fullName).join(', ')}
              </p>
            )}
            <DataTable caption="Kişi başı açık görev" headers={['Kişi', 'Yüksek', 'Orta', 'Düşük', 'Toplam']}
              rows={workload.busy.map(r => [r.user.fullName, r.values.YUKSEK, r.values.ORTA, r.values.DUSUK, r.total])} />
          </section>

          {/* Proje ilerlemesi */}
          <section className="card p-6" aria-labelledby="r-projects">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 id="r-projects" className="text-lg font-bold tracking-tight">Proje ilerlemesi</h2>
                <p className="text-sm text-theme-muted">Projeye bağlı görevlerin durumu (tamamlanma oranı sağda)</p>
              </div>
              <Legend series={STATUS_SERIES} />
            </div>
            {projectStackRows.length ? <HBarStack rows={projectStackRows} series={STATUS_SERIES} normalize unit="görev" labelWidth={150} /> : <p className="text-sm text-theme-muted py-8 text-center">Projelere bağlı görev yok.</p>}
            <DataTable caption="Proje görev durumu" headers={['Proje', 'Tamamlandı', 'Devam', 'Yapılacak', 'Oran']}
              rows={projectRows.map(r => [r.project.name, r.values.TAMAMLANDI, r.values.DEVAM, r.values.YAPILACAK, `%${Math.round((r.values.TAMAMLANDI / r.total) * 100)}`])} />
          </section>

          {/* Haftalık tamamlanan */}
          <section className="card p-6" aria-labelledby="r-weekly">
            <h2 id="r-weekly" className="text-lg font-bold tracking-tight">Tamamlanan görevler</h2>
            <p className="text-sm text-theme-muted mb-5">Son 8 hafta, hafta başı tarihine göre</p>
            <ColumnChart data={weeklyData} unit="görev" />
            <DataTable caption="Haftalık tamamlanan görevler" headers={['Hafta', 'Tamamlanan']} rows={weekly.map(w => [weekFmt.format(w.start), w.count])} />
          </section>

          {/* Aylık izin */}
          <section className="card p-6" aria-labelledby="r-leave">
            <h2 id="r-leave" className="text-lg font-bold tracking-tight">İzin kullanımı · {year}</h2>
            <p className="text-sm text-theme-muted mb-5">Onaylı izinler, aylara göre iş günü (hafta sonu ve resmi tatiller hariç)</p>
            <ColumnChart data={monthlyData} unit="iş günü" height={150} />
            <ul className="mt-5 space-y-2" aria-label="İzin türü dağılımı">
              {leaveByType.map(x => (
                <li key={x.type} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-sm">
                  <span className="font-semibold">{LEAVE_TYPE[x.type].label}</span>
                  <Meter value={x.days} max={Math.max(leaveTotal, 1)} label={`${LEAVE_TYPE[x.type].label}: ${x.days} iş günü`} />
                  <span className="text-right font-bold tabular">{x.days}</span>
                </li>
              ))}
            </ul>
            <DataTable caption={`${year} aylık izin kullanımı`} headers={['Ay', 'Yıllık', 'Hastalık', 'Mazeret', 'Toplam']}
              rows={monthly.map((m, i) => [MONTHS[i], m.byType.YILLIK, m.byType.HASTALIK, m.byType.MAZERET, m.total])} />
          </section>

          {/* Bakiyeler */}
          <section className="card p-6 lg:col-span-2" aria-labelledby="r-balance">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 id="r-balance" className="text-lg font-bold tracking-tight">Yıllık izin bakiyeleri · {year}</h2>
                <p className="text-sm text-theme-muted">En az kalandan en çoğa; bekleyen talepler ayrıca gösterilir</p>
              </div>
              <button
                type="button"
                onClick={() => downloadCsv(`izin-bakiyeleri-${year}.csv`, ['Kişi', 'Unvan', 'Hak', 'Kullanılan', 'Bekleyen', 'Kalan'],
                  balanceRows.map(b => [b.user!.fullName, b.user!.jobTitle ?? '', b.entitlement, b.used, b.pending, b.remaining]))}
                className="btn-secondary h-10 min-h-0 px-3.5 text-sm"
              >
                <DownloadSimple size={16} weight="bold" /> Excel'e aktar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <caption className="sr-only">Yıllık izin bakiyeleri</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="eyebrow py-2 pr-4">Kişi</th>
                    <th scope="col" className="eyebrow py-2 pr-4 w-[36%]">Kullanım</th>
                    <th scope="col" className="eyebrow py-2 pr-4 text-right">Hak</th>
                    <th scope="col" className="eyebrow py-2 pr-4 text-right">Kullanılan</th>
                    <th scope="col" className="eyebrow py-2 pr-4 text-right">Bekleyen</th>
                    <th scope="col" className="eyebrow py-2 text-right">Kalan</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceRows.map(b => (
                    <tr key={b.userId} className="border-t border-theme-light/40">
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2 font-semibold"><Avatar user={b.user!} size="xs" /> {b.user!.fullName}</span>
                      </td>
                      <td className="py-2.5 pr-4"><Meter value={b.used} max={b.entitlement} label={`${b.user!.fullName}: ${b.used}/${b.entitlement} gün kullanıldı`} /></td>
                      <td className="py-2.5 pr-4 text-right tabular">{b.entitlement}</td>
                      <td className="py-2.5 pr-4 text-right tabular">{b.used}</td>
                      <td className="py-2.5 pr-4 text-right tabular text-theme-muted">{b.pending || '–'}</td>
                      <td className={`py-2.5 text-right tabular font-bold ${b.remaining <= 2 ? 'text-[#9A3B1B]' : ''}`}>{b.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gecikmiş görevler */}
          <section className="card p-6 lg:col-span-2" aria-labelledby="r-overdue">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 id="r-overdue" className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Warning size={20} weight="duotone" className="text-[#9A3B1B]" /> Gecikmiş görevler
                </h2>
                <p className="text-sm text-theme-muted">Son tarihi geçmiş, tamamlanmamış görevler</p>
              </div>
              {overdue.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadCsv(`gecikmis-gorevler-${today}.csv`, ['Görev', 'Kişi', 'Proje', 'Öncelik', 'Son tarih', 'Gecikme (gün)'],
                    overdue.map(t => [t.content, userById.get(t.userId)?.fullName, t.projectId ? projectById.get(t.projectId)?.name : '', t.priority, t.dueDate, daysBetween(toDate(t.dueDate!), new Date())]))}
                  className="btn-secondary h-10 min-h-0 px-3.5 text-sm"
                >
                  <DownloadSimple size={16} weight="bold" /> Excel'e aktar
                </button>
              )}
            </div>
            {overdue.length === 0 ? (
              <p className="text-sm text-theme-muted py-6 text-center">Gecikmiş görev yok.</p>
            ) : (
              <ul className="divide-y divide-theme-light/40">
                {overdue.map(t => {
                  const u = userById.get(t.userId);
                  const late = daysBetween(toDate(t.dueDate!), new Date());
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => navigate('/team', { state: { highlightUserId: t.userId } })}
                        className="w-full flex items-center gap-3 py-3 text-left rounded-xl hover:bg-theme-cream transition-colors px-2 -mx-2">
                        {u && <Avatar user={u} size="sm" />}
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold truncate">{t.content}</span>
                          <span className="block text-xs text-theme-muted">{u?.fullName}{t.projectId ? ` · ${projectById.get(t.projectId)?.name}` : ''} · son tarih {formatDate(t.dueDate!)}</span>
                        </span>
                        {t.priority && <PriorityBadge priority={t.priority} />}
                        <span className="text-xs font-bold text-[#9A3B1B] tabular whitespace-nowrap">{late} gün gecikti</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
