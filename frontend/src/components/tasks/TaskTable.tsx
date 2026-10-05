import { useMemo, useState } from 'react';
import {
  CaretUp, CaretDown, ArrowSquareOut, Trash, HandGrabbing, UserMinus, Plus, Tray, CheckSquare, Warning, ListBullets, X,
} from '@phosphor-icons/react';
import Combobox from '../ui/Combobox';
import { Avatar, EmptyState, Segmented } from '../ui/primitives';
import { useContextMenu } from '../layout/ContextMenu';
import { useDeleteTask, useUpdateTask } from '../../hooks/api';
import { useClaimTask } from '../../hooks/taskExtras';
import { LabelChips, TaskBadges } from './TaskExtras';
import { EffortChip } from './PeopleBoard';
import { UrgencyTags } from './Urgency';
import { TASK_PRIORITY, TASK_STATUS, TASK_STATUSES, projectColor } from '../../lib/meta';
import { effortTone, liveSpent, useNow } from '../../lib/effort';
import { dueLabel, formatDate, parseServerDate } from '../../lib/format';
import { byUrgency, taskUrgency } from '../../lib/urgency';
import { usePersisted } from '../../lib/groups';
import type { Project, Task, TaskStatus, User } from '../../types';

type View = 'OPEN' | 'UNASSIGNED' | 'OVERDUE' | 'ALL';
type SortKey = 'URGENCY' | 'TITLE' | 'ASSIGNEE' | 'STATUS' | 'PRIORITY' | 'DUE' | 'ESTIMATE';

const PAGE = 60;
const STATUS_RANK: Record<TaskStatus, number> = { DEVAM: 0, YAPILACAK: 1, TAMAMLANDI: 2 };

interface Props {
  tasks: Task[];
  users: User[];
  projectById: Map<number, Project>;
  me: User;
  isAdmin: boolean;
  onOpen: (id: number) => void;
  onNewUnassigned: () => void;
}

/**
 * Bütün görevlerin geniş tablosu: atanmış ya da atanmamış her görev tek listede. Yönetici atanan kişiyi satırdan
 * değiştirir, birden çok görevi seçip toplu atar; çalışan atanmamış görevi "Üstlen" ile kendine alır.
 * Sütun başlığına tıklayınca sıralanır; varsayılan sıra aciliyettir (geciken, sonra yüksek öncelik, sonra son tarih).
 */
export default function TaskTable({ tasks, users, projectById, me, isAdmin, onOpen, onNewUnassigned }: Props) {
  const now = useNow(30_000);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const claim = useClaimTask();
  const menu = useContextMenu();
  const [view, setView] = usePersisted<View>('devhub.tasks.table.view', 'OPEN');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'URGENCY', dir: 1 });
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const assignable = useMemo(() => users.filter(u => u.active !== false).sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr')), [users]);
  const personOptions = useMemo(() => assignable.map(u => ({
    value: String(u.id), label: u.fullName, hint: [u.jobTitle, u.department, u.status === 'IZINLI' ? 'izinli' : null].filter(Boolean).join(' · ') || undefined,
    leading: <Avatar user={u} size="xs" />,
  })), [assignable]);

  const counts = useMemo(() => ({
    OPEN: tasks.filter(t => t.status !== 'TAMAMLANDI').length,
    UNASSIGNED: tasks.filter(t => t.userId === null && t.status !== 'TAMAMLANDI').length,
    OVERDUE: tasks.filter(t => taskUrgency(t).overdue).length,
    ALL: tasks.length,
  }), [tasks]);

  const rows = useMemo(() => {
    const list = tasks.filter(t =>
      view === 'ALL' ? true
        : view === 'UNASSIGNED' ? t.userId === null && t.status !== 'TAMAMLANDI'
        : view === 'OVERDUE' ? taskUrgency(t).overdue
        : t.status !== 'TAMAMLANDI');
    const name = (t: Task) => (t.userId === null ? '' : userById.get(t.userId)?.fullName ?? '~');
    const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
      URGENCY: (a, b) => byUrgency(a, b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank,
      TITLE: (a, b) => a.content.localeCompare(b.content, 'tr'),
      // Atanmamışlar başta: atanacak işler gözden kaçmasın.
      ASSIGNEE: (a, b) => name(a).localeCompare(name(b), 'tr'),
      STATUS: (a, b) => STATUS_RANK[a.status ?? 'YAPILACAK'] - STATUS_RANK[b.status ?? 'YAPILACAK'],
      PRIORITY: (a, b) => TASK_PRIORITY[a.priority ?? 'ORTA'].rank - TASK_PRIORITY[b.priority ?? 'ORTA'].rank,
      DUE: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      ESTIMATE: (a, b) => (b.estimatedMinutes ?? 0) - (a.estimatedMinutes ?? 0),
    };
    return list.sort((a, b) => sort.dir * cmp[sort.key](a, b) || b.id - a.id);
  }, [tasks, view, sort, userById]);

  const shown = rows.slice(0, limit);
  const editable = (t: Task) => isAdmin || (t.userId !== null && t.userId === me.id);
  const toggleSort = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.every(t => selected.has(t.id));
  const assignMany = (userId: number | null) => {
    selected.forEach(id => update.mutate({ id, userId }));
    setSelected(new Set());
  };

  const rowMenu = (t: Task) => [
    { label: 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: () => onOpen(t.id) },
    !isAdmin && t.userId === null && { label: 'Üstlen', icon: HandGrabbing, onSelect: () => claim.mutate(t.id) },
    isAdmin && t.userId !== null && t.status !== 'TAMAMLANDI' && { label: 'Atamayı kaldır', icon: UserMinus, onSelect: () => update.mutate({ id: t.id, userId: null }) },
    editable(t) && t.userId !== null && 'divider' as const,
    ...(editable(t) && t.userId !== null ? TASK_STATUSES.filter(s => s !== (t.status ?? 'YAPILACAK')).map(s => ({ label: `“${TASK_STATUS[s].label}” yap`, icon: TASK_STATUS[s].icon, onSelect: () => update.mutate({ id: t.id, status: s }) })) : []),
    editable(t) && 'divider' as const,
    editable(t) && { label: 'Görevi sil', icon: Trash, tone: 'danger' as const, onSelect: () => remove.mutate(t.id) },
  ];

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Segmented<View> label="Tablo görünümü" layoutId="task-table-view" value={view} onChange={v => { setView(v); setLimit(PAGE); setSelected(new Set()); }}
          options={[
            { value: 'OPEN', label: 'Açık işler', count: counts.OPEN },
            { value: 'UNASSIGNED', label: 'Atanmamış', count: counts.UNASSIGNED },
            { value: 'OVERDUE', label: 'Geciken', count: counts.OVERDUE },
            { value: 'ALL', label: 'Tümü', count: counts.ALL },
          ]} />
        {isAdmin && (
          <button type="button" onClick={onNewUnassigned} className="btn-secondary min-h-[2.25rem] text-sm">
            <Plus size={15} weight="bold" /> Atanmamış görev ekle
          </button>
        )}
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-surface shadow-float px-3 py-2" role="region" aria-label="Toplu işlem">
          <span className="text-sm font-medium text-theme-text tabular">{selected.size} görev seçildi</span>
          <Combobox label="Seçilenleri ata" value="" onChange={v => v && assignMany(v === '__none' ? null : Number(v))} width={280} className="w-56"
            placeholder="Seçilenleri birine ata…" searchPlaceholder="Kişi ara" emptyText="Eşleşen kişi yok"
            options={[{ value: '__none', label: 'Atamayı kaldır', hint: 'Havuza geri döner' }, ...personOptions]} />
          <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost min-h-[2.25rem] text-sm"><X size={14} weight="bold" /> Seçimi temizle</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={view === 'UNASSIGNED' ? Tray : view === 'OVERDUE' ? CheckSquare : ListBullets}
            title={view === 'UNASSIGNED' ? 'Atanmamış görev yok' : view === 'OVERDUE' ? 'Geciken görev yok' : 'Görev yok'}
            description={view === 'UNASSIGNED' ? (isAdmin ? 'Birine atanmayı bekleyen işleri buraya ekleyin; sonra tek tıkla atarsınız.' : 'Üstlenebileceğiniz boşta görev şu an yok.') : 'Filtreleri değiştirmeyi deneyin.'}
            action={view === 'UNASSIGNED' && isAdmin ? <button type="button" onClick={onNewUnassigned} className="btn-primary">Atanmamış görev ekle</button> : undefined} />
        </div>
      ) : (
        <div className="card overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-theme-lightest/80 text-xs text-theme-muted border-b border-theme-light">
              <tr>
                {isAdmin && (
                  <th className="w-10 pl-4 py-2.5 text-left">
                    <input type="checkbox" aria-label="Görünen bütün görevleri seç" checked={allShownSelected} className="w-4 h-4 accent-[rgb(var(--accent))]"
                      onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map(t => t.id)))} />
                  </th>
                )}
                <Th label="Görev" k="TITLE" sort={sort} onSort={toggleSort} className="pl-4" />
                <Th label="Atanan" k="ASSIGNEE" sort={sort} onSort={toggleSort} className="w-56" />
                <Th label="Durum" k="STATUS" sort={sort} onSort={toggleSort} className="w-36" />
                <Th label="Öncelik" k="PRIORITY" sort={sort} onSort={toggleSort} className="w-24" />
                <th className="w-40 px-3 py-2.5 text-left font-medium">Proje</th>
                <Th label="Son tarih" k="DUE" sort={sort} onSort={toggleSort} className="w-32" />
                <Th label="İş gücü" k="ESTIMATE" sort={sort} onSort={toggleSort} className="w-28 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-light">
              {shown.map(t => {
                const u = taskUrgency(t);
                const owner = t.userId === null ? null : userById.get(t.userId);
                const status = t.status ?? 'YAPILACAK';
                const done = status === 'TAMAMLANDI';
                const due = t.dueDate && !done ? dueLabel(t.dueDate) : null;
                const project = t.projectId ? projectById.get(t.projectId) : undefined;
                const spent = liveSpent(t, now);
                const canEdit = editable(t);
                return (
                  <tr key={t.id} onContextMenu={e => menu(e, { label: 'Görev', items: rowMenu(t) })}
                    className={`group align-top transition-colors ${selected.has(t.id) ? 'bg-accent/[0.06]' : u.overdue ? 'bg-danger-soft/70' : u.high ? 'bg-clay-soft/50' : 'hover:bg-theme-lightest/50'}`}>
                    {isAdmin && (
                      <td className="pl-4 py-3">
                        <input type="checkbox" aria-label={`${t.content}: seç`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 accent-[rgb(var(--accent))]" />
                      </td>
                    )}
                    <td className="pl-4 pr-3 py-2.5 min-w-[18rem]">
                      <button type="button" onClick={() => onOpen(t.id)} className="text-left w-full rounded" title="Ayrıntıyı aç">
                        <UrgencyTags u={u} className="mb-1" />
                        <span className={`block font-medium leading-snug ${done ? 'text-theme-muted line-through decoration-theme-light' : 'text-theme-text'}`}>{t.content}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <LabelChips ids={t.labelIds} />
                          <TaskBadges task={t} />
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin && !done ? (
                        <Combobox bare label="Atanan kişi" value={t.userId === null ? '' : String(t.userId)} width={300} className="w-full"
                          onChange={v => v !== (t.userId === null ? '' : String(t.userId)) && update.mutate({ id: t.id, userId: v ? Number(v) : null })}
                          placeholder="Atanmamış" searchPlaceholder="Kişi ara" emptyText="Eşleşen kişi yok"
                          options={[{ value: '', label: 'Atanmamış', hint: 'Görev havuzda bekler' }, ...personOptions]} />
                      ) : owner ? (
                        <span className="flex items-center gap-2 px-2 py-1"><Avatar user={owner} size="xs" /><span className="truncate">{owner.fullName}</span></span>
                      ) : t.userId === null ? (
                        <span className="flex items-center gap-2 px-2 py-1">
                          <span className="text-xs font-medium text-warn-ink bg-warn-soft border border-warn-line rounded-md px-1.5 py-px">Atanmamış</span>
                          {!isAdmin && !done && (
                            <button type="button" onClick={() => claim.mutate(t.id)} disabled={claim.isPending} className="text-xs font-medium text-theme-deep hover:underline underline-offset-4">Üstlen</button>
                          )}
                        </span>
                      ) : <span className="px-2 text-theme-muted">Pasif kullanıcı</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusCell status={status} disabled={!canEdit || t.userId === null} waiting={(t.openBlockerIds?.length ?? 0) > 0}
                        onChange={s => update.mutate({ id: t.id, status: s })} />
                    </td>
                    <td className="px-3 py-3"><span className={`text-xs font-medium ${t.priority === 'YUKSEK' ? 'text-clay-ink' : 'text-theme-muted'}`}>{TASK_PRIORITY[t.priority ?? 'ORTA'].label}</span></td>
                    <td className="px-3 py-3">
                      {project ? (
                        <span className="flex items-center gap-1.5 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor(project.name) }} aria-hidden="true" /><span className="truncate text-xs">{project.name}</span></span>
                      ) : <span className="text-xs text-theme-muted">Projesiz</span>}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {done && t.completedAt ? <span className="text-theme-muted">Bitti {formatDate(parseServerDate(t.completedAt).toISOString().slice(0, 10))}</span>
                        : due ? <span className={due.tone === 'danger' ? 'text-danger font-medium' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}>{due.text}</span>
                        : <span className="text-theme-muted">-</span>}
                    </td>
                    <td className="pl-3 pr-4 py-3 text-xs"><EffortChip spent={spent} estimate={t.estimatedMinutes} ticking={!!t.ticking} tone={effortTone(spent, t.estimatedMinutes)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="border-t border-theme-light p-2 text-center">
              <button type="button" onClick={() => setLimit(l => l + PAGE)} className="btn-ghost text-sm">{Math.min(PAGE, rows.length - limit)} görev daha göster ({rows.length - limit} kaldı)</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ label, k, sort, onSort, className = '' }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={`px-3 py-2.5 text-left font-medium ${className}`} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 rounded hover:text-theme-text ${active ? 'text-theme-text' : ''}`}>
        {label}
        {active && (sort.dir === 1 ? <CaretUp size={11} weight="bold" aria-hidden="true" /> : <CaretDown size={11} weight="bold" aria-hidden="true" />)}
      </button>
    </th>
  );
}

/** Durum hücresi: düzenlenebilirse küçük seçici, değilse ikon + ad. Bekleyen (bağımlı) görev için uyarı ikonu. */
function StatusCell({ status, disabled, waiting, onChange }: { status: TaskStatus; disabled: boolean; waiting: boolean; onChange: (s: TaskStatus) => void }) {
  const meta = TASK_STATUS[status];
  if (disabled) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 text-xs">
        <meta.icon size={14} weight="bold" className={meta.className} aria-hidden="true" /> {meta.label}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Combobox bare label="Durum" value={status} onChange={v => v !== status && onChange(v as TaskStatus)} width={200}
        searchPlaceholder="Durum" options={TASK_STATUSES.map(s => {
          const m = TASK_STATUS[s];
          return { value: s, label: m.label, leading: <m.icon size={14} weight="bold" className={m.className} /> };
        })} />
      {waiting && status !== 'TAMAMLANDI' && <Warning size={14} weight="bold" className="text-warn-ink shrink-0" aria-label="Önce bitmesi gereken görevler var" />}
    </span>
  );
}
