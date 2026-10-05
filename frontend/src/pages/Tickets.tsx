import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, MagnifyingGlass, Headset, ChatCircle, Paperclip, ArrowSquareOut, HandGrabbing, CheckCircle, Timer, UserCircle, PaperPlaneTilt } from '@phosphor-icons/react';
import { useMe, useUsers } from '../hooks/api';
import { useTickets, useUpdateTicket, type Ticket, type TicketPriority } from '../hooks/tickets';
import { Avatar, EmptyState, PageHeader, Segmented, Skeleton, StatCard } from '../components/ui/primitives';
import Combobox from '../components/ui/Combobox';
import TicketDrawer from '../components/tickets/TicketDrawer';
import TicketFormModal from '../components/tickets/TicketFormModal';
import { useContextMenu, usePageMenu } from '../components/layout/ContextMenu';
import { TICKET_PRIORITY, TICKET_PRIORITIES, TICKET_STATUS, TICKET_TYPE, isOpenTicket, slaText } from '../lib/tickets';
import { timeAgo, trLower } from '../lib/format';
import { usePersisted } from '../lib/groups';
import { useNow } from '../lib/effort';

type View = 'OPEN' | 'MINE' | 'SENT' | 'UNASSIGNED' | 'OVERDUE' | 'DONE' | 'ALL';

/**
 * Şirket içi talepler: çalışan arıza, erişim, ekipman gibi ihtiyaçlarını yönetime iletir. Yönetici hepsini görür ve atar;
 * çalışan yalnızca kendi açtıklarını ve kendisine atananları görür (sunucu da yalnızca bunları verir).
 * Talepler aciliyete göre sıralanır: hedefi geçenler, sonra öncelik, sonra kalan süre. Satıra tıklayınca ayrıntı paneli açılır.
 */
export default function Tickets() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const now = useNow(60_000);
  const { data: tickets, isLoading } = useTickets();
  const { data: users } = useUsers();
  const update = useUpdateTicket();
  const menu = useContextMenu();
  const [params, setParams] = useSearchParams();
  const [view, setView] = usePersisted<View>('devhub.tickets.view', 'OPEN');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'' | TicketPriority>('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Üst menüdeki "Yeni > Destek talebi": /tickets?yeni=1
  const wantsNew = params.has('yeni');
  useEffect(() => {
    if (!wantsNew) return;
    setCreating(true);
    setParams(p => { p.delete('yeni'); return p; }, { replace: true });
  }, [wantsNew, setParams]);

  // Bildirim bağlantısı: /tickets?talep=ID
  const linked = params.get('talep');
  useEffect(() => {
    if (!linked) return;
    const id = Number(linked);
    if (Number.isInteger(id) && id > 0) setOpenId(id);
    setParams(p => { p.delete('talep'); return p; }, { replace: true });
  }, [linked, setParams]);

  usePageMenu([{ label: 'Yeni talep', icon: Plus, onSelect: () => setCreating(true) }]);

  const all = useMemo(() => tickets ?? [], [tickets]);
  const counts = useMemo(() => ({
    OPEN: all.filter(isOpenTicket).length,
    MINE: all.filter(t => isOpenTicket(t) && t.assigneeId === me.id).length,
    SENT: all.filter(t => isOpenTicket(t) && t.requesterId === me.id).length,
    UNASSIGNED: all.filter(t => isOpenTicket(t) && t.assigneeId === null).length,
    OVERDUE: all.filter(t => t.overdue).length,
    DONE: all.filter(t => !isOpenTicket(t)).length,
    ALL: all.length,
  }), [all, me.id]);

  const rows = useMemo(() => {
    const q = trLower(search.trim());
    return all.filter(t =>
      (view === 'ALL' || (view === 'OPEN' && isOpenTicket(t)) || (view === 'MINE' && isOpenTicket(t) && t.assigneeId === me.id) || (view === 'SENT' && isOpenTicket(t) && t.requesterId === me.id)
        || (view === 'UNASSIGNED' && isOpenTicket(t) && t.assigneeId === null) || (view === 'OVERDUE' && t.overdue) || (view === 'DONE' && !isOpenTicket(t))) &&
      (!priority || t.priority === priority) &&
      (!q || trLower(`${t.number} ${t.title} ${t.requesterName ?? ''} ${t.description ?? ''} ${t.assigneeName ?? ''}`).includes(q)),
    ).sort((a, b) => {
      if (view === 'DONE') return (b.resolvedAt ?? b.updatedAt).localeCompare(a.resolvedAt ?? a.updatedAt);
      return Number(b.overdue) - Number(a.overdue) || TICKET_PRIORITY[a.priority].rank - TICKET_PRIORITY[b.priority].rank
        || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
    });
  }, [all, view, priority, search, me.id]);

  const userById = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users]);
  const rowMenu = (t: Ticket) => [
    { label: 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: () => setOpenId(t.id) },
    isAdmin && t.assigneeId === null && { label: 'Üstlen', icon: HandGrabbing, onSelect: () => update.mutate({ id: t.id, assigneeId: me.id }) },
    isOpenTicket(t) && { label: 'Çözüldü olarak işaretle', icon: CheckCircle, onSelect: () => update.mutate({ id: t.id, status: 'COZULDU' }) },
  ];

  return (
    <div className="pb-10">
      <PageHeader title="Destek talepleri"
        description={isAdmin
          ? 'Çalışanların arıza, erişim ve ekipman talepleri. Atayın, takip edin; çözüm hedefi önceliğe göre mesai saatiyle hesaplanır.'
          : 'Arıza, erişim, ekipman gibi ihtiyaçlarınızı yönetime iletin. Burada yalnızca açtığınız ve size atanan talepler görünür.'}
        actions={<button type="button" onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} weight="bold" /> Yeni talep</button>} />

      {isAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Açık talep" value={counts.OPEN} icon={Headset} onClick={() => setView('OPEN')} active={view === 'OPEN'} />
          <StatCard label="Atanmamış" value={counts.UNASSIGNED} icon={HandGrabbing} onClick={() => setView('UNASSIGNED')} active={view === 'UNASSIGNED'}
            hint={counts.UNASSIGNED ? 'Birine atanmayı bekliyor' : undefined} />
          <StatCard label="Hedefi geçen" value={<span className={counts.OVERDUE ? 'text-danger' : ''}>{counts.OVERDUE}</span>} icon={Timer} onClick={() => setView('OVERDUE')} active={view === 'OVERDUE'} />
          <StatCard label="Bana atanan" value={counts.MINE} icon={UserCircle} onClick={() => setView('MINE')} active={view === 'MINE'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <StatCard label="Açık taleplerim" value={counts.SENT} icon={PaperPlaneTilt} onClick={() => setView('SENT')} active={view === 'SENT'} hint={counts.SENT ? 'Yönetimde ya da çözülüyor' : undefined} />
          <StatCard label="Bana atanan" value={counts.MINE} icon={UserCircle} onClick={() => setView('MINE')} active={view === 'MINE'} hint={counts.MINE ? 'Sizin çözmeniz bekleniyor' : undefined} />
          <StatCard label="Çözülen" value={counts.DONE} icon={CheckCircle} onClick={() => setView('DONE')} active={view === 'DONE'} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented<View> label="Talep görünümü" layoutId="ticket-view" value={view} onChange={setView}
          options={isAdmin
            ? [{ value: 'OPEN', label: 'Açık', count: counts.OPEN }, { value: 'MINE', label: 'Bende', count: counts.MINE }, { value: 'UNASSIGNED', label: 'Atanmamış', count: counts.UNASSIGNED },
              { value: 'OVERDUE', label: 'Geciken', count: counts.OVERDUE }, { value: 'DONE', label: 'Çözülen', count: counts.DONE }, { value: 'ALL', label: 'Tümü' }]
            : [{ value: 'OPEN', label: 'Açık', count: counts.OPEN }, { value: 'SENT', label: 'Açtıklarım', count: counts.SENT }, { value: 'MINE', label: 'Bana atanan', count: counts.MINE },
              { value: 'DONE', label: 'Çözülen', count: counts.DONE }, { value: 'ALL', label: 'Tümü' }]} />
        <div className="relative flex-1 basis-56 min-w-[14rem]">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={isAdmin ? 'Numara, konu, kişi ara' : 'Numara ya da konu ara'} aria-label="Taleplerde ara" className="input-sm pl-9" />
        </div>
        <Combobox label="Önceliğe göre" value={priority} onChange={v => setPriority(v as '' | TicketPriority)} width={220} className="w-full sm:w-40" placeholder="Tüm öncelikler" searchPlaceholder="Öncelik"
          options={[{ value: '', label: 'Tüm öncelikler' }, ...TICKET_PRIORITIES.map(p => ({ value: p, label: TICKET_PRIORITY[p].label }))]} />
      </div>

      {isLoading ? (
        <div className="card divide-y divide-theme-light">{[0, 1, 2, 3].map(i => <div key={i} className="p-4"><Skeleton className="h-12" /></div>)}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Headset} title={all.length ? 'Bu görünümde talep yok' : 'Henüz talep yok'}
          description={all.length ? 'Başka bir görünüm seçin ya da filtreleri temizleyin.' : 'Bilgisayarınız mı bozuldu, bir erişime mi ihtiyacınız var? Talep açın, yönetim ilgilensin.'}
          action={!all.length ? <button type="button" onClick={() => setCreating(true)} className="btn-primary">Yeni talep</button> : undefined} /></div>
      ) : (
        <ul className="card divide-y divide-theme-light">
          {rows.map(t => {
            const sla = slaText(t, now);
            const st = TICKET_STATUS[t.status];
            const TypeIcon = TICKET_TYPE[t.type].icon;
            const assignee = t.assigneeId ? userById.get(t.assigneeId) : undefined;
            return (
              <li key={t.id} onContextMenu={e => menu(e, { label: t.number, items: rowMenu(t) })}>
                <button type="button" onClick={() => setOpenId(t.id)}
                  className={`w-full text-left flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors ${t.overdue ? 'bg-danger-soft/50 hover:bg-danger-soft/80' : 'hover:bg-theme-lightest/50'}`}>
                  <span className={`w-16 shrink-0 text-center text-xs font-medium px-1.5 py-0.5 rounded-md border ${TICKET_PRIORITY[t.priority].cls}`}>{TICKET_PRIORITY[t.priority].label}</span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-medium text-theme-text"><span className="font-mono text-xs text-theme-muted mr-2">{t.number}</span>{t.title}</p>
                    <p className="text-xs text-theme-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><TypeIcon size={12} aria-hidden="true" /> {TICKET_TYPE[t.type].label}</span>
                      {t.requesterId !== me.id && t.requesterName && <span className="font-medium text-theme-text/80">{t.requesterName}</span>}
                      <span>{timeAgo(t.createdAt)} açıldı</span>
                      {t.commentCount > 0 && <span className="inline-flex items-center gap-0.5"><ChatCircle size={12} aria-hidden="true" /> {t.commentCount}</span>}
                      {t.attachmentCount > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={12} aria-hidden="true" /> {t.attachmentCount}</span>}
                    </p>
                  </div>
                  <span className="w-40 flex items-center gap-2 min-w-0">
                    {assignee ? <><Avatar user={assignee} size="xs" /><span className="text-xs truncate">{assignee.fullName}</span></>
                      : <span className="text-xs font-medium text-warn-ink bg-warn-soft border border-warn-line rounded-md px-1.5 py-px">{isAdmin ? 'Atanmamış' : 'Yönetimde'}</span>}
                  </span>
                  <span className={`w-40 text-xs ${sla.tone === 'danger' ? 'text-danger font-medium' : sla.tone === 'warn' ? 'text-warn-ink font-medium' : sla.tone === 'good' ? 'text-good-ink' : 'text-theme-muted'}`}>{sla.text}</span>
                  <span className="w-36 inline-flex items-center gap-1.5 text-xs"><st.icon size={14} weight="bold" className={st.cls} aria-hidden="true" /> {st.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TicketDrawer ticketId={openId} onClose={() => setOpenId(null)} />
      <TicketFormModal open={creating} onClose={() => setCreating(false)} onCreated={id => setOpenId(id)} />
    </div>
  );
}
