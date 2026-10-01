import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Timer, CaretDown, PencilSimple, Info } from '@phosphor-icons/react';
import { useCorrectTaskTime, useTaskSessions, useUpdateTask } from '../../hooks/api';
import { effortTone, formatDuration, formatEstimate, liveSpent, parseHours, useNow } from '../../lib/effort';
import { parseServerDate } from '../../lib/format';
import type { Task } from '../../types';

const TONE_BAR = { none: 'bg-theme-medium', ok: 'bg-theme-medium', near: 'bg-warn', over: 'bg-danger' } as const;

const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });

/**
 * Görev ayrıntısındaki "İş gücü": tahmini süre, harcanan (Devam Ediyor'dayken mesai saatlerinde kendiliğinden işler),
 * kalan, çalışma kayıtları ve elle düzeltme. Tahmini süreyi yönetici ya da görevi kendine açan kişi değiştirir.
 */
export default function EffortPanel({ task, canEdit, canEditEstimate }: { task: Task; canEdit: boolean; canEditEstimate: boolean }) {
  const now = useNow(15_000, !!task.ticking);
  const spent = liveSpent(task, now);
  const est = task.estimatedMinutes ?? null;
  const tone = effortTone(spent, est);
  const pct = est ? Math.min(100, (spent / (est * 60)) * 100) : 0;
  const over = est ? spent - est * 60 : 0;
  const status = task.status ?? 'YAPILACAK';

  const [editing, setEditing] = useState<'estimate' | 'spent' | null>(null);
  const [showLog, setShowLog] = useState(false);

  return (
    <section aria-labelledby={`effort-${task.id}`} className="rounded-3xl bg-surface border border-theme-light/50 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 id={`effort-${task.id}`} className="eyebrow flex items-center gap-1.5"><Timer size={13} weight="bold" /> İş gücü</h3>
        <LiveBadge task={task} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tahmini" value={est ? formatEstimate(est) : '—'}
          action={canEditEstimate && editing !== 'estimate' ? () => setEditing('estimate') : undefined} actionLabel="Tahmini süreyi değiştir" />
        <Stat label="Harcanan" value={formatDuration(spent)} strong
          action={canEdit && editing !== 'spent' ? () => setEditing('spent') : undefined} actionLabel="Harcanan süreyi düzelt" />
        <Stat
          label={over > 0 ? 'Aşım' : 'Kalan'}
          value={!est ? '—' : over > 0 ? `+${formatDuration(over)}` : status === 'TAMAMLANDI' ? 'Bitti' : formatDuration(est * 60 - spent)}
          tone={over > 0 ? 'text-danger' : undefined}
        />
      </div>

      {est ? (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-theme-lightest overflow-hidden" role="progressbar" aria-label="Tahmine göre harcanan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <motion.div className={`h-full rounded-full ${TONE_BAR[tone]}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
          </div>
          <p className="text-[0.6875rem] font-semibold text-theme-muted mt-1.5 tabular">
            Tahmine göre %{Math.round((spent / (est * 60)) * 100)}
            {tone === 'over' && <span className="text-danger"> · tahmin aşıldı</span>}
            {tone === 'near' && <span className="text-warn-ink"> · tahmine yaklaştı</span>}
          </p>
        </div>
      ) : (
        <p className="text-xs text-theme-muted mt-3">Bu görev için tahmini süre girilmemiş{canEditEstimate ? '; yukarıdan ekleyebilirsiniz.' : '.'}</p>
      )}

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div key={editing} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {editing === 'estimate'
              ? <EstimateEditor task={task} onDone={() => setEditing(null)} />
              : <SpentEditor task={task} spent={spent} onDone={() => setEditing(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="flex items-start gap-1.5 text-[0.6875rem] text-theme-muted mt-4 leading-relaxed">
        <Info size={13} weight="bold" className="shrink-0 mt-px" aria-hidden="true" />
        Süre, görev "Devam Ediyor"dayken mesai saatlerinde (hafta içi 09:00–12:00, 13:00–18:00; tatil ve izin günleri hariç) işler.
        Yapılacak'a alınca durur, tekrar başlatınca kaldığı yerden sürer. Yanlışlıkla tamamlandı yapıp 10 dakika içinde geri alırsanız süre kesilmez.
      </p>

      <button type="button" onClick={() => setShowLog(s => !s)} aria-expanded={showLog}
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-theme-deep hover:underline underline-offset-4 rounded">
        Çalışma kayıtları <motion.span animate={{ rotate: showLog ? 180 : 0 }} className="flex"><CaretDown size={12} weight="bold" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {showLog && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SessionList taskId={task.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Stat({ label, value, strong, tone, action, actionLabel }: { label: string; value: string; strong?: boolean; tone?: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-theme-cream/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="eyebrow">{label}</span>
        {action && (
          <button type="button" onClick={action} className="p-1 -m-1 rounded-md text-theme-muted hover:text-theme-deep" aria-label={actionLabel} title={actionLabel}>
            <PencilSimple size={12} weight="bold" />
          </button>
        )}
      </div>
      <p className={`mt-1 tabular truncate ${strong ? 'text-lg font-bold' : 'text-base font-bold'} ${tone ?? 'text-theme-text'}`}>{value}</p>
    </div>
  );
}

/** Devam ediyorsa: mesai içindeyse "Çalışılıyor" (nabız), değilse "Mesai dışında, beklemede". */
export function LiveBadge({ task }: { task: Task }) {
  if (!task.running) return null;
  return task.ticking ? (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold text-good-ink bg-good-soft px-2 py-1 rounded-full">
      <span className="relative flex w-2 h-2" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-good animate-ping motion-reduce:animate-none opacity-60" />
        <span className="relative w-2 h-2 rounded-full bg-good" />
      </span>
      Süre işliyor
    </span>
  ) : (
    <span className="text-[0.6875rem] font-bold text-theme-muted bg-theme-lightest px-2 py-1 rounded-full" title="Görev devam ediyor; süre yalnızca mesai saatlerinde işler">Mesai dışı · beklemede</span>
  );
}

function EstimateEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const update = useUpdateTask();
  const [value, setValue] = useState(task.estimatedMinutes ? String(task.estimatedMinutes / 60).replace('.', ',') : '');
  const minutes = parseHours(value);
  const valid = minutes !== null && minutes >= 15 && minutes <= 400 * 60;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    update.mutate({ id: task.id, estimatedMinutes: minutes! });
    onDone();
  };
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-theme-light/40">
      <label className="flex-1 min-w-[8.75rem]">
        <span className="label text-xs">Yeni tahmini süre (saat)</span>
        <input autoFocus inputMode="decimal" className="input py-2" value={value} onChange={e => setValue(e.target.value)} placeholder="Örn: 12"
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onDone(); } }} />
      </label>
      <button type="button" onClick={onDone} className="btn-ghost min-h-[2.625rem] px-3">Vazgeç</button>
      <button type="submit" disabled={!valid} className="btn-primary min-h-[2.625rem] px-4">Kaydet</button>
    </form>
  );
}

function SpentEditor({ task, spent, onDone }: { task: Task; spent: number; onDone: () => void }) {
  const correct = useCorrectTaskTime();
  const [value, setValue] = useState(String(Math.round((spent / 3600) * 4) / 4).replace('.', ','));
  const minutes = parseHours(value);
  const valid = minutes !== null && minutes <= 100_000;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    correct.mutate({ id: task.id, spentMinutes: minutes! }, { onSuccess: onDone });
  };
  return (
    <form onSubmit={save} className="mt-4 pt-4 border-t border-theme-light/40">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[8.75rem]">
          <span className="label text-xs">Doğru harcanan süre (saat ya da ss:dd)</span>
          <input autoFocus inputMode="decimal" className="input py-2" value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onDone(); } }} />
        </label>
        <button type="button" onClick={onDone} className="btn-ghost min-h-[2.625rem] px-3">Vazgeç</button>
        <button type="submit" disabled={!valid || correct.isPending} className="btn-primary min-h-[2.625rem] px-4">Düzelt</button>
      </div>
      <p className="text-[0.6875rem] text-theme-muted mt-1.5">Örn. görevi "Devam Ediyor"a almayı unuttuysanız. Düzeltme görev geçmişine ve sistem loguna yazılır.</p>
    </form>
  );
}

function SessionList({ taskId }: { taskId: number }) {
  const { data, isLoading } = useTaskSessions(taskId);
  if (isLoading) return <p className="text-xs text-theme-muted mt-3">Yükleniyor…</p>;
  if (!data?.length) return <p className="text-xs text-theme-muted mt-3">Henüz çalışma kaydı yok. Görev "Devam Ediyor"a alınınca başlar.</p>;
  return (
    <ul className="mt-3 space-y-1.5">
      {[...data].reverse().map(s => {
        const start = parseServerDate(s.startedAt);
        const end = s.endedAt ? parseServerDate(s.endedAt) : null;
        const sameDay = end && start.toDateString() === end.toDateString();
        return (
          <li key={s.id} className="flex items-center gap-3 text-xs rounded-xl bg-theme-cream/70 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{dayFmt.format(start)} {timeFmt.format(start)}</span>
              <span className="text-theme-muted"> → {end ? `${sameDay ? '' : `${dayFmt.format(end)} `}${timeFmt.format(end)}` : 'devam ediyor'}</span>
              <span className="block text-[0.6875rem] text-theme-muted truncate">{s.userName}</span>
            </span>
            <span className="font-bold tabular shrink-0" title="Mesai saatlerine düşen süre">{formatDuration(s.workSeconds)}</span>
          </li>
        );
      })}
    </ul>
  );
}
