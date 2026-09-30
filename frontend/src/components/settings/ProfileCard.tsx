import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, UserCircle, Hourglass, XCircle, CheckCircle, Plus, Trash, EnvelopeSimple, AddressBook, ArrowRight, Info } from '@phosphor-icons/react';
import { Avatar, StatusBadge } from '../ui/primitives';
import {
  useMe, useUpdateProfile, useUpdateLinks, useProfileRequests, useCreateProfileRequest, useWithdrawProfileRequest,
} from '../../hooks/api';
import { AVATAR_COLORS, LINK_TYPE, LINK_TYPES } from '../../lib/meta';
import { timeAgo } from '../../lib/format';
import type { ProfileRequest, UserLink, UserLinkType } from '../../types';

/**
 * Profil kartı. Üç ayrı kayıt davranışı vardır:
 *  - Avatar rengi: tıklanınca hemen kaydedilir.
 *  - Ad soyad ve unvan: yönetici doğrudan kaydeder; çalışan onaya gönderir (yönetici onaylayınca geçerli olur).
 *  - İletişim ve bağlantılar: kişi onay gerekmeden kendisi düzenler.
 */
export default function ProfileCard() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const update = useUpdateProfile();
  const request = useCreateProfileRequest();
  const { data: requests } = useProfileRequests();

  const [fullName, setFullName] = useState(me.fullName);
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(me.fullName);
    setJobTitle(me.jobTitle ?? '');
  }, [me.fullName, me.jobTitle]);

  const color = me.avatarColor ?? AVATAR_COLORS[1];
  const dirty = fullName.trim() !== me.fullName || jobTitle.trim() !== (me.jobTitle ?? '');
  const mine = (requests ?? []).filter(r => r.userId === me.id && r.state !== 'IPTAL');
  const pending = mine.find(r => r.state === 'BEKLIYOR');
  const latest = mine[0];
  const busy = update.isPending || request.isPending;

  const refreshSession = (user: unknown) => {
    try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* yok say */ }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) { setError('Ad soyad en az 3 karakter olmalı.'); return; }
    setError('');
    if (isAdmin) update.mutate({ userId: me.id, fullName: fullName.trim(), jobTitle: jobTitle.trim() }, { onSuccess: refreshSession });
    else request.mutate({ fullName: fullName.trim(), jobTitle: jobTitle.trim() }, { onSuccess: () => { setFullName(me.fullName); setJobTitle(me.jobTitle ?? ''); } });
  };

  return (
    <section className="card p-6 sm:p-8 lg:col-span-2 space-y-7" aria-labelledby="profile-title">
      <h2 id="profile-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><UserCircle size={22} weight="duotone" className="text-theme-deep" /> Profil</h2>

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
              className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-transform hover:scale-105 ${color === c ? 'border-theme-deep' : 'border-white shadow-soft'}`}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check size={18} weight="bold" className="text-theme-text" />}
            </button>
          ))}
        </div>
      </fieldset>

      <form onSubmit={save} className="pt-6 border-t border-theme-light/40 space-y-4" aria-label="Ad soyad ve unvan">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="s-name" className="label">Ad soyad</label>
            <input id="s-name" value={fullName} onChange={e => setFullName(e.target.value)} aria-invalid={!!error} aria-describedby="s-name-err" className="input" autoComplete="name" />
            {error && <p id="s-name-err" role="alert" className="text-xs font-semibold text-[#9A3B1B] mt-1.5 ml-1">{error}</p>}
          </div>
          <div>
            <label htmlFor="s-title" className="label">Unvan</label>
            <input id="s-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Örn: Backend Developer" className="input" autoComplete="organization-title" />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isAdmin && pending && <PendingNotice key={`p${pending.id}`} request={pending} />}
          {!isAdmin && !pending && latest && latest.state !== 'BEKLIYOR' && <DecisionNotice key={`d${latest.id}`} request={latest} />}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5 max-w-md">
            {!isAdmin && <><Info size={14} weight="bold" className="shrink-0" aria-hidden="true" /> Ad soyad ve unvan değişiklikleri yönetici onayından sonra geçerli olur.</>}
          </p>
          <div className="flex gap-3 ml-auto">
            {dirty && <button type="button" onClick={() => { setFullName(me.fullName); setJobTitle(me.jobTitle ?? ''); setError(''); }} className="btn-ghost">Geri al</button>}
            <button type="submit" disabled={!dirty || busy} className="btn-primary">
              {busy ? 'Gönderiliyor…' : isAdmin ? 'Değişiklikleri Kaydet' : pending ? 'Talebi Güncelle' : 'Onaya Gönder'}
            </button>
          </div>
        </div>
      </form>

      <LinksEditor />
    </section>
  );
}

/** "Ad: A → B" / "Unvan: A → B" satırları */
export function ProfileDiff({ request }: { request: ProfileRequest }) {
  const rows: [string, string, string][] = [];
  if (request.fullName !== request.previousFullName) rows.push(['Ad soyad', request.previousFullName, request.fullName]);
  if ((request.jobTitle ?? '') !== (request.previousJobTitle ?? '')) rows.push(['Unvan', request.previousJobTitle || '—', request.jobTitle || '—']);
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

function PendingNotice({ request }: { request: ProfileRequest }) {
  const withdraw = useWithdrawProfileRequest();
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div role="status" className="rounded-2xl bg-theme-lightest/70 border border-theme-light p-4 flex flex-wrap items-start gap-3">
        <Hourglass size={20} weight="duotone" className="text-theme-deep shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-theme-deep mb-1">Yönetici onayı bekleniyor <span className="font-medium text-theme-muted">· {timeAgo(request.createdAt)}</span></p>
          <ProfileDiff request={request} />
        </div>
        <button type="button" onClick={() => withdraw.mutate(request.id)} disabled={withdraw.isPending} className="btn-ghost min-h-[36px] px-3 text-sm">Talebi geri çek</button>
      </div>
    </motion.div>
  );
}

function DecisionNotice({ request }: { request: ProfileRequest }) {
  const approved = request.state === 'ONAYLANDI';
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div role="status" className={`rounded-2xl border p-4 flex items-start gap-3 ${approved ? 'bg-theme-lightest/70 border-theme-light' : 'bg-[#FBEDE5] border-[#EFC9B5]'}`}>
        {approved
          ? <CheckCircle size={20} weight="duotone" className="text-theme-deep shrink-0 mt-0.5" aria-hidden="true" />
          : <XCircle size={20} weight="duotone" className="text-[#9A3B1B] shrink-0 mt-0.5" aria-hidden="true" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold mb-1 ${approved ? 'text-theme-deep' : 'text-[#9A3B1B]'}`}>
            Son talebiniz {approved ? 'onaylandı' : 'reddedildi'}
            <span className="font-medium text-theme-muted"> · {request.decidedByName ?? 'Yönetici'}{request.decidedAt ? `, ${timeAgo(request.decidedAt)}` : ''}</span>
          </p>
          <ProfileDiff request={request} />
          {request.decisionNote && <p className="text-sm text-theme-text mt-2 whitespace-pre-wrap break-words">“{request.decisionNote}”</p>}
        </div>
      </div>
    </motion.div>
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted shrink-0">Giriş e-postası</span>
        </li>
        <AnimatePresence initial={false}>
          {rows.map(r => {
            const meta = LINK_TYPE[r.type];
            return (
              <motion.li key={r.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[170px_140px_1fr_auto] gap-2 items-center">
                <div className="relative">
                  <meta.icon size={16} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-deep pointer-events-none" aria-hidden="true" />
                  <select aria-label="Tür" value={r.type} onChange={e => patch(r.key, { type: e.target.value as UserLinkType })} className="input py-2.5 pl-10 text-sm">
                    {LINK_TYPES.map(t => <option key={t} value={t}>{LINK_TYPE[t].label}</option>)}
                  </select>
                </div>
                <input aria-label="Etiket (isteğe bağlı)" value={r.label ?? ''} maxLength={40} onChange={e => patch(r.key, { label: e.target.value })} placeholder="Etiket (ör. Kişisel)" className="input py-2.5 text-sm hidden sm:block" />
                <input aria-label={meta.label} value={r.value} maxLength={300} onChange={e => patch(r.key, { value: e.target.value })} placeholder={meta.placeholder}
                  inputMode={r.type === 'EMAIL' ? 'email' : r.type === 'PHONE' ? 'tel' : 'url'} className="input py-2.5 text-sm col-span-1" />
                <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} className="icon-btn hover:text-[#9A3B1B] hover:bg-[#FBEDE5]" aria-label={`${meta.label} satırını kaldır`} title="Kaldır">
                  <Trash size={17} weight="bold" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <button type="button" disabled={rows.length >= 12} onClick={() => setRows(rs => [...rs, { key: nextKey++, type: rs.some(x => x.type === 'LINKEDIN') ? 'EMAIL' : 'LINKEDIN', label: null, value: '' }])}
          className="btn-secondary min-h-[40px] px-4 text-sm disabled:opacity-50">
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
