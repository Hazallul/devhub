import { useEffect, useState } from 'react';
import { Check, MagnifyingGlass, ShieldCheck, SignOut, UserMinus, UserPlus } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Avatar } from '../ui/primitives';
import { useMe, useUsers } from '../../hooks/api';
import { useAddListMembers, useRemoveListMember, useSetListRole } from '../../hooks/todos';
import { trLower } from '../../lib/format';
import type { TodoList } from '../../types';

interface Props {
  list: TodoList | null;
  onClose: () => void;
  /** Kişi listeden ayrıldı: liste artık onda görünmez */
  onLeft: () => void;
}

/**
 * Ortak liste üyeleri. Listeyi oluşturan kişi yöneticidir; üye ekleyip çıkarabilir ve başka üyelere yöneticilik verebilir.
 * Üyeler listedeki tüm kartları görür ve düzenler; yönetici olmayanlar yalnızca listeden ayrılabilir.
 */
export default function ListMembersModal({ list, onClose, onLeft }: Props) {
  const me = useMe();
  const { data: users } = useUsers();
  const add = useAddListMembers();
  const setRole = useSetListRole();
  const remove = useRemoveListMember();
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const listId = list?.id;

  useEffect(() => { setPicked([]); setQuery(''); setAdding(false); }, [listId]);

  const admin = list?.myRole === 'ADMIN';
  const members = list?.members ?? [];
  const memberIds = new Set(members.map(m => m.userId));
  const adminCount = members.filter(m => m.role === 'ADMIN').length;
  const q = trLower(query.trim());
  const candidates = (users ?? [])
    .filter(u => !memberIds.has(u.id))
    .filter(u => !q || trLower(`${u.fullName} ${u.jobTitle ?? ''}`).includes(q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!list || picked.length === 0) return;
    add.mutate({ id: list.id, userIds: picked }, { onSuccess: () => { setPicked([]); setAdding(false); } });
  };

  return (
    <Modal
      open={!!list}
      onClose={onClose}
      size="sm"
      title={list ? `${list.name} · üyeler` : 'Üyeler'}
      description={members.length > 1
        ? 'Üyeler bu listedeki tüm kartları görür, ekler ve tamamlar. Diğer listeleriniz ve “Genel” size özeldir.'
        : 'Bu liste şu an yalnızca size özel. Kişi eklediğinizde liste ortak olur: üyeler içindeki tüm kartları görür.'}
      onSubmit={submit}
      footer={adding ? <>
        <button type="button" onClick={() => { setAdding(false); setPicked([]); }} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={picked.length === 0 || add.isPending} className="btn-primary">
          {add.isPending ? 'Ekleniyor…' : picked.length > 1 ? `${picked.length} kişiyi ekle` : 'Ekle'}
        </button>
      </> : <>
        <button type="button" onClick={onClose} className="btn-ghost">Kapat</button>
        {admin && <button type="button" onClick={() => setAdding(true)} className="btn-primary"><UserPlus size={17} weight="bold" /> Kişi ekle</button>}
      </>}
    >
      {adding ? (
        <div className="rounded-3xl border border-theme-light/60 bg-theme-cream/60">
          <div className="relative p-2 border-b border-theme-light/50">
            <MagnifyingGlass size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input type="search" data-autofocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Kişi ara…" aria-label="Kişi ara"
              className="w-full pl-9 pr-3 py-2 rounded-2xl bg-surface border border-theme-light/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-medium" />
          </div>
          <ul role="group" aria-label="Eklenecek kişiler" className="max-h-[17.5rem] overflow-y-auto scrollbar-thin p-1.5">
            {candidates.length === 0 && <li className="text-sm text-theme-muted font-medium text-center py-6">Eklenebilecek kişi yok.</li>}
            {candidates.map(u => {
              const checked = picked.includes(u.id);
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
      ) : (
        <ul className="space-y-1.5" aria-label="Üyeler">
          {members.map(m => {
            const user = users?.find(u => u.id === m.userId);
            const self = m.userId === me.id;
            const lastAdmin = m.role === 'ADMIN' && adminCount <= 1;
            return (
              <li key={m.userId} className="flex items-center gap-3 p-2.5 rounded-2xl bg-theme-cream/70 border border-theme-light/40">
                <Avatar user={{ fullName: m.fullName, avatarColor: user?.avatarColor ?? '#C5D89D', status: null }} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-theme-text truncate">{m.fullName}{self && <span className="font-medium text-theme-muted"> (siz)</span>}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${m.role === 'ADMIN' ? 'text-theme-deep' : 'text-theme-muted'}`}>
                    {m.role === 'ADMIN' && <ShieldCheck size={13} weight="bold" aria-hidden="true" />}
                    {m.role === 'ADMIN' ? 'Liste yöneticisi' : 'Üye'}
                  </span>
                </span>
                {admin && !self && (
                  <button type="button" disabled={setRole.isPending}
                    onClick={() => list && setRole.mutate({ id: list.id, userId: m.userId, role: m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })}
                    className="h-9 px-3 rounded-xl text-xs font-bold text-theme-deep hover:bg-theme-lightest transition-colors whitespace-nowrap">
                    {m.role === 'ADMIN' ? 'Yöneticiliği al' : 'Yönetici yap'}
                  </button>
                )}
                {admin && !self && (
                  <button type="button" onClick={() => list && remove.mutate({ id: list.id, userId: m.userId, self: false })}
                    className="icon-btn w-9 h-9 hover:text-danger hover:bg-danger-soft" aria-label={`${m.fullName} kişisini listeden çıkar`} title="Listeden çıkar">
                    <UserMinus size={17} weight="bold" />
                  </button>
                )}
                {self && members.length > 1 && (
                  <button type="button" disabled={lastAdmin}
                    title={lastAdmin ? 'Tek yönetici sizsiniz: önce başka bir üyeyi yönetici yapın' : undefined}
                    onClick={() => list && remove.mutate({ id: list.id, userId: me.id, self: true }, { onSuccess: () => { onClose(); onLeft(); } })}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-danger hover:bg-danger-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap">
                    <SignOut size={15} weight="bold" aria-hidden="true" /> Ayrıl
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
