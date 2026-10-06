import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Trash, Flag, UserCircle, Briefcase, Timer, ListChecks, PaperPlaneRight, ChatCircleText, ArrowSquareOut, PencilSimple, ArrowUUpLeft,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import Combobox from '../ui/Combobox';
import { Avatar, Skeleton } from '../ui/primitives';
import { useQuickActions } from '../layout/QuickActions';
import { AttachmentPanel } from '../tasks/TaskExtras';
import { useMe, useProjects, useUsers } from '../../hooks/api';
import {
  useDeleteTicket, useDeleteTicketComment, useTicketActivity, useTicketComment, useTicketTask, useTickets, useUpdateTicket, type Ticket, type TicketStatus,
} from '../../hooks/tickets';
import { TICKET_PRIORITY, TICKET_PRIORITIES, TICKET_STATUS, TICKET_STATUSES, TICKET_TYPE, TICKET_TYPES, slaText } from '../../lib/tickets';
import { TASK_STATUS } from '../../lib/meta';
import { parseServerDate, timeAgo } from '../../lib/format';
import { parseHours } from '../../lib/effort';
import type { TaskStatus } from '../../types';

/** Sağdan kayan talep ayrıntısı (görev çekmecesiyle aynı düzen). */
export default function TicketDrawer({ ticketId, onClose }: { ticketId: number | null; onClose: () => void }) {
  const { data: tickets, isLoading } = useTickets();
  const ticket = ticketId !== null ? tickets?.find(t => t.id === ticketId) : undefined;

  useEffect(() => {
    if (ticketId === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ticketId, onClose]);

  return createPortal(
    <AnimatePresence>
      {ticketId !== null && (
        <div className="fixed inset-0 z-[115]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} onClick={onClose} className="absolute inset-0 bg-ink/30" />
          <motion.aside role="dialog" aria-modal="true" aria-label={ticket ? `Talep ${ticket.number}` : 'Talep ayrıntısı'}
            initial={{ x: '100%' }} animate={{ x: 0, transition: { type: 'spring', stiffness: 300, damping: 34 } }} exit={{ x: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            className="absolute inset-y-0 right-0 w-full max-w-xl bg-surface shadow-float border-l border-theme-light flex flex-col overflow-hidden">
            {ticket ? <Body key={ticket.id} t={ticket} onClose={onClose} /> : (
              <div className="p-8 space-y-4">
                <div className="flex justify-end"><button onClick={onClose} className="icon-btn w-8 h-8" aria-label="Kapat"><X size={18} weight="bold" /></button></div>
                {isLoading ? <><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /></> : <p className="text-sm text-theme-muted text-center py-10">Bu talep bulunamadı; silinmiş olabilir.</p>}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Body({ t, onClose }: { t: Ticket; onClose: () => void }) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const update = useUpdateTicket();
  const remove = useDeleteTicket();
  const { openTask } = useQuickActions();
  const involved = t.assigneeId === me.id || t.requesterId === me.id;
  // Talebi görebilen herkes (yönetici, açan, atanan) düzenleyebilir; atamayı yalnızca yönetici yapar.
  const canEdit = isAdmin || involved;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(t.title);
  const sla = slaText(t);
  const TypeIcon = TICKET_TYPE[t.type].icon;
  const patch = (body: Omit<Parameters<typeof update.mutate>[0], 'id'>) => update.mutate({ id: t.id, ...body });

  const assigneeOptions = [{ value: '', label: 'Atanmamış', hint: 'Yönetimde bekler' },
    ...(users ?? []).filter(u => u.active || u.id === t.assigneeId).map(u => ({ value: String(u.id), label: u.fullName, hint: u.status === 'IZINLI' ? 'Bugün izinli' : u.jobTitle ?? undefined, leading: <Avatar user={u} size="xs" /> }))];

  return (
    <>
      <div className="px-6 pt-5 pb-5 border-b border-theme-light">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-theme-muted">{t.number}</span>
          <span className={`text-xs font-medium px-1.5 py-px rounded-md border ${TICKET_PRIORITY[t.priority].cls}`}>{TICKET_PRIORITY[t.priority].label}</span>
          <span className="text-xs text-theme-muted inline-flex items-center gap-1"><TypeIcon size={13} aria-hidden="true" /> {TICKET_TYPE[t.type].label}</span>
          <div className="ml-auto flex gap-1">
            {isAdmin && (confirmDelete
              ? <button onClick={() => remove.mutate(t.id, { onSuccess: onClose })} className="h-9 px-3 rounded-xl text-xs font-bold bg-danger-soft text-danger">Silinsin mi?</button>
              : <button onClick={() => setConfirmDelete(true)} className="icon-btn hover:text-danger" aria-label="Talebi sil" title="Talebi sil"><Trash size={17} /></button>)}
            <button onClick={onClose} className="icon-btn w-8 h-8" aria-label="Kapat"><X size={18} weight="bold" /></button>
          </div>
        </div>
        {editingTitle ? (
          <textarea value={title} autoFocus rows={2} aria-label="Konu" onChange={e => setTitle(e.target.value)}
            onBlur={() => { setEditingTitle(false); if (title.trim().length >= 3 && title.trim() !== t.title) patch({ title: title.trim() }); else setTitle(t.title); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Escape') { e.stopPropagation(); setTitle(t.title); setEditingTitle(false); } }}
            className="input mt-3 text-lg font-semibold resize-none" />
        ) : (
          <div className="group flex items-start gap-2 mt-3">
            <h2 className="text-lg font-semibold tracking-tight leading-snug break-words flex-1 text-theme-text">{t.title}</h2>
            {canEdit && <button onClick={() => setEditingTitle(true)} className="icon-btn w-8 h-8 opacity-60 group-hover:opacity-100" aria-label="Konuyu düzenle"><PencilSimple size={15} /></button>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canEdit ? (
            <Combobox label="Durum" value={t.status} onChange={v => v !== t.status && patch({ status: v as TicketStatus })} width={240} className="w-56" searchPlaceholder="Durum"
              options={TICKET_STATUSES.map(s => { const m = TICKET_STATUS[s]; return { value: s, label: m.label, leading: <m.icon size={14} weight="bold" className={m.cls} /> }; })} />
          ) : <span className="text-sm font-medium">{TICKET_STATUS[t.status].label}</span>}
          <span className={`text-xs font-medium ${sla.tone === 'danger' ? 'text-danger' : sla.tone === 'warn' ? 'text-warn-ink' : sla.tone === 'good' ? 'text-good-ink' : 'text-theme-muted'}`}
            title={t.dueAt ? `Çözüm hedefi: ${parseServerDate(t.dueAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : undefined}>
            <Timer size={13} weight="bold" className="inline -mt-0.5 mr-1" aria-hidden="true" />{sla.text}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 sm:p-8 space-y-8">
          <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
            <Prop icon={PaperPlaneRight} label="Talep eden">
              {t.requesterName ?? 'Bilinmiyor'}<span className="block text-xs text-theme-muted font-normal">{timeAgo(t.createdAt)}</span>
            </Prop>
            <Prop icon={UserCircle} label="Atanan">
              {isAdmin ? <Combobox bare label="Atanan" value={t.assigneeId === null ? '' : String(t.assigneeId)} onChange={v => patch({ assigneeId: v ? Number(v) : null })}
                width={300} className="w-full -ml-2" placeholder="Atanmamış" searchPlaceholder="Kişi ara" options={assigneeOptions} />
                : (
                  <span className="flex items-center gap-2">
                    {t.assigneeName ?? <span className="text-theme-muted font-normal">Yönetici atayacak</span>}
                    {t.assigneeId === me.id && (
                      <button type="button" onClick={() => update.mutate({ id: t.id, assigneeId: null }, { onSuccess: () => { if (t.requesterId !== me.id) onClose(); } })} className="text-xs font-medium text-theme-deep hover:underline underline-offset-4 inline-flex items-center gap-0.5" title="Talep yönetime geri döner">
                        <ArrowUUpLeft size={12} weight="bold" aria-hidden="true" /> Bırak
                      </button>
                    )}
                  </span>
                )}
            </Prop>
            <Prop icon={Flag} label="Öncelik">
              {canEdit ? <Combobox bare label="Öncelik" value={t.priority} onChange={v => v !== t.priority && patch({ priority: v as Ticket['priority'] })} width={240} className="w-full -ml-2"
                searchPlaceholder="Öncelik" options={TICKET_PRIORITIES.map(p => ({ value: p, label: TICKET_PRIORITY[p].label, hint: `Hedef ${TICKET_PRIORITY[p].sla}` }))} />
                : TICKET_PRIORITY[t.priority].label}
            </Prop>
            <Prop icon={ListChecks} label="Tür">
              {canEdit ? <Combobox bare label="Tür" value={t.type} onChange={v => v !== t.type && patch({ type: v as Ticket['type'] })} width={260} className="w-full -ml-2" searchPlaceholder="Tür"
                options={TICKET_TYPES.map(x => { const m = TICKET_TYPE[x]; return { value: x, label: m.label, leading: <m.icon size={14} weight="bold" /> }; })} />
                : TICKET_TYPE[t.type].label}
            </Prop>
            <Prop icon={Briefcase} label="İlgili proje">
              {canEdit ? <Combobox bare label="Proje" value={t.projectId === null ? '' : String(t.projectId)} onChange={v => patch({ projectId: v ? Number(v) : null })}
                width={280} className="w-full -ml-2" placeholder="Projesiz" searchPlaceholder="Proje ara" options={[{ value: '', label: 'Projesiz' }, ...(projects ?? []).map(p => ({ value: String(p.id), label: p.name }))]} />
                : projects?.find(p => p.id === t.projectId)?.name ?? 'Projesiz'}
            </Prop>
            <Prop icon={Timer} label="Çözüm hedefi">
              {t.dueAt ? parseServerDate(t.dueAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
              <span className="block text-xs text-theme-muted font-normal">{TICKET_PRIORITY[t.priority].sla} (mesai)</span>
            </Prop>
          </dl>

          <Description t={t} canEdit={canEdit} />
          <LinkedTask t={t} canEdit={isAdmin || t.assigneeId === me.id} onOpenTask={id => { onClose(); openTask(id); }} />
          <AttachmentPanel scope="tickets" id={t.id} canDelete={a => isAdmin || a.uploaderId === me.id || involved} />
          <Activity t={t} />
        </div>
      </div>
      <CommentBox id={t.id} />
    </>
  );
}

function Prop({ icon: IconCmp, label, children }: { icon: Icon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow flex items-center gap-1.5 mb-1"><IconCmp size={13} weight="bold" aria-hidden="true" /> {label}</dt>
      <dd className="text-sm font-medium text-theme-text min-w-0">{children}</dd>
    </div>
  );
}

function Description({ t, canEdit }: { t: Ticket; canEdit: boolean }) {
  const update = useUpdateTicket();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.description ?? '');
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="eyebrow">Açıklama</h3>
        {canEdit && !editing && <button onClick={() => { setDraft(t.description ?? ''); setEditing(true); }} className="text-xs font-medium text-theme-deep hover:underline underline-offset-4">{t.description ? 'Düzenle' : 'Ekle'}</button>}
      </div>
      {editing ? (
        <div>
          <textarea value={draft} autoFocus rows={5} maxLength={8000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }}
            className="input resize-y min-h-[7rem] text-sm" />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">Vazgeç</button>
            <button type="button" onClick={() => { update.mutate({ id: t.id, description: draft.trim() }); setEditing(false); }} className="btn-primary text-sm">Kaydet</button>
          </div>
        </div>
      ) : t.description
        ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl border border-theme-light p-4">{t.description}</p>
        : <p className="text-sm text-theme-muted">Açıklama yok.</p>}
    </section>
  );
}

/** Talebe bağlı DevHub görevi: yoksa tahmini süreyle tek adımda oluşturulur. */
function LinkedTask({ t, canEdit, onOpenTask }: { t: Ticket; canEdit: boolean; onOpenTask: (id: number) => void }) {
  const me = useMe();
  const { data: users } = useUsers();
  const create = useTicketTask(t.id);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState('');
  const [owner, setOwner] = useState(String(t.assigneeId ?? me.id));
  const minutes = parseHours(hours);
  const isAdmin = me.role === 'ADMIN';

  if (t.taskId) {
    const st = TASK_STATUS[(t.taskStatus ?? 'YAPILACAK') as TaskStatus] ?? TASK_STATUS.YAPILACAK;
    return (
      <section>
        <h3 className="eyebrow mb-2">Bağlı görev</h3>
        <button type="button" onClick={() => onOpenTask(t.taskId!)} className="w-full flex items-center gap-2 rounded-xl border border-theme-light px-3 py-2.5 text-left hover:bg-theme-lightest/50">
          <st.icon size={16} weight="bold" className={st.className} aria-hidden="true" />
          <span className="text-sm flex-1">Görev {st.label.toLowerCase()}</span>
          <ArrowSquareOut size={15} className="text-theme-muted" aria-hidden="true" />
        </button>
      </section>
    );
  }
  if (!canEdit) return null;
  return (
    <section>
      <h3 className="eyebrow mb-2">Bağlı görev</h3>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm"><ListChecks size={16} /> Bu talepten görev oluştur</button>
      ) : (
        <div className="rounded-xl border border-theme-light p-3 space-y-3">
          <p className="text-xs text-theme-muted">Görev, talebin konusu ve açıklamasıyla oluşturulur; son tarihi talebin çözüm hedefidir. Görev bitince talebe not düşer.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`tt-h-${t.id}`} className="text-xs text-theme-muted block mb-1">Tahmini süre (saat)</label>
              <input id={`tt-h-${t.id}`} value={hours} onChange={e => setHours(e.target.value)} inputMode="decimal" placeholder="Örn: 2" className="input-sm w-28" autoFocus />
            </div>
            {isAdmin && (
              <div className="flex-1 min-w-[12rem]">
                <span className="text-xs text-theme-muted block mb-1">Kime</span>
                <Combobox label="Görev kime" value={owner} onChange={setOwner} width={300} className="w-full" searchPlaceholder="Kişi ara"
                  options={(users ?? []).map(u => ({ value: String(u.id), label: u.fullName, leading: <Avatar user={u} size="xs" /> }))} />
              </div>
            )}
            <button type="button" disabled={!minutes || minutes < 15 || create.isPending} onClick={() => create.mutate({ estimatedMinutes: minutes!, userId: Number(owner) }, { onSuccess: () => setOpen(false) })} className="btn-primary text-sm">Oluştur</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Vazgeç</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Activity({ t }: { t: Ticket }) {
  const me = useMe();
  const { data, isLoading } = useTicketActivity(t.id);
  const del = useDeleteTicketComment(t.id);
  return (
    <section>
      <h3 className="eyebrow mb-3">Etkinlik</h3>
      {isLoading ? <Skeleton className="h-16" /> : (
        <ol className="space-y-3">
          {(data ?? []).map(a => (
            <li key={a.id} className="flex gap-2.5">
              {a.actorName ? <Avatar user={{ fullName: a.actorName, avatarColor: a.actorAvatarColor ?? '', status: null }} size="xs" /> : <span className="w-7 h-7" />}
              {a.kind === 'COMMENT' ? (
                <div className="group flex-1 min-w-0 rounded-2xl rounded-tl-md border border-theme-light p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{a.actorName ?? 'Sistem'}</span>
                    <time className="text-xs text-theme-muted" dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
                    {(a.actorId === me.id || me.role === 'ADMIN') && (
                      <button onClick={() => del.mutate(a.id)} className="ml-auto icon-btn w-7 h-7 opacity-0 group-hover:opacity-100" aria-label="Yorumu sil"><Trash size={13} /></button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{a.message}</p>
                </div>
              ) : (
                <p className="text-sm text-theme-muted pt-1"><span className="font-medium text-theme-text">{a.actorName ?? 'Sistem'}</span> {a.message} · <time dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time></p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CommentBox({ id }: { id: number }) {
  const add = useTicketComment(id);
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    const v = text.trim();
    if (!v || add.isPending) return;
    add.mutate(v, { onSuccess: () => { setText(''); ref.current?.focus(); } });
  };
  return (
    <div className="p-4 sm:px-8 sm:py-5 border-t border-theme-light">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <ChatCircleText size={18} className="absolute left-3.5 top-3 text-theme-muted" aria-hidden="true" />
          <textarea ref={ref} value={text} rows={1} maxLength={4000} aria-label="Not ya da yorum yaz" placeholder="Yorum yazın (soru, yapılanlar, ek bilgi…)"
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="input pl-10 py-2.5 resize-none max-h-32 text-sm [field-sizing:content]" />
        </div>
        <button type="button" onClick={send} disabled={!text.trim() || add.isPending} className="btn-primary px-4 min-h-[2.75rem]" aria-label="Gönder"><PaperPlaneRight size={18} weight="bold" /></button>
      </div>
    </div>
  );
}
