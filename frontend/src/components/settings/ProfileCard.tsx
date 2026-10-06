import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, UserCircle, Plus, Trash, EnvelopeSimple, AddressBook, ArrowRight } from '@phosphor-icons/react';
import { Avatar, StatusBadge } from '../ui/primitives';
import { useMe, useUpdateProfile, useUpdateLinks } from '../../hooks/api';
import { AVATAR_COLORS, LINK_TYPE, LINK_TYPES } from '../../lib/meta';
import type { ProfileRequest, UserLink, UserLinkType } from '../../types';

/**
 * Profil kartı. Üç ayrı kayıt davranışı vardır:
 *  - Avatar rengi: tıklanınca hemen kaydedilir.
 *  - Ad soyad ve unvan: hesap açılırken yönetici girer; yalnızca yönetici değiştirir (çalışan için salt okunur).
 *  - İletişim ve bağlantılar: kişi onay gerekmeden kendisi düzenler.
 */
export default function ProfileCard() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState(me.fullName);
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(me.fullName);
    setJobTitle(me.jobTitle ?? '');
  }, [me.fullName, me.jobTitle]);

  const color = me.avatarColor ?? AVATAR_COLORS[1];
  const dirty = fullName.trim() !== me.fullName || jobTitle.trim() !== (me.jobTitle ?? '');
  const busy = update.isPending;

  const refreshSession = (user: unknown) => {
    try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* yok say */ }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) { setError('Ad soyad en az 3 karakter olmalı.'); return; }
    setError('');
    update.mutate({ userId: me.id, fullName: fullName.trim(), jobTitle: jobTitle.trim() }, { onSuccess: refreshSession });
  };

  return (
    <section className="card p-5 sm:p-6 lg:col-span-2 space-y-7" aria-labelledby="profile-title">
      <h2 id="profile-title" className="text-base font-semibold flex items-center gap-2"><UserCircle size={22} weight="duotone" className="text-theme-deep" /> Profil</h2>

      <div className="flex items-center gap-5">
        <motion.div key={color} initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
          <Avatar user={{ fullName: me.fullName, avatarColor: color, status: me.status }} size="lg" />
        </motion.div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{me.fullName}</p>
          <p className="text-sm text-theme-muted font-medium truncate">{me.jobTitle || 'Unvan belirtilmedi'}</p>
          <div className="mt-2"><StatusBadge status={me.status} size="sm" /></div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Avatar rengi</legend>
        <div className="flex flex-wrap gap-3">
          {AVATAR_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => c !== color && update.mutate({ userId: me.id, avatarColor: c }, { onSuccess: refreshSession })}
              aria-label={`Renk ${c}`}
              aria-pressed={color === c}
              className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-transform hover:scale-105 ${color === c ? 'border-theme-deep' : 'border-surface shadow-soft'}`}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check size={18} weight="bold" className="text-theme-text" />}
            </button>
          ))}
        </div>
      </fieldset>

      {isAdmin && (
      <form onSubmit={save} className="pt-6 border-t border-theme-light/40 space-y-4" aria-label="Ad soyad ve unvan">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="s-name" className="label">Ad soyad</label>
            <input id="s-name" value={fullName} onChange={e => setFullName(e.target.value)} aria-invalid={!!error} aria-describedby="s-name-err" className="input" autoComplete="name" />
            {error && <p id="s-name-err" role="alert" className="text-xs font-semibold text-danger mt-1.5 ml-1">{error}</p>}
          </div>
          <div>
            <label htmlFor="s-title" className="label">Unvan</label>
            <input id="s-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Örn: Backend Developer" className="input" autoComplete="organization-title" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 ml-auto">
            {dirty && <button type="button" onClick={() => { setFullName(me.fullName); setJobTitle(me.jobTitle ?? ''); setError(''); }} className="btn-ghost">Geri al</button>}
            <button type="submit" disabled={!dirty || busy} className="btn-primary">
              {busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
            </button>
          </div>
        </div>
      </form>
      )}

      <LinksEditor />
    </section>
  );
}

/** "Ad: A → B" / "Unvan: A → B" satırları */
export function ProfileDiff({ request }: { request: ProfileRequest }) {
  const rows: [string, string, string][] = [];
  if (request.fullName !== request.previousFullName) rows.push(['Ad soyad', request.previousFullName, request.fullName]);
  if ((request.jobTitle ?? '') !== (request.previousJobTitle ?? '')) rows.push(['Unvan', request.previousJobTitle || '-', request.jobTitle || '-']);
  return (
    <dl className="space-y-1">
      {rows.map(([label, from, to]) => (
        <div key={label} className="flex flex-wrap items-center gap-x-2 text-sm">
          <dt className="font-semibold text-theme-muted">{label}:</dt>
          <dd className="flex flex-wrap items-center gap-x-2">
            <span className="text-theme-muted line-through decoration-theme-medium">{from}</span>
            <ArrowRight size={13} weight="bold" className="text-theme-muted" aria-label="yerine" />
            <span className="font-bold text-theme-text">{to}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------- İletişim ve bağlantılar ----------------

interface Row extends UserLink { key: number }
let nextKey = 1;
const toRows = (links: UserLink[] | undefined): Row[] => (links ?? []).map(l => ({ ...l, key: nextKey++ }));
const same = (a: Row[], b: UserLink[]) => a.length === b.length && a.every((r, i) => r.type === b[i].type && (r.label ?? '') === (b[i].label ?? '') && r.value === b[i].value);

function LinksEditor() {
  const me = useMe();
  const save = useUpdateLinks();
  const saved = me.links ?? [];
  const [rows, setRows] = useState<Row[]>(() => toRows(me.links));

  // Sunucudaki liste değişince (kayıt sonrası) formu onunla eşitle.
  const signature = JSON.stringify(saved);
  // Satır anahtarları korunur: aynı sıradaki satır yeniden oluşturulmaz (açılışta ve kayıt sonrası titreme olmaz).
  useEffect(() => {
    const next = JSON.parse(signature) as UserLink[];
    setRows(prev => next.map((l, i) => ({ ...l, key: prev[i]?.key ?? nextKey++ })));
  }, [signature]);

  const dirty = !same(rows, saved);
  const patch = (key: number, p: Partial<UserLink>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
  const incomplete = rows.some(r => !r.value.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(rows.map(r => ({ type: r.type, label: r.label?.trim() || null, value: r.value.trim() })));
  };

  return (
    <form onSubmit={submit} className="pt-6 border-t border-theme-light/40" aria-labelledby="links-title">
      <h3 id="links-title" className="text-base font-bold flex items-center gap-2"><AddressBook size={20} weight="duotone" className="text-theme-deep" /> İletişim ve bağlantılar</h3>
      <p className="text-sm text-theme-muted font-medium mt-1 mb-4">Ek e-posta, telefon veya LinkedIn gibi bağlantılar ekleyin. Onay gerekmez; ekip arkadaşlarınız bu bilgileri görebilir.</p>

      <ul className="space-y-2.5">
        <li className="flex items-center gap-3 rounded-2xl bg-theme-cream border border-theme-light/50 px-4 py-3">
          <EnvelopeSimple size={18} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-theme-text truncate flex-1">{me.email}</span>
          <span className="text-[0.6875rem] font-bold text-theme-muted shrink-0">Giriş e-postası</span>
        </li>
        <AnimatePresence initial={false}>
          {rows.map(r => {
            const meta = LINK_TYPE[r.type];
            return (
              <motion.li key={r.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] sm:grid-cols-[10.625rem_8.75rem_1fr_auto] gap-2 items-center">
                <div className="relative">
                  <meta.icon size={16} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-deep pointer-events-none" aria-hidden="true" />
                  <select aria-label="Tür" value={r.type} onChange={e => patch(r.key, { type: e.target.value as UserLinkType })} className="input py-2.5 pl-10 text-sm">
                    {LINK_TYPES.map(t => <option key={t} value={t}>{LINK_TYPE[t].label}</option>)}
                  </select>
                </div>
                <input aria-label="Etiket (isteğe bağlı)" value={r.label ?? ''} maxLength={40} onChange={e => patch(r.key, { label: e.target.value })} placeholder="Etiket (ör. Kişisel)" className="input py-2.5 text-sm hidden sm:block" />
                <input aria-label={meta.label} value={r.value} maxLength={300} onChange={e => patch(r.key, { value: e.target.value })} placeholder={meta.placeholder}
                  inputMode={r.type === 'EMAIL' ? 'email' : r.type === 'PHONE' ? 'tel' : 'url'} className="input py-2.5 text-sm col-span-1" />
                <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} className="icon-btn hover:text-danger hover:bg-danger-soft" aria-label={`${meta.label} satırını kaldır`} title="Kaldır">
                  <Trash size={17} weight="bold" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <button type="button" disabled={rows.length >= 12} onClick={() => setRows(rs => [...rs, { key: nextKey++, type: rs.some(x => x.type === 'LINKEDIN') ? 'EMAIL' : 'LINKEDIN', label: null, value: '' }])}
          className="btn-secondary min-h-[2.5rem] px-4 text-sm disabled:opacity-50">
          <Plus size={16} weight="bold" /> Bağlantı ekle
        </button>
        {dirty && (
          <div className="flex gap-3">
            <button type="button" onClick={() => setRows(toRows(saved))} className="btn-ghost">Geri al</button>
            <button type="submit" disabled={save.isPending || incomplete} className="btn-primary">{save.isPending ? 'Kaydediliyor…' : 'Bağlantıları Kaydet'}</button>
          </div>
        )}
      </div>
    </form>
  );
}
