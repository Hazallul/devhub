import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretLeft, CaretRight, CaretDoubleUp, LockSimple, WarningCircle, Airplane, ArrowSquareOut, Flag, X, HandGrabbing } from '@phosphor-icons/react';
import { Avatar } from '../ui/primitives';
import GroupHeader from '../ui/GroupHeader';
import { useHolidayMap, useLeaves } from '../../hooks/api';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/meta';
import { formatDuration, useNow } from '../../lib/effort';
import { addDays, daysBetween, parseServerDate, toDate, toIsoDay } from '../../lib/format';
import { planTasks, type PlannedTask } from '../../lib/schedule';
import type { Project, Task, User } from '../../types';

/** Geriye ve ileriye kaç gün kaydırılabilir */
const PAST_DAYS = 21;
const FUTURE_DAYS = 98;
const TOTAL = PAST_DAYS + FUTURE_DAYS;
/** Ölçüler (rem): gün sütunu, görev şeridi, çubuk yüksekliği, kişi sütunu */
const DAY = 6.5;
const LANE = 2.75;
const BAR = 2.375;
const NAME = 14;

const weekdayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const monthNameFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long' });
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/** Çubuk rengi son tarihe ne kadar pay kaldığını gösterir; yüksek öncelik çubukta ayrı bir işaretle görünür. */
type Urgency = 'late' | 'soon' | 'calm' | 'none';
const URGENCY: Record<Urgency, { bg: string; fade: string; label: string }> = {
  calm: { bg: 'bg-tl-calm', fade: 'from-tl-calm', label: 'Rahat' },
  soon: { bg: 'bg-tl-soon', fade: 'from-tl-soon', label: 'Yaklaşıyor' },
  late: { bg: 'bg-tl-risk', fade: 'from-tl-risk', label: 'Son gün ya da gecikiyor' },
  none: { bg: 'bg-tl-none', fade: 'from-tl-none', label: 'Son tarih yok' },
};
/** İş bittikten sonra son tarihe en fazla bu kadar iş günü kalıyorsa "yaklaşıyor" */
const SOON_SLACK = 2;

function urgencyOf(p: PlannedTask): Urgency {
  if (p.dueIndex === null) return 'none';
  if (p.lateDays > 0 || p.dueIndex <= 0) return 'late';
  return (p.slackDays ?? 0) <= SOON_SLACK ? 'soon' : 'calm';
}

export interface TimelinePerson { user: User; open: Task[] }

interface Props {
  groups: { key: string; items: TimelinePerson[] }[];
  isClosed: (key: string) => boolean;
  onToggle: (key: string) => void;
  projectById: Map<number, Project>;
  unassignedCount: number;
  onOpen: (id: number) => void;
}

/** Takvimde bir görev: gün sınırlarına oturtulmuş başlangıç/bitiş sütunu ve şeridi. */
interface Bar {
  plan: PlannedTask;
  from: number;
  to: number;
  lane: number;
  urgency: Urgency;
  dueCol: number | null;
}

interface PersonPlan { list: Bar[]; lanes: number; later: number; finish: Date | null; hours: number }
interface Selected { bar: Bar; user: User; rect: DOMRect }

/**
 * Takvim görünümü: her kişinin açık görevleri günlere yayılır (planlama: lib/schedule.ts). Çubuk, işin düştüğü günleri
 * tam olarak kaplar; aynı günlere düşen işler alt alta şeritlere dizilir. Takvim fareyle sürüklenerek ya da oklarla
 * geçmişe ve ileriye kaydırılır; çubuğa tıklayınca ayrıntı kartı açılır.
 */
export default function PeopleTimeline({ groups, isClosed, onToggle, projectById, unassignedCount, onOpen }: Props) {
  const holidays = useHolidayMap();
  const { data: leaves } = useLeaves();
  const now = useNow(60_000);
  const today = toDate(toIsoDay(new Date(now)));
  const origin = addDays(today, -PAST_DAYS);
  const days = Array.from({ length: TOTAL }, (_, i) => addDays(origin, i));
  const scroller = useRef<HTMLDivElement>(null);
  const [firstVisible, setFirstVisible] = useState(PAST_DAYS - 1);
  const frame = useRef(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const leaveDays = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const l of leaves ?? []) {
      if (l.state !== 'ONAYLANDI') continue;
      const set = map.get(l.userId) ?? new Set<string>();
      for (let d = toDate(l.startDate); toIsoDay(d) <= l.endDate; d = addDays(d, 1)) set.add(toIsoDay(d));
      map.set(l.userId, set);
    }
    return map;
  }, [leaves]);

  const offDay = (iso: string) => {
    const wd = toDate(iso).getDay();
    return wd === 0 || wd === 6 || holidays.set.has(iso);
  };

  // Kişi başına planlanmış çubuklar: gün sınırına oturtulur, çakışanlar alt şeride iner
  const plans = useMemo(() => {
    const m = new Map<number, PersonPlan>();
    for (const g of groups) for (const p of g.items) {
      const off = leaveDays.get(p.user.id);
      const plan = planTasks(p.open, iso => offDay(iso) || !!off?.has(iso), now);
      const list: Bar[] = [];
      const laneEnds: number[] = [];
      let later = 0;
      for (const x of plan) {
        const startDay = Math.floor(x.start + 1e-6);
        let from = PAST_DAYS + startDay;
        const to = PAST_DAYS + Math.max(startDay, Math.ceil(x.end - 1e-6) - 1);
        // Başlamış görev, başladığı günden itibaren görünür
        if (x.task.status === 'DEVAM' && x.task.startedAt) from = Math.min(from, PAST_DAYS + daysBetween(today, parseServerDate(x.task.startedAt)));
        if (from >= TOTAL) { later++; continue; }
        const f = Math.max(0, from), t = Math.min(TOTAL - 1, to);
        let lane = laneEnds.findIndex(end => end < f);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(t); } else laneEnds[lane] = t;
        list.push({ plan: x, from: f, to: t, lane, urgency: urgencyOf(x), dueCol: x.dueIndex !== null ? PAST_DAYS + x.dueIndex : null });
      }
      const last = plan[plan.length - 1];
      m.set(p.user.id, {
        list, lanes: Math.max(1, laneEnds.length), later,
        finish: last ? addDays(today, Math.max(Math.floor(last.start + 1e-6), Math.ceil(last.end - 1e-6) - 1)) : null,
        hours: plan.reduce((s, x) => s + x.hours, 0),
      });
    }
    return m;
  }, [groups, leaveDays, holidays.set, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayPx = () => scroller.current?.querySelector<HTMLElement>('[data-day]')?.offsetWidth || 104;

  // Açılışta bugün, solda bir gün pay bırakarak görünsün
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = (PAST_DAYS - 1) * dayPx();
  }, []);

  const scrollByDays = (n: number) => scroller.current?.scrollBy({ left: n * dayPx(), behavior: 'smooth' });
  const scrollToToday = () => scroller.current?.scrollTo({ left: (PAST_DAYS - 1) * dayPx(), behavior: 'smooth' });
  const onScroll = () => {
    if (!scroller.current || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (!scroller.current) return;
      // Yalnızca gün değişince yeniden çizilir; çubuk yazılarının kayması CSS'te (.tl-label), kaydırmayla aynı karede olur
      setFirstVisible(Math.round(scroller.current.scrollLeft / dayPx()));
      setSelected(null);
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Fareyle tutup sürükleyerek kaydırma; çubuklara tıklamayı engellemez
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType === 'touch' || (e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !scroller.current) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved) { d.moved = true; setGrabbing(true); scroller.current.setPointerCapture(e.pointerId); }
    scroller.current.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.moved && scroller.current?.hasPointerCapture(e.pointerId)) scroller.current.releasePointerCapture(e.pointerId);
    drag.current = null;
    setGrabbing(false);
  };

  const visibleMonth = monthFmt.format(addDays(origin, Math.min(TOTAL - 1, firstVisible + 1)));
  const trackWidth = `${TOTAL * DAY}rem`;
  const selectedTask = selected?.bar.plan.task;

  return (
    <div className="card overflow-hidden">
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-theme-light">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => scrollByDays(-7)} className="icon-btn border border-theme-light/70" aria-label="Bir hafta geri"><CaretLeft size={16} weight="bold" /></button>
          <button type="button" onClick={scrollToToday} className="btn-secondary h-9 min-h-0 px-3 text-sm">Bugün</button>
          <button type="button" onClick={() => scrollByDays(7)} className="icon-btn border border-theme-light/70" aria-label="Bir hafta ileri"><CaretRight size={16} weight="bold" /></button>
          <span className="ml-2 text-sm font-semibold text-theme-text capitalize">{visibleMonth}</span>
          <span className="hidden xl:inline-flex items-center gap-1 ml-3 text-xs text-theme-muted"><HandGrabbing size={14} aria-hidden="true" /> Tutup sürükleyerek kaydırın</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-theme-muted">
          {(['calm', 'soon', 'late', 'none'] as Urgency[]).map(k => <Swatch key={k} className={URGENCY[k].bg} label={URGENCY[k].label} />)}
          <span className="flex items-center gap-1"><CaretDoubleUp size={12} weight="bold" className="text-theme-text" aria-hidden="true" />Yüksek öncelik</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-good" aria-hidden="true" />Devam ediyor</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-clay-soft border border-clay-line" aria-hidden="true" />İzin</span>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`tl-scroller overflow-x-auto scrollbar-thin select-none ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div className="relative" style={{ width: `calc(${NAME}rem + ${trackWidth})` }}>
          {/* Gün zemini: hafta sonu ve tatil gölgesi, bugün vurgusu (bütün satırların arkasında tek katman) */}
          <div className="absolute inset-y-0 flex pointer-events-none" style={{ left: `${NAME}rem`, width: trackWidth }} aria-hidden="true">
            {days.map((d, i) => {
              const iso = toIsoDay(d);
              return (
                <span key={iso} className={`h-full flex-none border-l ${d.getDate() === 1 ? 'border-theme-medium/60' : 'border-theme-light/60'} ${
                  i === PAST_DAYS ? 'bg-accent/[0.07]' : offDay(iso) ? 'bg-theme-lightest/70' : ''}`} style={{ width: `${DAY}rem` }} />
              );
            })}
          </div>

          {/* Başlık: ay adı ve günler */}
          <div className="relative flex border-b border-theme-light">
            <div className="sticky left-0 z-20 shrink-0 bg-surface border-r border-theme-light px-4 flex items-end pb-2 text-xs font-medium text-theme-muted" style={{ width: `${NAME}rem` }}>Kişi</div>
            {days.map((d, i) => {
              const iso = toIsoDay(d);
              const isToday = i === PAST_DAYS;
              const monthStart = d.getDate() === 1 || i === 0;
              return (
                <div key={iso} data-day className="flex-none pt-1.5 pb-2 px-2" style={{ width: `${DAY}rem` }} title={holidays.names.get(iso)}>
                  <p className={`text-[0.625rem] font-semibold uppercase tracking-wide h-3.5 ${monthStart ? 'text-theme-deep' : 'invisible'}`}>{monthNameFmt.format(d)}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs tabular inline-flex items-center justify-center ${isToday ? 'w-6 h-6 rounded-full bg-accent text-white font-semibold' : offDay(iso) ? 'text-theme-muted/70' : 'text-theme-text font-semibold'}`}>{d.getDate()}</span>
                    <span className={`text-xs ${isToday ? 'text-accent font-medium' : 'text-theme-muted'}`}>{isToday ? 'Bugün' : weekdayFmt.format(d)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {groups.map(g => {
            const open = !isClosed(g.key);
            const late = g.items.reduce((s, p) => s + (plans.get(p.user.id)?.list.filter(b => b.plan.lateDays > 0).length ?? 0), 0);
            return (
              <div key={g.key} className="relative">
                {/* Grup başlığı satırı tam genişlikte; başlığın kendisi sola yapışık kalır */}
                <div className="relative z-10 bg-surface border-t border-theme-light">
                <div className="sticky left-0" style={{ width: `min(100vw - 20rem, ${NAME + 34}rem)` }}>
                  <GroupHeader title={g.key} count={g.items.length} open={open} onToggle={() => onToggle(g.key)} sticky={false}
                    summary={late > 0 ? <span className="text-danger font-medium">{late} görev son tarihe yetişmiyor</span> : undefined} />
                </div>
                </div>
                {open && g.items.map(p => (
                  <PersonRow key={p.user.id} user={p.user} info={plans.get(p.user.id)} leave={leaveDays.get(p.user.id)} origin={origin}
                    projectById={projectById} selectedId={selectedTask?.id ?? null}
                    onSelect={(bar, rect) => setSelected(s => (s?.bar.plan.task.id === bar.plan.task.id ? null : { bar, user: p.user, rect }))} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {unassignedCount > 0 && (
        <p className="px-4 py-2.5 text-xs text-theme-muted border-t border-theme-light">
          Atanmamış {unassignedCount} görev takvimde yer almaz; Kartlar görünümünden bir kişiye atayın.
        </p>
      )}

      <AnimatePresence>
        {selected && selectedTask && (
          <DetailCard key={selectedTask.id} sel={selected} today={today} project={selectedTask.projectId ? projectById.get(selectedTask.projectId) : undefined}
            onClose={() => setSelected(null)} onOpen={() => { setSelected(null); onOpen(selectedTask.id); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${className}`} aria-hidden="true" />{label}</span>;
}

function PersonRow({ user: u, info, leave, origin, projectById, selectedId, onSelect }: {
  user: User; info?: PersonPlan; leave?: Set<string>; origin: Date; projectById: Map<number, Project>; selectedId: number | null;
  onSelect: (bar: Bar, rect: DOMRect) => void;
}) {
  const list = info?.list ?? [];
  const late = list.filter(b => b.plan.lateDays > 0).length;
  const height = Math.max(4.75, (info?.lanes ?? 1) * LANE + 0.75);
  const leaveCols = leave ? [...leave].map(iso => daysBetween(origin, toDate(iso))).filter(i => i >= 0 && i < TOTAL) : [];

  return (
    <section aria-label={`${u.fullName} takvimi`} className="relative flex border-t border-theme-light">
      <div className="sticky left-0 z-10 shrink-0 bg-surface border-r border-theme-light px-4 py-2.5" style={{ width: `${NAME}rem`, minHeight: `${height}rem` }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar user={u} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{u.fullName}</p>
            <p className="text-xs text-theme-muted truncate">{[u.jobTitle || 'Çalışan', u.department].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <p className="text-xs text-theme-muted mt-1.5 leading-snug">
          {list.length === 0 && !info?.later ? 'Açık görevi yok' : <>
            {formatDuration((info?.hours ?? 0) * 3600, true)} iş
            {info?.finish && <> · bitiş <span className="text-theme-text font-medium">{shortFmt.format(info.finish)}</span></>}
          </>}
        </p>
        {late > 0 && <p className="text-xs text-danger font-medium mt-0.5">{late} görev son tarihe yetişmiyor</p>}
        {u.status === 'IZINLI' && <p className="text-xs text-clay-ink mt-0.5 flex items-center gap-1"><Airplane size={12} weight="bold" aria-hidden="true" /> Bugün izinli</p>}
        {(info?.later ?? 0) > 0 && <p className="text-xs text-theme-muted mt-0.5">{info!.later} görev daha ileride</p>}
      </div>

      <div className="relative shrink-0" style={{ width: `${TOTAL * DAY}rem`, minHeight: `${height}rem` }}>
        {leaveCols.map(i => (
          <span key={i} className="absolute inset-y-0 bg-clay-soft/80 flex items-end justify-center pb-1 text-[0.625rem] font-medium text-clay-ink pointer-events-none"
            style={{ left: `${i * DAY}rem`, width: `${DAY}rem` }}>İzin</span>
        ))}
        {list.map(b => (
          <BarItem key={b.plan.task.id} bar={b} project={b.plan.task.projectId ? projectById.get(b.plan.task.projectId) : undefined}
            active={selectedId === b.plan.task.id} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function BarItem({ bar, project, active, onSelect }: {
  bar: Bar; project?: Project; active: boolean; onSelect: (bar: Bar, rect: DOMRect) => void;
}) {
  const t = bar.plan.task;
  const tone = URGENCY[bar.urgency].bg;
  const high = t.priority === 'YUKSEK';
  const running = t.status === 'DEVAM';
  const span = bar.to - bar.from + 1;
  const meta = [formatDuration(bar.plan.hours * 3600, true), project?.name].filter(Boolean).join(' · ');
  const said = [t.content, high && 'Yüksek öncelik', URGENCY[bar.urgency].label, meta].filter(Boolean).join('. ');
  // Son tarih çubuktan sonraysa şeritte küçük bir bayrak görünür
  const showFlag = bar.dueCol !== null && bar.dueCol > bar.to && bar.dueCol < TOTAL;
  const top = `${0.375 + bar.lane * LANE}rem`;
  return (
    <>
      {showFlag && (
        <span className="absolute flex items-center justify-end pr-2 text-theme-muted pointer-events-none" aria-hidden="true"
          style={{ left: `${bar.dueCol! * DAY}rem`, width: `${DAY}rem`, top, height: `${BAR}rem` }}>
          <Flag size={12} weight="fill" />
        </span>
      )}
      <motion.button
        type="button"
        onClick={e => onSelect(bar, e.currentTarget.getBoundingClientRect())}
        aria-label={`${said}. Ayrıntılar için tıklayın.`}
        aria-expanded={active}
        initial={{ opacity: 0, scaleX: 0.92 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`absolute origin-left rounded-lg text-left text-white overflow-clip px-2 py-1 shadow-soft transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent ${tone} ${
          bar.plan.blocked ? 'opacity-75' : ''} ${active ? 'ring-2 ring-offset-1 ring-theme-text/50' : ''}`}
        style={{ left: `calc(${bar.from * DAY}rem + 0.1875rem)`, width: `calc(${span * DAY}rem - 0.375rem)`, top, height: `${BAR}rem` }}
      >
        {/* Çubuğun başı kişi sütununun altına kaydığında yazı görünür başta kalır (son günde durur, .tl-label) */}
        <span className="tl-label block" style={{
          '--tl-from': `${bar.from * DAY}rem`, '--tl-to': `${(bar.from + span - 1) * DAY}rem`, '--tl-shift': `${(span - 1) * DAY}rem`,
        } as React.CSSProperties}>
        <span className="flex items-center gap-1 text-xs font-semibold leading-tight min-w-0">
          {high && <CaretDoubleUp size={12} weight="bold" className="shrink-0" aria-hidden="true" />}
          {running && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true" />}
          {bar.plan.blocked && <LockSimple size={11} weight="bold" className="shrink-0" aria-hidden="true" />}
          {bar.plan.lateDays > 0 && <WarningCircle size={12} weight="bold" className="shrink-0" aria-hidden="true" />}
          <span className="truncate">{t.content}</span>
        </span>
        <span className="block text-[0.6875rem] leading-tight text-white/85 truncate mt-0.5">{meta}</span>
        </span>
        {/* Kayan yazı çubuğun sonunda yumuşakça kesilir */}
        <span className={`absolute inset-y-0 right-0 w-3 bg-gradient-to-l ${URGENCY[bar.urgency].fade} pointer-events-none`} aria-hidden="true" />
      </motion.button>
    </>
  );
}

/** Çubuğa tıklayınca açılan ayrıntı kartı: çubuğun altında (yer yoksa üstünde), ekrandan taşmaz. */
function DetailCard({ sel, today, project, onClose, onOpen }: { sel: Selected; today: Date; project?: Project; onClose: () => void; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { bar, user, rect } = sel;
  const t = bar.plan.task;
  const p = bar.plan;
  const overdue = p.dueIndex !== null && p.dueIndex < 0;
  const width = 320;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
  const below = rect.bottom + 280 < window.innerHeight;
  const top = below ? rect.bottom + 8 : Math.max(12, rect.top - 288);
  const startDay = Math.floor(p.start + 1e-6);
  const planStart = addDays(today, startDay);
  const planEnd = addDays(today, Math.max(startDay, Math.ceil(p.end - 1e-6) - 1));
  const status = TASK_STATUS[t.status ?? 'YAPILACAK'];
  const prio = TASK_PRIORITY[t.priority ?? 'ORTA'];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); window.clearTimeout(id); };
  }, [onClose]);

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={t.content}
      initial={{ opacity: 0, y: below ? -6 : 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="fixed z-[120] rounded-2xl border border-theme-light bg-surface shadow-float p-4"
      style={{ left, top, width }}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${URGENCY[bar.urgency].bg}`} aria-hidden="true" />
        <p className="text-sm font-semibold leading-snug flex-1 text-theme-text">{t.content}</p>
        <button type="button" onClick={onClose} className="icon-btn w-7 h-7 -mt-1 -mr-1" aria-label="Kapat"><X size={14} weight="bold" /></button>
      </div>
      <p className="text-xs text-theme-muted mt-1 ml-[1.125rem]">{user.fullName}{project && <> · {project.name}</>}</p>

      <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1.5 text-xs">
        <dt className="text-theme-muted">Durum</dt>
        <dd className="flex items-center gap-1 text-theme-text"><status.icon size={13} weight="bold" className={status.className} aria-hidden="true" /> {status.label}</dd>
        <dt className="text-theme-muted">Öncelik</dt>
        <dd className="text-theme-text flex items-center gap-1">{t.priority === 'YUKSEK' && <CaretDoubleUp size={12} weight="bold" aria-hidden="true" />}{prio.label}</dd>
        {t.startedAt && <><dt className="text-theme-muted">Başladı</dt><dd className="text-theme-text">{shortFmt.format(parseServerDate(t.startedAt))}</dd></>}
        <dt className="text-theme-muted">{t.startedAt ? 'Kalan plan' : 'Plan'}</dt>
        <dd className="text-theme-text">{planStart.getTime() === planEnd.getTime() ? longFmt.format(planStart) : `${shortFmt.format(planStart)} – ${shortFmt.format(planEnd)}`}</dd>
        <dt className="text-theme-muted">Kalan iş</dt>
        <dd className="text-theme-text">{formatDuration(p.hours * 3600, true)}{t.estimatedMinutes ? <span className="text-theme-muted"> (tahmin {formatDuration(t.estimatedMinutes * 60, true)})</span> : null}</dd>
        <dt className="text-theme-muted">Son tarih</dt>
        <dd className="text-theme-text">{t.dueDate ? shortFmt.format(toDate(t.dueDate)) : 'Yok'}</dd>
        {p.slackDays !== null && p.dueIndex! > 0 && <>
          <dt className="text-theme-muted">Pay</dt>
          <dd className="text-theme-text">{p.slackDays === 0 ? 'Tam son gün bitiyor' : `Bittikten sonra ${p.slackDays} iş günü kalıyor`}</dd>
        </>}
      </dl>

      {(p.lateDays > 0 || p.blocked) && (
        <div className="mt-3 space-y-1.5">
          {p.lateDays > 0 && (
            <p className="text-xs rounded-lg bg-danger-soft text-danger-ink px-2.5 py-1.5 flex items-start gap-1.5">
              <WarningCircle size={14} weight="bold" className="shrink-0 mt-px" aria-hidden="true" />
              {overdue ? `Son tarih ${-p.dueIndex!} gün önce geçti.` : `Bu plana göre son tarih ${p.lateDays} iş günü aşılıyor.`}
            </p>
          )}
          {p.blocked && (
            <p className="text-xs rounded-lg bg-theme-lightest text-theme-text px-2.5 py-1.5 flex items-start gap-1.5">
              <LockSimple size={14} weight="bold" className="shrink-0 mt-px" aria-hidden="true" /> Önce bitmesi gereken bir görevi bekliyor.
            </p>
          )}
        </div>
      )}

      <button type="button" onClick={onOpen} className="btn-secondary w-full mt-3.5 h-9 min-h-0 text-sm">
        <ArrowSquareOut size={15} weight="bold" /> Görevi aç
      </button>
    </motion.div>,
    document.body,
  );
}
