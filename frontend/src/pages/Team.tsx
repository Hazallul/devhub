import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MagnifyingGlass, Funnel, Users, UserPlus, ArrowsDownUp, X } from '@phosphor-icons/react';
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
    setSearch(''); setStatus('ALL'); setProject('');
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
    tasks?.forEach(t => { if (t.status !== 'TAMAMLANDI') m.set(t.userId, (m.get(t.userId) ?? 0) + 1); });
    return m;
  }, [tasks]);

  const visible = useMemo(() => {
    const q = trLower(search.trim());
    const list = (users ?? []).filter(u =>
      (!q || trLower(`${u.fullName} ${u.jobTitle ?? ''} ${u.currentProject ?? ''}`).includes(q)) &&
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
  }, [users, search, status, project, sort, me.id, openTaskCount]);

  const hasFilters = !!search || status !== 'ALL' || !!project;

  return (
    <>
      <PageHeader
        eyebrow="Çalışanlar"
        title="Çalışanlar"
        description="Şirketteki tüm çalışanlar: durumları, projeleri ve görevleri. Proje ekipleri Projeler sayfasındadır. Karta tıklayın; sağ tıkla işlemler açılır."
        actions={me.role === 'ADMIN' ? (
          <button onClick={() => actions.newTask()} className="btn-primary"><UserPlus size={18} weight="bold" /> Görev Ata</button>
        ) : undefined}
      />

      <div className="flex flex-col gap-4 mb-6">
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
          <div className="relative sm:w-56">
            <Funnel className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" size={18} aria-hidden="true" />
            <select aria-label="Projeye göre filtrele" value={project} onChange={e => setProject(e.target.value)} className="input pl-11 appearance-none shadow-soft">
              <option value="">Tüm projeler</option>
              <option value="__none">Boşta olanlar</option>
              {projects?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="relative sm:w-52">
            <ArrowsDownUp className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" size={18} aria-hidden="true" />
            <select aria-label="Sırala" value={sort} onChange={e => setSort(e.target.value as Sort)} className="input pl-11 appearance-none shadow-soft">
              <option value="status">Duruma göre</option>
              <option value="name">İsme göre (A–Z)</option>
              <option value="tasks">Açık görev sayısı</option>
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-theme-muted tabular">{visible.length} kişi gösteriliyor</span>
            <button onClick={() => { setSearch(''); setStatus('ALL'); setProject(''); }} className="inline-flex items-center gap-1 font-bold text-theme-deep hover:underline underline-offset-4">
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
          action={<button onClick={() => { setSearch(''); setStatus('ALL'); setProject(''); }} className="btn-secondary">Filtreleri temizle</button>}
        />
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-3 pb-10">
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
      )}
    </>
  );
}
