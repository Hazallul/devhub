import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretDown, Plus, UsersThree, Airplane, ArrowSquareOut, Trash } from '@phosphor-icons/react';
import { Avatar, EmptyState, Segmented } from '../ui/primitives';
import { useContextMenu } from '../layout/ContextMenu';
import { useDeleteTask, useWorkload } from '../../hooks/api';
import { TASK_STATUS, TASK_STATUSES, TASK_PRIORITY, projectColor } from '../../lib/meta';
import { DAY_HOURS, effortTone, formatDuration, formatEstimate, liveSpent, remainingSeconds, useNow } from '../../lib/effort';
import { dueLabel, parseServerDate } from '../../lib/format';
import { UrgencyTags } from './Urgency';
import { byUrgency, taskUrgency, urgencySurface } from '../../lib/urgency';
import type { Project, Task, TaskStatus, User, Workload } from '../../types';

type Density = 'CARDS' | 'SUMMARY';
type Sort = 'LOAD' | 'NAME';

/** Tamamlandı hücresinde yalnızca son bu kadar günde biten görevler gösterilir (pano şişmesin). */
const DONE_DAYS = 14;
/** Bir hücrede ilk bakışta görünen kart sayısı; fazlası "+n daha" ile açılır. */
const CELL_LIMIT = 4;

interface Row {
  user: User;
  cells: Record<TaskStatus, Task[]>;
  /** Açık görevlerin kalan tahmini işi (saniye) */
  remaining: number;
  /** Açık görevlerin tahmini toplamı (saniye) */
  openEstimate: number;
  work?: Workload;
}

interface Props {
  tasks: Task[];
  users: User[];
  projectById: Map<number, Project>;
  /** Filtre/arama varken görevi olmayan kişiler gizlenir */
  filtered: boolean;
  canEdit: (t: Task) => boolean;
  canAssign: boolean;
  onMove: (t: Task, status: TaskStatus, userId?: number) => void;
  onOpen: (id: number) => void;
  onNew: (userId: number) => void;
}

/**
 * Kişi bazlı pano (Azure DevOps'taki "kişiye göre kulvar" görünümü): her satır bir çalışan, sütunlar görev durumları.
 * Solda kişinin bu haftaki çalışma süresi / kapasitesi ve açık iş yükü. Kartlar satır içinde sütunlar arasında
 * sürüklenir; yönetici bir kartı başka birinin satırına bırakırsa görev o kişiye aktarılır.
 */
export default function PeopleBoard({ tasks, users, projectById, filtered, canEdit, canAssign, onMove, onOpen, onNew }: Props) {
  const { data: workload } = useWorkload();
  const now = useNow(30_000);
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem('devhub.tasks.people.density') as Density) || 'CARDS');
  const [sort, setSort] = useState<Sort>('LOAD');
  const [drag, setDrag] = useState<Task | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const doneSince = now - DONE_DAYS * 86_400_000;

  const rows = useMemo<Row[]>(() => {
    const byUser = new Map<number, Row>();
    const workBy = new Map((workload ?? []).map(w => [w.userId, w]));
    const ensure = (u: User) => {
      let r = byUser.get(u.id);
      if (!r) {
        r = { user: u, cells: { YAPILACAK: [], DEVAM: [], TAMAMLANDI: [] }, remaining: 0, openEstimate: 0, work: workBy.get(u.id) };
        byUser.set(u.id, r);
      }
      return r;
    };
    const userById = new Map(users.map(u => [u.id, u]));
    // Filtre yokken görevi olmayan çalışanlar da görünür (boşta olan kim, bir bakışta anlaşılsın); yöneticiler yalnızca görevi varsa.
    if (!filtered) users.filter(u => u.role !== 'ADMIN').forEach(ensure);
    for (const t of tasks) {
      const u = userById.get(t.userId);
      if (!u) continue;
      const status = t.status ?? 'YAPILACAK';
      if (status === 'TAMAMLANDI' && (!t.completedAt || parseServerDate(t.completedAt).getTime() < doneSince)) continue;
      const r = ensure(u);
      r.cells[status].push(t);
      if (status !== 'TAMAMLANDI') {
        r.remaining += remainingSeconds(t, liveSpent(t, now));
        r.openEstimate += (t.estimatedMinutes ?? 0) * 60;
      }
    }
    const list = [...byUser.values()];
    list.forEach(r => {
      r.cells.YAPILACAK.sort(byPriority);
      r.cells.DEVAM.sort(byPriority);
      r.cells.TAMAMLANDI.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    });
    return list.sort(sort === 'LOAD'
      ? (a, b) => b.remaining - a.remaining || a.user.fullName.localeCompare(b.user.fullName, 'tr')
      : (a, b) => a.user.fullName.localeCompare(b.user.fullName, 'tr'));
  }, [tasks, users, workload, filtered, sort, now, doneSince]);

  const totals = useMemo(() => {
    let remaining = 0, worked = 0, capacity = 0, running = 0;
    rows.forEach(r => {
      remaining += r.remaining;
      worked += r.work?.weekWorkedSeconds ?? 0;
      capacity += r.work?.weekCapacitySeconds ?? 0;
      running += r.cells.DEVAM.length;
    });
    return { remaining, worked, capacity, running };
  }, [rows]);

  const changeDensity = (d: Density) => {
    setDensity(d);
    try { localStorage.setItem('devhub.tasks.people.density', d); } catch { /* yok sayılır */ }
  };

  const drop = (userId: number, status: TaskStatus) => {
    if (!drag) return;
    const reassign = userId !== drag.userId;
    if (reassign && !canAssign) return;
    onMove(drag, status, reassign ? userId : undefined);
    setDrag(null);
    setOver(null);
  };

  if (rows.length === 0) {
    return <EmptyState icon={UsersThree} title="Filtreye uyan görev yok" description="Filtreleri değiştirmeyi deneyin." />;
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm text-theme-muted">
          <span className="font-medium text-theme-text tabular">{rows.length}</span> kişi, açık iş{' '}
          <span className="font-medium text-theme-text tabular">{formatDuration(totals.remaining, true)}</span>. Bu hafta{' '}
          <span className="font-medium text-theme-text tabular">{formatDuration(totals.worked, true)}</span>
          {totals.capacity > 0 && <> / {formatDuration(totals.capacity, true)}</>} çalışıldı
          {totals.running > 0 && <>, şu an <span className="font-medium text-theme-text tabular">{totals.running}</span> görev sürüyor</>}.
        </p>
        <div className="flex gap-2">
          <Segmented<Sort> label="Sıralama" layoutId="people-sort" value={sort} onChange={setSort}
            options={[{ value: 'LOAD', label: 'Yüke göre' }, { value: 'NAME', label: 'Ada göre' }]} />
          <Segmented<Density> label="Yoğunluk" layoutId="people-density" value={density} onChange={changeDensity}
            options={[{ value: 'CARDS', label: 'Kartlar' }, { value: 'SUMMARY', label: 'Özet' }]} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Sütun başlıkları: kaydırırken üstte kalır */}
        <div className={`hidden md:grid ${GRID} sticky top-0 z-10 bg-theme-lightest/95 backdrop-blur-sm border-b border-theme-light text-xs font-medium text-theme-muted`}>
          <span className="px-4 py-2.5">Kişi</span>
          {TASK_STATUSES.map(s => {
            const meta = TASK_STATUS[s];
            return (
              <span key={s} className="flex items-center gap-1.5 px-3 py-2.5 border-l border-theme-light whitespace-nowrap min-w-0">
                <meta.icon size={14} weight="bold" className={meta.className} aria-hidden="true" />
                {meta.label}
                {s === 'TAMAMLANDI' && <span className="text-theme-muted/80 truncate" title={`Son ${DONE_DAYS} günde tamamlananlar`}>(son {DONE_DAYS} gün)</span>}
              </span>
            );
          })}
        </div>

        <div className="divide-y divide-theme-light">
          {rows.map(r => (
            <PersonRow
              key={r.user.id}
              row={r}
              density={density}
              now={now}
              projectById={projectById}
              dragging={drag}
              over={over}
              canEdit={canEdit}
              canAssign={canAssign}
              onDragStart={setDrag}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              onOver={setOver}
              onDrop={status => drop(r.user.id, status)}
              onMove={onMove}
              onOpen={onOpen}
              onNew={canAssign ? () => onNew(r.user.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Kişi sütunu + üç durum sütunu; başlık ve satırlar aynı ızgarayı kullanır */
const GRID = 'md:grid-cols-[14rem_repeat(3,minmax(0,1fr))] xl:grid-cols-[16rem_repeat(3,minmax(0,1fr))]';

const byPriority = (a: Task, b: Task) =>
  byUrgency(a, b) || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

function PersonRow({ row: r, density, now, projectById, dragging, over, canEdit, canAssign, onDragStart, onDragEnd, onOver, onDrop, onMove, onOpen, onNew }: {
  row: Row; density: Density; now: number; projectById: Map<number, Project>; dragging: Task | null; over: string | null;
  canEdit: (t: Task) => boolean; canAssign: boolean;
  onDragStart: (t: Task) => void; onDragEnd: () => void; onOver: (key: string | null) => void; onDrop: (s: TaskStatus) => void;
  onMove: (t: Task, s: TaskStatus) => void; onOpen: (id: number) => void; onNew?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const u = r.user;
  const worked = r.work?.weekWorkedSeconds ?? 0;
  const capacity = r.work?.weekCapacitySeconds ?? 0;
  const today = r.work?.todayWorkedSeconds ?? 0;
  // Yük: kalan açık iş, haftalık kapasitenin ne kadarı (1 = bir haftalık iş)
  const loadWeeks = capacity ? r.remaining / capacity : r.remaining / (DAY_HOURS * 5 * 3600);
  const loadTone = loadWeeks > 1.5 ? 'text-danger' : loadWeeks > 1 ? 'text-warn-ink' : 'text-theme-deep';
  const acceptsFromOthers = canAssign && dragging && dragging.userId !== u.id;

  const summary = density === 'SUMMARY';

  return (
    <motion.section layout="position" aria-label={u.fullName} className={`md:grid ${GRID} group/row`}>
      {/* Kişi */}
      <div className={`flex md:flex-col min-w-0 px-4 ${summary ? 'py-2.5 gap-1' : 'py-3.5 gap-2.5'}`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-none">
          <Avatar user={u} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{u.fullName}</p>
            <p className="text-xs text-theme-muted truncate">{u.jobTitle || 'Çalışan'}</p>
          </div>
          <div className="flex items-center shrink-0">
            {onNew && (
              <button type="button" onClick={onNew} className="icon-btn w-7 h-7 md:opacity-0 md:group-hover/row:opacity-100 focus:opacity-100" aria-label={`${u.fullName} için görev ata`} title="Görev ata"><Plus size={14} weight="bold" /></button>
            )}
            <button type="button" onClick={() => setCollapsed(c => !c)} className="icon-btn w-7 h-7 md:hidden" aria-expanded={!collapsed} aria-label={collapsed ? 'Görevleri göster' : 'Görevleri gizle'}>
              <motion.span animate={{ rotate: collapsed ? -90 : 0 }} className="flex"><CaretDown size={14} weight="bold" /></motion.span>
            </button>
          </div>
        </div>
        <div className={`hidden sm:block min-w-[11rem] md:min-w-0 ${summary ? 'space-y-0.5' : 'space-y-1.5'}`}>
          {u.status === 'IZINLI' && (
            <span className="inline-flex items-center gap-1 text-xs text-clay-ink"><Airplane size={12} weight="bold" aria-hidden="true" /> İzinli</span>
          )}
          <div title="Bu hafta görevlerde (Devam Ediyor) geçen mesai süresi / tatil ve izin düşülmüş haftalık kapasite">
            <div className="flex items-baseline justify-between text-xs text-theme-muted">
              <span>Bu hafta</span>
              <span className="tabular"><span className="text-theme-text font-medium">{formatDuration(worked, true)}</span>{capacity > 0 && ` / ${formatDuration(capacity, true)}`}</span>
            </div>
            {!summary && (
              <div className="h-1 rounded-full bg-theme-lightest mt-1 overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${capacity ? Math.min(100, (worked / capacity) * 100) : 0}%` }} />
              </div>
            )}
          </div>
          <p className="flex items-center justify-between text-xs text-theme-muted" title="Açık görevlerin kalan tahmini işi">
            <span>Açık iş</span>
            <span className={`tabular font-medium ${loadTone}`}>
              {formatDuration(r.remaining, true)}{!summary && r.remaining > 0 && <span className="font-normal text-theme-muted"> ({String(Math.round((r.remaining / 3600 / DAY_HOURS) * 10) / 10).replace('.', ',')} gün)</span>}
            </span>
          </p>
          {!summary && today > 0 && <p className="flex justify-between text-xs text-theme-muted"><span>Bugün</span><span className="tabular text-theme-text font-medium">{formatDuration(today, true)}</span></p>}
        </div>
      </div>

      {/* Durum hücreleri */}
      <AnimatePresence initial={false}>
        {!collapsed && TASK_STATUSES.map(s => {
          const key = `${u.id}:${s}`;
          const list = r.cells[s];
          const shown = expanded ? list : list.slice(0, CELL_LIMIT);
          const isOver = over === key && !!dragging && (dragging.userId === u.id ? canEdit(dragging) : !!acceptsFromOthers);
          const hours = list.reduce((sum, t) => sum + (s === 'TAMAMLANDI' ? liveSpent(t, now) : (t.estimatedMinutes ?? 0) * 60), 0);
          return (
            <motion.div
              key={s}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onDragOver={e => {
                if (!dragging) return;
                if (dragging.userId !== u.id && !acceptsFromOthers) return;
                e.preventDefault();
                onOver(key);
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onOver(null); }}
              onDrop={e => { e.preventDefault(); onDrop(s); }}
              className={`min-w-0 px-2.5 md:border-l border-theme-light transition-colors ${summary ? 'py-2' : 'py-2.5'} ${isOver ? 'bg-theme-medium/10 shadow-[inset_0_0_0_2px_rgb(var(--medium))]' : ''}`}
              aria-label={`${u.fullName}, ${TASK_STATUS[s].label}`}
            >
              <p className="md:hidden text-xs font-medium text-theme-muted px-1 pb-1">{TASK_STATUS[s].label}</p>
              {summary ? (
                <SummaryCell list={list} status={s} hours={hours} now={now} onOpen={onOpen} />
              ) : (
                <div className="space-y-1.5">
                  {shown.map(t => (
                    <MiniCard key={t.id} task={t} now={now} project={t.projectId ? projectById.get(t.projectId) : undefined}
                      editable={canEdit(t)} draggable={canEdit(t) || canAssign} dragging={dragging?.id === t.id}
                      onDragStart={() => onDragStart(t)} onDragEnd={onDragEnd} onOpen={() => onOpen(t.id)} onMove={st => onMove(t, st)} />
                  ))}
                  {list.length > CELL_LIMIT && (
                    <button type="button" onClick={() => setExpanded(x => !x)} className="w-full text-xs font-medium text-theme-deep hover:underline underline-offset-4 py-1 rounded">
                      {expanded ? 'Daha az göster' : `${list.length - CELL_LIMIT} görev daha`}
                    </button>
                  )}
                  {list.length === 0 && isOver && <p className="text-xs text-theme-deep text-center py-3">Buraya bırakın</p>}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.section>
  );
}

/** Özet yoğunluk: hücrede sayı, saat ve her görev için tıklanabilir küçük bir nokta. */
function SummaryCell({ list, status, hours, now, onOpen }: { list: Task[]; status: TaskStatus; hours: number; now: number; onOpen: (id: number) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="px-1">
      <p className="flex items-baseline gap-2">
        <span className="text-base font-semibold tabular">{list.length}</span>
        <span className="text-xs text-theme-muted">{status === 'TAMAMLANDI' ? `${formatDuration(hours, true)} çalışıldı` : `${formatDuration(hours, true)} tahmini`}</span>
      </p>
      <div className="flex flex-wrap gap-1 mt-1">
        {list.map(t => {
          const tone = effortTone(liveSpent(t, now), t.estimatedMinutes);
          return (
            <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={t.content} aria-label={t.content}
              className={`w-3 h-3 rounded-sm transition-transform hover:scale-125 ${tone === 'over' ? 'bg-danger' : tone === 'near' ? 'bg-warn' : t.ticking ? 'bg-good' : 'bg-theme-light'}`} />
          );
        })}
      </div>
    </div>
  );
}

function MiniCard({ task, now, project, editable, draggable, dragging, onDragStart, onDragEnd, onOpen, onMove }: {
  task: Task; now: number; project?: Project; editable: boolean; draggable: boolean; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onOpen: () => void; onMove: (s: TaskStatus) => void;
}) {
  const remove = useDeleteTask();
  const menu = useContextMenu();
  const status = task.status ?? 'YAPILACAK';
  const done = status === 'TAMAMLANDI';
  const spent = liveSpent(task, now);
  const tone = effortTone(spent, task.estimatedMinutes);
  const due = task.dueDate && !done ? dueLabel(task.dueDate) : null;
  const u = taskUrgency(task);

  return (
    <div
      draggable={draggable}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onContextMenu={e => menu(e, {
        label: 'Görev',
        items: [
          { label: 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: onOpen },
          editable && 'divider',
          ...(editable ? TASK_STATUSES.filter(s => s !== status).map(s => ({ label: `“${TASK_STATUS[s].label}” yap`, icon: TASK_STATUS[s].icon, onSelect: () => onMove(s) })) : []),
          editable && 'divider',
          editable && { label: 'Görevi sil', icon: Trash, tone: 'danger' as const, onSelect: () => remove.mutate(task.id) },
        ],
      })}
      role="button"
      tabIndex={0}
      aria-label={`${task.content} ayrıntısını aç`}
      className={`group rounded-lg border ${urgencySurface(u)} px-2.5 py-2 transition-[background-color,border-color,opacity] focus-visible:ring-2 focus-visible:ring-theme-medium outline-none ${dragging ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <UrgencyTags u={u} className="mb-1.5" />
      <p className={`text-[0.8125rem] font-medium leading-snug line-clamp-2 ${done ? 'text-theme-muted line-through decoration-theme-light' : 'text-theme-text'}`}>{task.content}</p>
      <div className="flex items-center gap-2 mt-1 text-xs text-theme-muted min-w-0">
        {project && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: projectColor(project.name) }} title={project.name} aria-hidden="true" />}
        <EffortChip spent={spent} estimate={task.estimatedMinutes} ticking={!!task.ticking} tone={tone} />
        {due && !u.overdue && <span className={`whitespace-nowrap ${due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-theme-deep' : ''}`}>{due.text}</span>}
      </div>
    </div>
  );
}

/** "2,5 / 8 sa": harcanan / tahmini; işliyorsa yeşil nabız, aşıldıysa kırmızı. Başka kartlarda da kullanılır. */
export function EffortChip({ spent, estimate, ticking, tone }: { spent: number; estimate?: number | null; ticking: boolean; tone: ReturnType<typeof effortTone> }) {
  if (!estimate && !spent) return null;
  const color = tone === 'over' ? 'text-danger' : tone === 'near' ? 'text-warn-ink' : 'text-theme-muted';
  return (
    <span className={`inline-flex items-center gap-1 tabular whitespace-nowrap ${color}`}
      title={`Harcanan ${formatDuration(spent)}${estimate ? ` / tahmini ${formatEstimate(estimate)}` : ''}${ticking ? ' · süre işliyor' : ''}`}>
      {ticking && (
        <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-good animate-ping motion-reduce:animate-none opacity-60" />
          <span className="relative w-1.5 h-1.5 rounded-full bg-good" />
        </span>
      )}
      {/* Başlanmamış görevde yalnızca tahmin; başlandıysa "harcanan / tahmini" */}
      {spent < 60 && estimate ? formatDuration(estimate * 60, true)
        : <>{formatDuration(spent, true).replace(' sa', '')}{estimate ? ` / ${formatDuration(estimate * 60, true)}` : ' sa'}</>}
    </span>
  );
}

