import { useMemo, useState } from 'react';
import { Avatar, Segmented } from '../ui/primitives';
import { DataTable } from '../charts/Charts';
import { OLIVE_RAMP } from '../charts/palette';
import { DAY_HOURS, formatDuration, formatEstimate, useNow } from '../../lib/effort';
import { parseServerDate } from '../../lib/format';
import type { Task, User } from '../../types';

type Range = '30' | '90';

const EST_COLOR = OLIVE_RAMP[0];
const ACT_COLOR = OLIVE_RAMP[2];

/** Sapma: gerçekleşen tahminden ne kadar farklı (%); + = tahminden uzun sürdü */
const deviation = (est: number, act: number) => (est ? Math.round(((act - est) / est) * 100) : 0);
const devText = (d: number) => (d === 0 ? '±%0' : d > 0 ? `+%${d}` : `−%${Math.abs(d)}`);

/**
 * Raporlar: tamamlanan görevlerde tahmini iş gücü ile gerçekte harcanan mesai süresinin karşılaştırması.
 * Kişi başına iki çubuk (tahmini / gerçekleşen) ve sapma; altında tek tek görevler, başlangıçtan bitişe geçen iş günüyle.
 */
export default function EffortReport({ tasks, userById }: { tasks: Task[]; userById: Map<number, User> }) {
  const [range, setRange] = useState<Range>('30');
  const now = useNow(300_000);

  const done = useMemo(() => {
    const since = now - Number(range) * 86_400_000;
    return tasks.filter(t => t.status === 'TAMAMLANDI' && t.completedAt && t.estimatedMinutes && t.userId !== null && userById.has(t.userId)
      && parseServerDate(t.completedAt).getTime() >= since);
  }, [tasks, userById, range, now]);

  const people = useMemo(() => {
    const m = new Map<number, { user: User; est: number; act: number; count: number }>();
    done.forEach(t => {
      const r = m.get(t.userId!) ?? { user: userById.get(t.userId!)!, est: 0, act: 0, count: 0 };
      r.est += (t.estimatedMinutes ?? 0) * 60;
      r.act += t.spentSeconds ?? 0;
      r.count += 1;
      m.set(t.userId!, r);
    });
    return [...m.values()].sort((a, b) => b.act - a.act);
  }, [done, userById]);

  const total = people.reduce((s, p) => ({ est: s.est + p.est, act: s.act + p.act }), { est: 0, act: 0 });
  const max = Math.max(1, ...people.map(p => Math.max(p.est, p.act)));
  const totalDev = deviation(total.est, total.act);

  const rows = useMemo(() => [...done].sort((a, b) =>
    deviation((b.estimatedMinutes ?? 0) * 60, b.spentSeconds ?? 0) - deviation((a.estimatedMinutes ?? 0) * 60, a.spentSeconds ?? 0)), [done]);

  return (
    <section className="card p-5 lg:col-span-2" aria-labelledby="r-effort">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 id="r-effort" className="text-base font-semibold">Tahmin ve gerçekleşen iş gücü</h2>
          <p className="text-sm text-theme-muted">Tamamlanan görevlerde tahmini süre ile görev "Devam Ediyor"dayken geçen mesai süresi</p>
        </div>
        <Segmented<Range> label="Dönem" layoutId="effort-range" value={range} onChange={setRange}
          options={[{ value: '30', label: 'Son 30 gün' }, { value: '90', label: 'Son 90 gün' }]} />
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-theme-muted py-10 text-center">Bu dönemde tahmini süresi olan tamamlanmış görev yok.</p>
      ) : (
        <>
          <p className="text-sm mt-3 mb-5">
            <span className="font-bold tabular">{done.length}</span> görevin tahmini <span className="font-bold tabular">{formatDuration(total.est, true)}</span>,
            gerçekleşen <span className="font-bold tabular">{formatDuration(total.act, true)}</span>{' '}
            <span className={`font-bold ${totalDev > 10 ? 'text-danger' : totalDev < -10 ? 'text-good-ink' : 'text-theme-deep'}`}>({devText(totalDev)})</span>.
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold text-theme-muted mb-3" aria-hidden="true">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[0.1875rem]" style={{ backgroundColor: EST_COLOR }} /> Tahmini</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[0.1875rem]" style={{ backgroundColor: ACT_COLOR }} /> Gerçekleşen</span>
          </div>

          <ul className="space-y-3">
            {people.map(p => {
              const d = deviation(p.est, p.act);
              return (
                <li key={p.user.id} className="grid grid-cols-[minmax(0,10.625rem)_1fr_auto] items-center gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar user={p.user} size="xs" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{p.user.fullName}</span>
                      <span className="block text-[0.6875rem] text-theme-muted">{p.count} görev</span>
                    </span>
                  </span>
                  <span className="space-y-1" title={`Tahmini ${formatDuration(p.est)} · gerçekleşen ${formatDuration(p.act)}`}>
                    <Bar value={p.est} max={max} color={EST_COLOR} label={formatDuration(p.est, true)} />
                    <Bar value={p.act} max={max} color={ACT_COLOR} label={formatDuration(p.act, true)} />
                  </span>
                  <span className={`text-sm font-bold tabular w-14 text-right ${d > 10 ? 'text-danger' : d < -10 ? 'text-good-ink' : 'text-theme-deep'}`} title="Sapma: + tahminden uzun sürdü">{devText(d)}</span>
                </li>
              );
            })}
          </ul>

          <DataTable
            caption="Tamamlanan görevler: tahmini ve gerçekleşen süre"
            headers={['Görev · kişi', 'Tahmini', 'Gerçekleşen', 'Sapma', 'Başlangıç → bitiş']}
            rows={rows.map(t => {
              const est = (t.estimatedMinutes ?? 0) * 60;
              const act = t.spentSeconds ?? 0;
              return [
                `${t.content} · ${userById.get(t.userId ?? -1)?.fullName ?? ''}`,
                formatEstimate(t.estimatedMinutes ?? 0),
                formatDuration(act),
                devText(deviation(est, act)),
                t.startedAt && t.completedAt ? spanText(t.startedAt, t.completedAt) : '-',
              ];
            })}
          />
          <p className="text-[0.6875rem] text-theme-muted mt-3">
            Gerçekleşen süre yalnızca mesai saatlerini sayar (günde {DAY_HOURS} saat; hafta sonu, resmi tatil ve izin günleri hariç). Sapma ±%10 içindeyse tahmin isabetli sayılır.
          </p>
        </>
      )}
    </section>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex-1 h-2.5 rounded-r-[0.25rem] bg-theme-lightest/60 overflow-hidden">
        <span className="block h-full rounded-r-[0.25rem]" style={{ width: `${Math.max(1.5, (value / max) * 100)}%`, backgroundColor: color }} />
      </span>
      <span className="text-[0.6875rem] font-bold tabular text-theme-muted w-14">{label}</span>
    </span>
  );
}

/** Başlangıçtan bitişe takvim süresi: "3 Eki → 9 Eki (5 iş günü)" */
function spanText(startIso: string, endIso: string) {
  const s = parseServerDate(startIso), e = parseServerDate(endIso);
  const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
  let days = 0;
  for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= e; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days++;
  }
  return `${fmt.format(s)} → ${fmt.format(e)} (${Math.max(1, days)} iş günü)`;
}
