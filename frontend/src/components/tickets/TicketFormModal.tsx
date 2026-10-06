import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Combobox from '../ui/Combobox';
import { Avatar, Segmented } from '../ui/primitives';
import { useMe, useProjects, useUsers } from '../../hooks/api';
import { useCreateTicket, type TicketPriority, type TicketType } from '../../hooks/tickets';
import { TICKET_PRIORITY, TICKET_PRIORITIES, TICKET_TYPE, TICKET_TYPES } from '../../lib/tickets';

/**
 * Yeni talep: her zaman giriş yapan kişi adına açılır. Çalışanın talebi yönetime düşer;
 * kime verileceğini yönetici seçer (atama alanı yalnızca yöneticide görünür).
 */
export default function TicketFormModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: number) => void }) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const create = useCreateTicket();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TicketType>('ARIZA');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [assignee, setAssignee] = useState('');
  const [project, setProject] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setType('ARIZA'); setPriority('NORMAL'); setAssignee(''); setProject(''); setError('');
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) { setError('Talebin konusunu en az 3 karakterle yazın.'); return; }
    create.mutate({
      title: title.trim(), description: description.trim() || undefined, type, priority,
      assigneeId: isAdmin && assignee ? Number(assignee) : null, projectId: project ? Number(project) : null,
    }, { onSuccess: t => { onClose(); onCreated?.(t.id); } });
  };

  return (
    <Modal open={open} onClose={onClose} title="Yeni talep" size="lg" onSubmit={submit}
      description={isAdmin ? 'Talep sizin adınıza açılır; isterseniz hemen birine atayın.' : 'Talebiniz yönetime iletilir; kime verileceğine yönetici karar verir.'}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Gönderiliyor…' : 'Talebi gönder'}</button>
      </>}>
      <div className="space-y-5">
        <p className="flex items-center gap-2 text-sm text-theme-muted">
          <Avatar user={me} size="xs" /> Talep eden: <span className="font-medium text-theme-text">{me.fullName}</span>
        </p>
        <div>
          <span className="label">Tür</span>
          <Segmented<TicketType> label="Tür" layoutId="ticket-type" value={type} onChange={setType} options={TICKET_TYPES.map(t => ({ value: t, label: TICKET_TYPE[t].label }))} />
          <p className="text-xs text-theme-muted mt-1">Örn: {TICKET_TYPE[type].hint}</p>
        </div>
        <div>
          <label htmlFor="t-title" className="label">Konu</label>
          <input id="t-title" data-autofocus value={title} onChange={e => { setTitle(e.target.value); setError(''); }} maxLength={300} className="input"
            placeholder="Örn: Test sunucusuna bağlanamıyorum" aria-invalid={!!error} />
          {error && <p role="alert" className="text-xs text-danger mt-1">{error}</p>}
        </div>
        <div>
          <label htmlFor="t-desc" className="label">Açıklama <span className="font-normal text-theme-muted">(isteğe bağlı)</span></label>
          <textarea id="t-desc" value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={8000} className="input resize-y"
            placeholder="Ne oldu, ne zamandan beri? Varsa hata mesajı…" />
          <p className="text-xs text-theme-muted mt-1">Ekran görüntüsünü talebi gönderdikten sonra ayrıntı panelinden ekleyebilirsiniz (Ctrl+V).</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <span className="label">Öncelik</span>
            <Segmented<TicketPriority> label="Öncelik" layoutId="ticket-priority" value={priority} onChange={setPriority}
              options={TICKET_PRIORITIES.map(p => ({ value: p, label: TICKET_PRIORITY[p].label }))} />
            <p className="text-xs text-theme-muted mt-1">Çözüm hedefi: {TICKET_PRIORITY[priority].sla}</p>
          </div>
          <div>
            <span className="label">İlgili proje <span className="font-normal text-theme-muted">(isteğe bağlı)</span></span>
            <Combobox label="Proje" value={project} onChange={setProject} className="w-full" width={320} placeholder="Projesiz" searchPlaceholder="Proje ara"
              options={[{ value: '', label: 'Projesiz' }, ...(projects ?? []).map(p => ({ value: String(p.id), label: p.name }))]} />
          </div>
        </div>
        {isAdmin && (
          <div className="sm:w-1/2 sm:pr-2.5">
            <span className="label">Atanan</span>
            <Combobox label="Atanan" value={assignee} onChange={setAssignee} className="w-full" width={320} placeholder="Şimdilik atama" searchPlaceholder="Kişi ara"
              options={[{ value: '', label: 'Şimdilik atama' }, ...(users ?? []).filter(u => u.active).map(u => ({ value: String(u.id), label: u.fullName, hint: u.status === 'IZINLI' ? 'Bugün izinli' : [u.jobTitle, u.department].filter(Boolean).join(' · ') || undefined, leading: <Avatar user={u} size="xs" /> }))]} />
          </div>
        )}
      </div>
    </Modal>
  );
}
