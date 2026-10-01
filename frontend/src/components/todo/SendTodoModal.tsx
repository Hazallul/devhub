import { useEffect, useState } from 'react';
import { Check, MagnifyingGlass } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Avatar } from '../ui/primitives';
import { useMe, useUsers } from '../../hooks/api';
import { useSendTodo } from '../../hooks/todos';
import { trLower } from '../../lib/format';
import type { TodoItem } from '../../types';

/** Kartın bir kopyasını seçilen kişilerin kişisel alanına gönderir; kendi kartınız yerinde kalır. */
export default function SendTodoModal({ item, onClose }: { item: TodoItem | null; onClose: () => void }) {
  const me = useMe();
  const { data: users } = useUsers();
  const send = useSendTodo();
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (item) { setSelected([]); setMessage(''); setQuery(''); }
  }, [item]);

  const q = trLower(query.trim());
  const people = (users ?? [])
    .filter(u => u.id !== me.id)
    .filter(u => !q || trLower(`${u.fullName} ${u.jobTitle ?? ''}`).includes(q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));

  const toggle = (id: number) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || selected.length === 0) return;
    send.mutate({ id: item.id, userIds: selected, message: message.trim() || undefined }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      size="sm"
      title="Kartı gönder"
      description="Kartın bir kopyası (adımları ve notuyla) seçtiğiniz kişinin kişisel alanına düşer. Sizin kartınız yerinde kalır."
      onSubmit={submit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={selected.length === 0 || send.isPending} className="btn-primary">
          {send.isPending ? 'Gönderiliyor…' : selected.length > 1 ? `${selected.length} kişiye gönder` : 'Gönder'}
        </button>
      </>}
    >
      <div className="space-y-4">
        {item && <p className="text-sm font-bold text-theme-text bg-theme-cream rounded-2xl px-4 py-3 break-words">{item.title}</p>}

        <div className="rounded-3xl border border-theme-light/60 bg-theme-cream/60">
          <div className="relative p-2 border-b border-theme-light/50">
            <MagnifyingGlass size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input
              type="search"
              data-autofocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kişi ara…"
              aria-label="Kişi ara"
              className="w-full pl-9 pr-3 py-2 rounded-2xl bg-surface border border-theme-light/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-medium"
            />
          </div>
          <ul role="group" aria-label="Alıcılar" className="max-h-[240px] overflow-y-auto scrollbar-thin p-1.5">
            {people.length === 0 && <li className="text-sm text-theme-muted font-medium text-center py-6">Eşleşen kişi yok.</li>}
            {people.map(u => {
              const checked = selected.includes(u.id);
              return (
                <li key={u.id}>
                  <button type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-colors ${checked ? 'bg-surface shadow-soft' : 'hover:bg-surface/70'}`}>
                    <span className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-accent border-theme-deep text-white' : 'border-theme-medium bg-surface'}`} aria-hidden="true">
                      {checked && <Check size={12} weight="bold" />}
                    </span>
                    <Avatar user={u} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-theme-text truncate">{u.fullName}</span>
                      <span className="block text-xs text-theme-muted font-medium truncate">{u.jobTitle || (u.role === 'ADMIN' ? 'Yönetici' : 'Çalışan')}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label htmlFor="send-message" className="label">Kısa not <span className="text-theme-muted font-medium">(isteğe bağlı)</span></label>
          <input id="send-message" value={message} maxLength={500} onChange={e => setMessage(e.target.value)} placeholder="Örn: Yarınki toplantıdan önce bakabilir misin?" className="input" />
        </div>
      </div>
    </Modal>
  );
}
