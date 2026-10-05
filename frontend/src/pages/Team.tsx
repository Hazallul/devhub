import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MagnifyingGlass, Users, UserPlus, X } from '@phosphor-icons/react';
import Combobox from '../components/ui/Combobox';
import GroupHeader from '../components/ui/GroupHeader';
import { departmentsOf, groupItems, groupKeyOf, NO_DEPARTMENT, useCollapsedGroups, usePersisted } from '../lib/groups';
import EmployeeCard from '../components/team/EmployeeCard';
import { PageHeader, Segmented, Skeleton, EmptyState } from '../components/ui/primitives';
import { useUsers, useAllTasks, useProjects, useMe } from '../hooks/api';
import { useQuickActions } from '../components/layout/QuickActions';
import { ALL_STATUSES, USER_STATUS } from '../lib/meta';
import { trLower } from '../lib/format';
import { listContainer, listItem } from '../lib/motion';
import { scrollIntoCenter, wait } from '../lib/scroll';
import type { UserStatus } from '../types';

type StatusFilter = 'ALL' | UserStatus;
type Sort = 'name' | 'status' | 'tasks';

const STATUS_ORDER: Record<UserStatus, number> = { AKTIF: 0, TOPLANTIDA: 1, UZAKTAN: 2, IZINLI: 3 };

export default function Team() {
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const actions = useQuickActions();
  const { data: users, isLoading } = useUsers();
  const { data: tasks } = useAllTasks();
  const { data: projects } = useProjects();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [project, setProject] = useState('');
  const [department, setDepartment] = useState('');
  const [groupBy, setGroupBy] = usePersisted<'NONE' | 'DEPARTMENT'>('devhub.team.group', 'NONE');
  const groups = useCollapsedGroups('devhub.team.closed');
  const departments = useMemo(() => departmentsOf(users), [users]);
  const [sort, setSort] = useState<Sort>('status');
  // focusId: kaydırılacak kişi; pulseId: kaydırma bittikten sonra vurgulanan kart.
  const [focusId, setFocusId] = useState<number | null>(location.state?.highlightUserId ?? null);
  const [pulseId, setPulseId] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    // Çıkış animasyonundaki sayfa yeni adresin durumunu görür; yalnızca /team'e gelen durum burada tüketilir.
    if (location.pathname !== '/team') return;
    const id = location.state?.highlightUserId as number | undefined;
    if (!id) return;
    setFocusId(id);
    // Filtreler kişiyi gizlemesin.
    setSearch(''); setStatus('ALL'); setProject(''); setDepartment('');
    // state'i temizle: geri gelindiğinde tekrar parlamasın.
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  // Sayfa ve liste giriş animasyonları oturduktan sonra kişiye kaydır; kart ancak kaydırma bitince vurgulanır.
  useEffect(() => {
    if (isLoading || !users || !focusId) return;
    let cancelled = false;
    (async () => {
      await wait(450);
      const el = cardRefs.current[focusId];
      const container = document.getElementById('main-scroll-container');
      if (cancelled || !el || !container) return;
      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await scrollIntoCenter(container, el, instant);
      if (cancelled) return;
      setFocusId(null);
      setPulseId(focusId);
    })();
    return () => { cancelled = true; };
  }, [isLoading, users, focusId]);

  useEffect(() => {
    if (!pulseId) return;
    const t = setTimeout(() => setPulseId(null), 1400);
    return () => clearTimeout(t);
  }, [pulseId]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { ALL: users?.length ?? 0, AKTIF: 0, TOPLANTIDA: 0, UZAKTAN: 0, IZINLI: 0 };
    users?.forEach(u => { if (u.status) c[u.status] += 1; });
    return c;
  }, [users]);

  const openTaskCount = useMemo(() => {
    const m = new Map<number, number>();
    tasks?.forEach(t => { if (t.status !== 'TAMAMLANDI' && t.userId !== null) m.set(t.userId, (m.get(t.userId) ?? 0) + 1); });
    return m;
  }, [tasks]);

  const visible = useMemo(() => {
    const q = trLower(search.trim());
    const list = (users ?? []).filter(u =>
      (!q || trLower(`${u.fullName} ${u.jobTitle ?? ''} ${u.department ?? ''} ${u.currentProject ?? ''}`).includes(q)) &&
      (!department || (department === NO_DEPARTMENT ? !u.department : u.department === department)) &&
      (status === 'ALL' || u.status === status) &&
      (!project || (project === '__none' ? !u.currentProject : u.currentProject === project)),
    );
    return list.sort((a, b) => {
      if (a.id === me.id) return -1;
      if (b.id === me.id) return 1;
      if (sort === 'status') return (STATUS_ORDER[a.status ?? 'IZINLI'] - STATUS_ORDER[b.status ?? 'IZINLI']) || a.fullName.localeCompare(b.fullName, 'tr');
      if (sort === 'tasks') return (openTaskCount.get(b.id) ?? 0) - (openTaskCount.get(a.id) ?? 0);
      return a.fullName.localeCompare(b.fullName, 'tr');
    });
  }, [users, search, status, project, department, sort, me.id, openTaskCount]);

  const hasFilters = !!search || status !== 'ALL' || !!project || !!department;
  const clearFilters = () => { setSearch(''); setStatus('ALL'); setProject(''); setDepartment(''); };
  // Bir kişiye kaydırılırken kapalı grupta kalmasın diye gruplama yalnızca odak yokken uygulanır.
  const grouped = groupBy === 'DEPARTMENT' && departments.length > 0 && !focusId;

  return (
    <>
      <PageHeader
        eyebrow="Çalışanlar"
        title="Çalışanlar"
        description="Şirketteki tüm çalışanlar: durumları, projeleri ve görevleri. Proje ekipleri Projeler sayfasındadır. Karta tıklayın; sağ tıkla işlemler açılır."
        actions={me.role === 'ADMIN' ? (
          <button onClick={() => actions.newTask()} className="btn-primary"><UserPlus size={18} weight="bold" /> Görev ata</button>
        ) : undefined}
      />

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<StatusFilter>
          label="Durum filtresi"
          layoutId="team-status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Tümü', count: counts.ALL },
            ...ALL_STATUSES.map(s => ({ value: s, label: USER_STATUS[s].label, count: counts[s] })),
          ]}
        />
        {departments.length > 0 && (
          <Segmented<'NONE' | 'DEPARTMENT'> label="Gruplama" layoutId="team-group" value={groupBy} onChange={setGroupBy}
            options={[{ value: 'NONE', label: 'Liste' }, { value: 'DEPARTMENT', label: 'Departmanlara göre' }]} />
        )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Ekipte ara"
              placeholder="İsim, unvan veya proje ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-11 shadow-soft"
            />
          </div>
          {departments.length > 0 && (
            <Combobox label="Departmana göre filtrele" value={department} onChange={setDepartment} width={240} className="sm:w-52"
              placeholder="Tüm departmanlar" searchPlaceholder="Departman ara" emptyText="Eşleşen departman yok"
              options={[{ value: '', label: 'Tüm departmanlar' }, ...departments.map(d => ({ value: d, label: d })), { value: NO_DEPARTMENT, label: NO_DEPARTMENT }]} />
          )}
          <Combobox label="Projeye göre filtrele" value={project} onChange={setProject} width={260} className="sm:w-52"
            placeholder="Tüm projeler" searchPlaceholder="Proje ara" emptyText="Eşleşen proje yok"
            options={[{ value: '', label: 'Tüm projeler' }, { value: '__none', label: 'Boşta olanlar' }, ...(projects ?? []).map(p => ({ value: p.name, label: p.name }))]} />
          <Combobox label="Sırala" value={sort} onChange={v => setSort(v as Sort)} width={220} className="sm:w-48"
            placeholder="Duruma göre" searchPlaceholder="Sıralama"
            options={[{ value: 'status', label: 'Duruma göre' }, { value: 'name', label: 'İsme göre (A–Z)' }, { value: 'tasks', label: 'Açık görev sayısı' }]} />
        </div>

        {hasFilters && (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-theme-muted tabular">{visible.length} kişi gösteriliyor</span>
            <button onClick={clearFilters} className="inline-flex items-center gap-1 font-bold text-theme-deep hover:underline underline-offset-4">
              <X size={14} weight="bold" /> Filtreleri temizle
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[5.5rem] rounded-3xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sonuç bulunamadı"
          description="Arama kriterlerinize uyan bir ekip üyesi yok."
          action={<button onClick={clearFilters} className="btn-secondary">Filtreleri temizle</button>}
        />
      ) : (
        grouped ? (
          <div className="card mb-10">
            {groupItems(visible, u => groupKeyOf(u, 'DEPARTMENT')).map(g => {
              const open = !groups.isClosed(g.key);
              const away = g.items.filter(u => u.status === 'IZINLI').length;
              const openTasks = g.items.reduce((s, u) => s + (openTaskCount.get(u.id) ?? 0), 0);
              return (
                <section key={g.key} aria-label={g.key} className="border-b border-theme-light last:border-b-0">
                  <GroupHeader title={g.key} count={g.items.length} open={open} onToggle={() => groups.toggle(g.key)}
                    summary={<>{away > 0 && <span>{away} izinli</span>}<span>{openTasks} açık görev</span></>} />
                  {open && (
                    <div className="divide-y divide-theme-light">
                      {g.items.map(user => (
                        <div key={user.id} ref={el => { cardRefs.current[user.id] = el; }} className="relative">
                          <EmployeeCard user={user} tasks={tasks} isHighlighted={pulseId === user.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="card overflow-hidden divide-y divide-theme-light mb-10">
          {visible.map(user => (
            <motion.div
              key={user.id}
              layout="position"
              variants={listItem}
              ref={el => { cardRefs.current[user.id] = el; }}
              transition={{ layout: { type: 'spring', stiffness: 300, damping: 32 } }}
              className="relative"
            >
              <EmployeeCard user={user} tasks={tasks} isHighlighted={pulseId === user.id} />
            </motion.div>
          ))}
        </motion.div>
        )
      )}
    </>
  );
}
