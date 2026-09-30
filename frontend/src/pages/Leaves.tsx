import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Check, X, Airplane, Hourglass, CalendarCheck, ArrowCounterClockwise, CalendarBlank, LockSimple, SealCheck, ChatText, CaretLeft, CaretRight, ArrowRight } from '@phosphor-icons/react';
import { PageHeader, StatCard, Skeleton, Avatar, Pill, EmptyState } from '../components/ui/primitives';
import { useLeaves, useUsers, useMe, useDecideLeave, useWithdrawLeave, useUndoLeaveDecision, useFinalizeLeaveDecision, useHolidayMap, useLeaveBalances } from '../hooks/api';
import Modal from '../components/ui/Modal';
import DecisionModal from '../components/ui/DecisionModal';
import type { Decision } from '../components/ui/DecisionModal';
import { useQuickActions } from '../components/layout/QuickActions';
import { LEAVE_TYPE, LEAVE_STATE } from '../lib/meta';
import { addDays, daysBetween, formatDate, toDate, toIsoDay, leaveDaysLabel } from '../lib/format';
import { listContainer, listItem } from '../lib/motion';
import type { LeaveRequest, User } from '../types';

const WINDOW = 14;
const weekday = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long' });
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/** "29 Eyl – 12 Eki 2026" */
function windowLabel(start: Date, end: Date) {
  return `${dayMonth.format(start)} – ${dayMonth.format(end)} ${end.getFullYear()}`;
}

/** "1 Eki – 4 Eki · 2 iş günü (toplam 4 gün)"; hafta sonları ve resmi tatiller iş gününden düşülür. */
function rangeLabel(l: LeaveRequest, holidays: ReadonlySet<string>) {
  const range = l.startDate === l.endDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`;
  return `${range} · ${leaveDaysLabel(l.startDate, l.endDate, holidays)}`;
}

interface TooltipState {
  leave: LeaveRequest;
  user: User;
  /** Çubuğun ekran koordinatları */
  rect: { left: number; right: number; top: number; bottom: number };
  /** Okun göstereceği yatay nokta: çubuğun ortası */
  anchorX: number;
}

const TIP_WIDTH = 280;
const GAP = 13; // balon ile çubuk arası (okun ucu çubuğa 1 px kala durur)
const EDGE = 12; // ekran kenarı payı

/**
 * Takvim çubuğunun açıklama balonu: tür, tarih, durum ve talep notu.
 * Konum animasyonsuz dış kutuda piksel olarak hesaplanır (Framer'ın transform'u konumu ezmesin);
 * ok her zaman çubuktaki noktayı gösterir, üstte yer yoksa balon alta açılır.
 */
function BarTooltip({ tip, holidays }: { tip: TooltipState | null; holidays: ReadonlySet<string> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    setHeight(tip ? boxRef.current?.offsetHeight ?? null : null);
  }, [tip?.leave.id, tip]);

  let style: React.CSSProperties = { left: -9999, top: -9999, visibility: 'hidden' };
  let arrowLeft = TIP_WIDTH / 2;
  let placement: 'top' | 'bottom' = 'top';
  if (tip && height !== null) {
    placement = tip.rect.top - height - GAP >= EDGE ? 'top' : 'bottom';
    const left = Math.max(EDGE, Math.min(tip.anchorX - TIP_WIDTH / 2, window.innerWidth - TIP_WIDTH - EDGE));
    arrowLeft = Math.max(18, Math.min(tip.anchorX - left, TIP_WIDTH - 18));
    style = { left, top: placement === 'top' ? tip.rect.top - height - GAP : tip.rect.bottom + GAP };
  }

  return createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          key="leave-tooltip"
          ref={boxRef}
          role="tooltip"
          id="leave-tooltip"
          // Dış kutu yalnızca opaklık animasyonu yapar; transform yazmadığı için hesaplanan konum bozulmaz.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="fixed z-[160] pointer-events-none"
          style={{ ...style, width: TIP_WIDTH }}
        >
          <motion.div
            key={tip.leave.id}
            initial={{ y: placement === 'top' ? 4 : -4, scale: 0.97 }}
            animate={{ y: 0, scale: 1, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } }}
            style={{ transformOrigin: `${arrowLeft}px ${placement === 'top' ? '100%' : '0%'}` }}
            className="relative"
          >
            <div className="bg-theme-text text-white rounded-2xl shadow-float p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{tip.user.fullName}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide bg-white/15 px-1.5 py-0.5 rounded-md">
                  {tip.leave.state === 'BEKLIYOR' ? 'Onay bekliyor' : LEAVE_STATE[tip.leave.state].label}
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium mt-1">{LEAVE_TYPE[tip.leave.type].label} · {rangeLabel(tip.leave, holidays)}</p>
              {tip.leave.note && (
                <p className="text-xs text-white mt-2 pt-2 border-t border-white/15 flex gap-1.5 leading-relaxed">
                  <ChatText size={14} weight="bold" className="shrink-0 mt-px text-theme-light" aria-hidden="true" />
                  <span>“{tip.leave.note}”</span>
                </p>
              )}
              {tip.leave.decisionNote && (
                <p className="text-xs text-white mt-2 pt-2 border-t border-white/15 leading-relaxed">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-white/60 mb-0.5">{tip.leave.decidedByName ?? 'Yönetici'} açıklaması</span>
                  {tip.leave.decisionNote}
                </p>
              )}
            </div>
            {/* Ok: çubuktaki noktayı gösterir */}
            <span
              aria-hidden="true"
              className={`absolute w-3 h-3 bg-theme-text rotate-45 -translate-x-1/2 ${placement === 'top' ? '-bottom-1.5' : '-top-1.5'}`}
              style={{ left: arrowLeft }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default function Leaves() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const actions = useQuickActions();
  const { data: leaves, isLoading } = useLeaves();
  const { data: users } = useUsers();
  const decide = useDecideLeave();
  const withdraw = useWithdrawLeave();
  const undo = useUndoLeaveDecision();
  const holidays = useHolidayMap();
  const { data: balances } = useLeaveBalances();
  const myBalance = balances?.find(b => b.userId === me.id);
  const finalize = useFinalizeLeaveDecision();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [confirming, setConfirming] = useState<LeaveRequest | null>(null);
  // Onay/ret kararı açıklamayla birlikte verilir (DecisionModal).
  const [deciding, setDeciding] = useState<{ leave: LeaveRequest; decision: Decision } | null>(null);
  // Takvim penceresi: bugünden itibaren hafta hafta ileri/geri kaydırılır (0 = bugün).
  const [weekOffset, setWeekOffset] = useState(0);
  const [slideDir, setSlideDir] = useState(1);

  // Sayfa kayınca balon çubuktan kopmasın.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    const main = document.getElementById('main-scroll-container');
    main?.addEventListener('scroll', hide, { passive: true });
    return () => main?.removeEventListener('scroll', hide);
  }, [tip]);

  /** Balon her zaman izin çubuğunun tam ortasına sabitlenir (fareyi takip etmez). */
  const showTip = (el: HTMLElement, leave: LeaveRequest, user: User) => {
    const r = el.getBoundingClientRect();
    const anchorX = r.left + r.width / 2;
    setTip({ leave, user, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, anchorX });
  };

  const userById = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users]);
  const today = toIsoDay(new Date());
  const windowStartDate = useMemo(() => toDate(toIsoDay(addDays(new Date(), weekOffset * 7))), [weekOffset]);
  const days = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(windowStartDate, i)), [windowStartDate]);
  const windowStart = toIsoDay(days[0]);
  const windowEnd = toIsoDay(days[WINDOW - 1]);
  const next14 = toIsoDay(addDays(new Date(), WINDOW - 1));

  const goToWeek = (offset: number) => {
    setSlideDir(offset >= weekOffset ? 1 : -1);
    setWeekOffset(offset);
  };
  /** Takvimi bir iznin başladığı haftaya getirir ve takvime kaydırır. */
  const showInCalendar = (l: LeaveRequest) => {
    goToWeek(Math.max(0, Math.floor(daysBetween(new Date(), toDate(l.startDate)) / 7)));
    document.getElementById('leave-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const pending = leaves?.filter(l => l.state === 'BEKLIYOR') ?? [];
  // Karar verilmiş ama kesinleşmemiş talepler: yönetici geri alabilir veya kesinleştirebilir.
  const openDecisions = leaves?.filter(l => (l.state === 'ONAYLANDI' || l.state === 'REDDEDILDI') && !l.finalized) ?? [];
  const mine = leaves?.filter(l => l.userId === me.id) ?? [];
  const onLeaveToday = leaves?.filter(l => l.state === 'ONAYLANDI' && l.startDate <= today && today <= l.endDate) ?? [];
  const upcoming = leaves?.filter(l => l.state === 'ONAYLANDI' && l.startDate > today && l.startDate <= next14) ?? [];
  // Görünen aralığın dışında kalan (bugün ve sonrasındaki) onaylı/bekleyen izinler
  const activeLeaves = (leaves ?? []).filter(l => l.state === 'ONAYLANDI' || l.state === 'BEKLIYOR');
  const later = activeLeaves.filter(l => l.startDate > windowEnd).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const earlier = activeLeaves.filter(l => l.endDate < windowStart && l.endDate >= today);

  // Takvimde görünecek satırlar: pencereyle kesişen onaylı/bekleyen izinler, kişiye göre gruplanır.
  const rows = useMemo(() => {
    const inWindow = (leaves ?? []).filter(l => (l.state === 'ONAYLANDI' || l.state === 'BEKLIYOR') && l.startDate <= windowEnd && l.endDate >= windowStart);
    const byUser = new Map<number, LeaveRequest[]>();
    inWindow.forEach(l => byUser.set(l.userId, [...(byUser.get(l.userId) ?? []), l]));
    return [...byUser.entries()]
      .map(([userId, list]) => ({ user: userById.get(userId), list }))
      .filter((r): r is { user: User; list: LeaveRequest[] } => !!r.user)
      .sort((a, b) => a.list[0].startDate.localeCompare(b.list[0].startDate));
  }, [leaves, userById, windowStart, windowEnd]);

  return (
    <>
      <PageHeader
        eyebrow="İzinler"
        title="İzin Yönetimi"
        description={isAdmin ? 'Talepleri onaylayın, önümüzdeki iki haftada kimin izinde olacağını görün.' : 'İzin talebi oluşturun ve ekibin izin takvimini görün.'}
        actions={<button onClick={() => actions.newLeave()} className="btn-primary"><Plus size={18} weight="bold" /> İzin Talebi</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bugün izinde" value={onLeaveToday.length} icon={Airplane} hint={onLeaveToday.length ? onLeaveToday.map(l => userById.get(l.userId)?.fullName.split(' ')[0]).join(', ') : 'Herkes görevde'} />
        <StatCard label="Onay bekleyen" value={pending.length} icon={Hourglass} hint={isAdmin ? 'Aşağıdan karar verin' : 'Yönetici onayında'} />
        <StatCard label="Yaklaşan (14 gün)" value={upcoming.length} icon={CalendarCheck} hint="Onaylanmış izinler" />
        <StatCard
          label="Yıllık izin bakiyem"
          icon={CalendarBlank}
          value={myBalance ? <>{myBalance.remaining}<span className="text-lg text-theme-muted font-semibold">/{myBalance.entitlement}</span></> : '–'}
          hint={myBalance ? `${myBalance.used} gün kullanıldı${myBalance.pending ? ` · ${myBalance.pending} gün bekliyor` : ''}` : 'Yükleniyor'}
        />
      </div>

      {/* Ekip takvimi */}
      <section id="leave-calendar" className="card p-6 mb-8 overflow-hidden" aria-labelledby="cal-title">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 id="cal-title" className="text-lg font-bold tracking-tight">Ekip İzin Takvimi</h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={windowStart}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                className="text-sm font-semibold text-theme-muted mt-0.5 tabular"
                aria-live="polite"
              >
                {windowLabel(days[0], days[WINDOW - 1])}
                {days.some(d => holidays.set.has(toIsoDay(d))) && (
                  <span className="text-[#8A4B2A]"> · {days.filter(d => holidays.set.has(toIsoDay(d))).map(d => `${dayMonth.format(d)} ${holidays.names.get(toIsoDay(d))}`).join(', ')}</span>
                )}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => goToWeek(weekOffset - 1)} disabled={weekOffset === 0} className="icon-btn border border-theme-light/70 disabled:opacity-40 disabled:pointer-events-none" aria-label="Önceki hafta">
              <CaretLeft size={18} weight="bold" />
            </button>
            <button type="button" onClick={() => goToWeek(0)} disabled={weekOffset === 0} className="btn-secondary h-10 min-h-0 px-3.5 text-sm disabled:opacity-50">
              Bugün
            </button>
            <button type="button" onClick={() => goToWeek(weekOffset + 1)} className="icon-btn border border-theme-light/70" aria-label="Sonraki hafta">
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-4 text-xs font-semibold text-theme-muted flex-wrap justify-end">
            {(['YILLIK', 'HASTALIK', 'MAZERET'] as const).map(t => (
              <span key={t} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${LEAVE_TYPE[t].className}`} />{LEAVE_TYPE[t].label}</span>
            ))}
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-theme-dark" />Onay bekliyor</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#F3E1D6]" />Resmi tatil</span>
          </div>
        </div>
        {isLoading ? <Skeleton className="h-48" /> : (
          <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
            <div className="min-w-[760px]">
              <div className="grid gap-px mb-2" style={{ gridTemplateColumns: `180px repeat(${WINDOW}, 1fr)` }}>
                <span />
                {days.map((d, i) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = toIsoDay(d) === today;
                  const holidayName = holidays.names.get(toIsoDay(d));
                  const showMonth = i === 0 || d.getDate() === 1;
                  return (
                    <div key={toIsoDay(d)} className="text-center">
                      <p className={`text-[10px] font-bold uppercase tracking-wide h-4 ${showMonth ? 'text-theme-deep' : 'text-transparent'}`} aria-hidden={!showMonth}>
                        {showMonth ? monthName.format(d) : '·'}
                      </p>
                      <div
                        title={holidayName ? `Resmi tatil: ${holidayName}` : undefined}
                        className={`py-1.5 rounded-lg ${isToday ? 'bg-theme-deep text-white' : holidayName ? 'bg-[#F3E1D6] text-[#8A4B2A]' : weekend ? 'text-theme-muted/60' : 'text-theme-muted'} ${d.getDate() === 1 && i > 0 ? 'border-l-2 border-theme-medium rounded-l-none' : ''}`}
                      >
                        <p className="text-[10px] font-bold uppercase">{weekday.format(d)}</p>
                        <p className="text-sm font-bold tabular">{d.getDate()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-theme-muted text-center py-10">Bu aralıkta planlanmış izin yok.</p>
              ) : (
                <motion.div
                  key={windowStart}
                  variants={listContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                  // Hafta değişince satırlar gidilen yönden kayarak gelir.
                  style={{ originX: slideDir > 0 ? 1 : 0 }}
                >
                  {rows.map(({ user, list }) => (
                    <motion.div
                      key={user.id}
                      variants={{ hidden: { opacity: 0, x: slideDir * 24 }, visible: { ...listItem.visible as object, x: 0 } }}
                      className="grid gap-px items-center" style={{ gridTemplateColumns: `180px repeat(${WINDOW}, 1fr)` }}>
                      <div className="flex items-center gap-2.5 pr-3 min-w-0">
                        <Avatar user={user} size="xs" />
                        <span className="text-sm font-semibold truncate">{user.fullName}</span>
                      </div>
                      <div className="relative h-9 rounded-xl bg-theme-cream" style={{ gridColumn: `2 / span ${WINDOW}` }}>
                        {days.map((d, i) => {
                          const holiday = holidays.set.has(toIsoDay(d));
                          if (!holiday && d.getDay() !== 0 && d.getDay() !== 6) return null;
                          return (
                            <span
                              key={i}
                              className={`absolute inset-y-0 ${holiday ? 'bg-[#F3E1D6]/70' : 'bg-theme-lightest/80'}`}
                              style={{ left: `${(i / WINDOW) * 100}%`, width: `${100 / WINDOW}%` }}
                            />
                          );
                        })}
                        {list.map(l => {
                          const rawStart = daysBetween(windowStartDate, toDate(l.startDate));
                          const rawEnd = daysBetween(windowStartDate, toDate(l.endDate));
                          const startIdx = Math.max(0, rawStart);
                          const endIdx = Math.min(WINDOW - 1, rawEnd);
                          // Aralığın dışına taşan uçlar düz kesilir: iznin önceden başladığı / sonra da sürdüğü anlaşılır.
                          const clipped = `${rawStart < 0 ? 'rounded-l-none' : ''} ${rawEnd > WINDOW - 1 ? 'rounded-r-none' : ''}`;
                          const pendingBar = l.state === 'BEKLIYOR';
                          return (
                            <motion.div
                              key={l.id}
                              initial={{ scaleX: 0, opacity: 0 }}
                              animate={{ scaleX: 1, opacity: 1 }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              tabIndex={0}
                              aria-label={`${user.fullName}: ${LEAVE_TYPE[l.type].label}, ${rangeLabel(l, holidays.set)}${pendingBar ? ', onay bekliyor' : ''}${l.note ? `. Not: ${l.note}` : ''}`}
                              aria-describedby={tip?.leave.id === l.id ? 'leave-tooltip' : undefined}
                              onMouseEnter={e => showTip(e.currentTarget, l, user)}
                              onMouseLeave={() => setTip(null)}
                              onFocus={e => showTip(e.currentTarget, l, user)}
                              onBlur={() => setTip(null)}
                              whileHover={{ y: -1 }}
                              className={`absolute top-1.5 bottom-1.5 rounded-lg ${clipped} origin-left flex items-center gap-1 px-2 overflow-hidden cursor-default outline-none focus-visible:ring-2 focus-visible:ring-theme-deep focus-visible:ring-offset-1 ${
                                pendingBar ? 'border-2 border-dashed border-theme-dark bg-white/70' : LEAVE_TYPE[l.type].className
                              }`}
                              style={{ left: `calc(${(startIdx / WINDOW) * 100}% + 2px)`, width: `calc(${((endIdx - startIdx + 1) / WINDOW) * 100}% - 4px)` }}
                            >
                              <span className="text-[11px] font-bold text-theme-text truncate">{LEAVE_TYPE[l.type].label}</span>
                              {l.note && <ChatText size={12} weight="bold" className="shrink-0 text-theme-text/70" aria-hidden="true" />}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}
        {!isLoading && (later.length > 0 || earlier.length > 0) && (
          <div className="mt-4 pt-4 border-t border-theme-light/40 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {earlier.length > 0 && (
              <button type="button" onClick={() => goToWeek(0)} className="inline-flex items-center gap-1.5 font-semibold text-theme-muted hover:text-theme-deep">
                <CaretLeft size={14} weight="bold" /> Daha önce: {earlier.length} izin
              </button>
            )}
            {later.length > 0 && (
              <p className="text-theme-muted font-medium flex items-center gap-2 flex-wrap">
                <span>
                  Bu aralıktan sonra <strong className="text-theme-text">{later.length} izin</strong> var
                  {later.some(l => l.state === 'BEKLIYOR') && <> ({later.filter(l => l.state === 'BEKLIYOR').length} onay bekliyor)</>}.
                </span>
                <button type="button" onClick={() => showInCalendar(later[0])} className="inline-flex items-center gap-1 font-bold text-theme-deep hover:underline underline-offset-4">
                  Sıradakine git: {userById.get(later[0].userId)?.fullName.split(' ')[0]} · {formatDate(later[0].startDate)} <ArrowRight size={14} weight="bold" />
                </button>
              </p>
            )}
          </div>
        )}
      </section>

      <div className={`grid gap-6 pb-10 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        {isAdmin && (
          <section aria-labelledby="pending-title">
            <h2 id="pending-title" className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
              Onay Bekleyenler <Pill className="bg-theme-deep text-white">{pending.length}</Pill>
            </h2>
            {pending.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Bekleyen talep yok" description="Yeni talepler geldiğinde burada görünecek." />
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {pending.map(l => {
                    const u = userById.get(l.userId);
                    const Meta = LEAVE_TYPE[l.type];
                    return (
                      <motion.li key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }} className="card p-4 flex items-center gap-4">
                        {u && <Avatar user={u} size="sm" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{u?.fullName}</p>
                          <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5 mt-0.5"><Meta.icon size={13} weight="bold" /> {Meta.label} · {rangeLabel(l, holidays.set)}</p>
                          {l.note && <p className="text-xs text-theme-text mt-1.5 italic">“{l.note}”</p>}
                          <button type="button" onClick={() => showInCalendar(l)} className="text-xs font-bold text-theme-deep hover:underline underline-offset-4 mt-1.5 inline-flex items-center gap-1">
                            <CalendarBlank size={12} weight="bold" /> Takvimde göster
                          </button>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setDeciding({ leave: l, decision: 'REDDEDILDI' })} disabled={decide.isPending} className="icon-btn border border-theme-light/70 hover:text-[#9A3B1B] hover:bg-[#FBEDE5] hover:border-transparent" aria-label={`${u?.fullName} talebini reddet`} title="Reddet">
                            <X size={18} weight="bold" />
                          </button>
                          <button onClick={() => setDeciding({ leave: l, decision: 'ONAYLANDI' })} disabled={decide.isPending} className="btn-primary h-10 min-h-0 px-4 text-sm" aria-label={`${u?.fullName} talebini onayla`}>
                            <Check size={16} weight="bold" /> Onayla
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}

            <h2 id="open-decisions-title" className="text-lg font-bold tracking-tight mt-8 mb-1 flex items-center gap-2">
              Kesinleşmemiş Kararlar <Pill className="bg-theme-lightest text-theme-deep border border-theme-light">{openDecisions.length}</Pill>
            </h2>
            <p className="text-sm text-theme-muted mb-4">Yanlış karar verdiyseniz geri alın; emin olduğunuzda kesinleştirin. Kesinleşen karar değiştirilemez.</p>
            {openDecisions.length === 0 ? (
              <p className="text-sm text-theme-muted font-medium py-6 text-center bg-white/60 rounded-3xl border border-dashed border-theme-light/60">Kesinleştirilecek karar yok.</p>
            ) : (
              <ul className="space-y-3" aria-labelledby="open-decisions-title">
                <AnimatePresence initial={false}>
                  {openDecisions.map(l => {
                    const u = userById.get(l.userId);
                    const Meta = LEAVE_TYPE[l.type];
                    const state = LEAVE_STATE[l.state];
                    return (
                      <motion.li key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }} className="card p-4">
                        <div className="flex items-center gap-4">
                          {u && <Avatar user={u} size="sm" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{u?.fullName}</p>
                            <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5 mt-0.5"><Meta.icon size={13} weight="bold" /> {Meta.label} · {rangeLabel(l, holidays.set)}</p>
                            {l.note && <p className="text-xs text-theme-text mt-1.5 italic">“{l.note}”</p>}
                            <DecisionNote leave={l} />
                          </div>
                          <Pill className={state.className}>{state.label}</Pill>
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-theme-light/40">
                          <button onClick={() => undo.mutate(l.id)} disabled={undo.isPending} className="btn-ghost h-9 min-h-0 px-3 text-sm">
                            <ArrowCounterClockwise size={16} weight="bold" /> Geri al
                          </button>
                          <button onClick={() => setConfirming(l)} className="btn-secondary h-9 min-h-0 px-3 text-sm">
                            <SealCheck size={16} weight="bold" /> Kesinleştir
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
            Taleplerim <Pill className="bg-theme-lightest text-theme-deep border border-theme-light">{mine.length}</Pill>
          </h2>
          {mine.length === 0 ? (
            <EmptyState icon={Airplane} title="Henüz talebiniz yok" description="İzin planlıyorsanız talep oluşturun; onaylandığında durumunuz otomatik güncellenir." action={<button onClick={() => actions.newLeave()} className="btn-secondary"><Plus size={16} weight="bold" /> İzin talebi</button>} />
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {mine.map(l => {
                  const Meta = LEAVE_TYPE[l.type];
                  const state = LEAVE_STATE[l.state];
                  return (
                    <motion.li key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="card p-4 flex items-center gap-4">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${Meta.className}`}><Meta.icon size={18} weight="bold" className="text-theme-text" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{Meta.label}</p>
                        <p className="text-xs text-theme-muted font-medium mt-0.5">{rangeLabel(l, holidays.set)}</p>
                        {l.note && <p className="text-xs text-theme-text mt-1 italic truncate">“{l.note}”</p>}
                        <DecisionNote leave={l} />
                      </div>
                      <Pill className={state.className}>
                        {l.finalized && l.state !== 'IPTAL' && <LockSimple size={11} weight="bold" aria-label="Kesinleşti" />}
                        {state.label}
                      </Pill>
                      {l.state === 'BEKLIYOR' && (
                        <button onClick={() => withdraw.mutate(l.id)} className="icon-btn" aria-label="Talebi geri çek" title="Geri çek">
                          <ArrowCounterClockwise size={18} weight="bold" />
                        </button>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <BarTooltip tip={tip} holidays={holidays.set} />

      <DecisionModal
        decision={deciding?.decision ?? null}
        onClose={() => setDeciding(null)}
        subject="izin talebini"
        pending={decide.isPending}
        hint="Kararı kesinleştirene kadar geri alabilirsiniz."
        onConfirm={note => deciding && decide.mutate({ id: deciding.leave.id, decision: deciding.decision, note }, { onSuccess: () => setDeciding(null) })}
      >
        {deciding && (
          <>
            <p className="text-sm font-bold text-theme-text">{userById.get(deciding.leave.userId)?.fullName}</p>
            <p className="text-sm text-theme-muted font-medium mt-0.5">{LEAVE_TYPE[deciding.leave.type].label} · {rangeLabel(deciding.leave, holidays.set)}</p>
            {deciding.leave.note && <p className="text-sm text-theme-text mt-2 italic">“{deciding.leave.note}”</p>}
          </>
        )}
      </DecisionModal>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        size="sm"
        title="Kararı kesinleştir"
        description="Bu işlem geri alınamaz."
        footer={<>
          <button type="button" onClick={() => setConfirming(null)} className="btn-ghost">Vazgeç</button>
          <button
            type="button"
            disabled={finalize.isPending}
            onClick={() => confirming && finalize.mutate(confirming.id, { onSuccess: () => setConfirming(null) })}
            className="btn-primary"
          >
            <LockSimple size={16} weight="bold" /> {finalize.isPending ? 'Kesinleştiriliyor…' : 'Evet, kesinleştir'}
          </button>
        </>}
      >
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm text-theme-text leading-relaxed">
              <strong>{userById.get(confirming.userId)?.fullName}</strong> için <strong>{LEAVE_TYPE[confirming.type].label}</strong> talebi
              ({rangeLabel(confirming, holidays.set)}) <strong>{confirming.state === 'ONAYLANDI' ? 'onaylandı' : 'reddedildi'}</strong> olarak kesinleşecek.
            </p>
            <p className="text-sm font-semibold text-[#7A3E1F] bg-[#FBEDE5] rounded-2xl p-3.5 flex gap-2">
              <LockSimple size={18} weight="bold" className="shrink-0 mt-px" />
              Kesinleştirdikten sonra bu kararı geri alamaz ya da değiştiremezsiniz.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Yöneticinin karara eklediği açıklama (ör. ret nedeni). */
function DecisionNote({ leave }: { leave: LeaveRequest }) {
  if (!leave.decisionNote) return null;
  const rejected = leave.state === 'REDDEDILDI';
  return (
    <p className={`text-xs mt-2 rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap break-words ${rejected ? 'bg-[#FBEDE5] text-[#7A3E1F]' : 'bg-theme-lightest/70 text-theme-text'}`}>
      <span className="font-bold">{leave.decidedByName ?? 'Yönetici'}:</span> {leave.decisionNote}
    </p>
  );
}
