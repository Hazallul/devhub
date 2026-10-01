import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Warning, PencilSimple, ArrowRight, Quotes } from '@phosphor-icons/react';
import DocContent from '../components/docs/DocContent';
import DocDiff from '../components/docs/DocDiff';
import DecisionModal from '../components/ui/DecisionModal';
import type { Decision } from '../components/ui/DecisionModal';
import { Avatar, EmptyState, Segmented, Skeleton } from '../components/ui/primitives';
import { usePageMenu } from '../components/layout/ContextMenu';
import { REVISION_STATUS, categoryName } from '../docs';
import { useDecideDocRevision, useDoc, useDocRevision, useWithdrawDocRevision } from '../hooks/docs';
import { useMe, useUsers } from '../hooks/api';
import { parseServerDate, timeAgo } from '../lib/format';
import type { DocDetail, DocRevision } from '../types';

const dateTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Bir doküman önerisinin incelemesi (/docs/oneri/:id): yönetici onaylar/reddeder, öneren kişi durumunu görür. */
export default function DocReview() {
  const id = Number(useParams().id) || null;
  const { data: rev, isLoading, isError } = useDocRevision(id);
  const { data: current, isLoading: docLoading } = useDoc(rev?.docSlug ?? undefined);

  if (isLoading || (rev?.docSlug && docLoading)) {
    return <div className="space-y-4 max-w-4xl"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  }
  if (isError || !rev?.content) {
    return <EmptyState icon={Warning} title="Öneri bulunamadı" description="Silinmiş olabilir ya da görme yetkiniz yok." action={<Link to="/docs" className="btn-primary">Dokümantasyona dön</Link>} />;
  }
  return <Review rev={rev} current={current ?? null} />;
}

type Tab = 'diff' | 'proposed' | 'current';

function Review({ rev, current }: { rev: DocRevision; current: DocDetail | null }) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const mine = rev.authorId === me.id;
  const pending = rev.status === 'BEKLIYOR';
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const author = users?.find(u => u.id === rev.authorId);
  const decide = useDecideDocRevision();
  const withdraw = useWithdrawDocRevision();
  const [decision, setDecision] = useState<Decision | null>(null);
  const comparable = !rev.isNew && current;
  const [tab, setTab] = useState<Tab>(comparable && pending ? 'diff' : 'proposed');
  const st = REVISION_STATUS[rev.status];
  const editHref = `/docs/${rev.isNew ? 'yeni' : `${rev.docSlug}/duzenle`}?oneri=${rev.id}`;

  usePageMenu([
    isAdmin && pending && { label: 'Onayla ve yayınla', icon: CheckCircle, onSelect: () => setDecision('ONAYLANDI') },
    isAdmin && pending && { label: 'Reddet…', icon: XCircle, onSelect: () => setDecision('REDDEDILDI') },
    mine && pending && { label: 'Önerimi düzenle', icon: PencilSimple, onSelect: () => navigate(editHref) },
    !!rev.docSlug && { label: 'Dokümanı aç', icon: ArrowRight, onSelect: () => navigate(`/docs/${rev.docSlug}`) },
  ]);

  // Başlık, özet, kategori, etiket değişiklikleri (yalnızca mevcut doküman için)
  const meta = comparable ? [
    { label: 'Başlık', before: current.title, after: rev.title },
    { label: 'Özet', before: current.summary ?? '', after: rev.summary ?? '' },
    { label: 'Kategori', before: categoryName(current.category), after: categoryName(rev.category) },
    { label: 'Etiketler', before: current.tags.map(t => `#${t}`).join(' '), after: rev.tags.map(t => `#${t}`).join(' ') },
  ].filter(m => m.before !== m.after) : [];

  return (
    <div className="pb-10 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={rev.docSlug ? `/docs/${rev.docSlug}` : '/docs'} className="icon-btn border border-theme-light/60" aria-label="Geri dön"><ArrowLeft size={18} weight="bold" /></Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{rev.isNew ? 'Yeni doküman önerisi' : 'Değişiklik önerisi'} · {categoryName(rev.category)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-text">{rev.isNew ? rev.title : rev.docTitle}</h1>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl ${st.className}`}><st.icon size={15} weight="bold" /> {st.label}</span>
      </div>

      <div className="card p-5 mb-5 flex flex-wrap items-start gap-4">
        <Avatar user={author ?? { fullName: rev.authorName ?? '?', avatarColor: '', status: null }} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-theme-text">
            {rev.authorName ?? 'Silinmiş kullanıcı'} <span className="font-semibold text-theme-muted">· {dateTime.format(parseServerDate(rev.createdAt))} ({timeAgo(rev.createdAt)})</span>
          </p>
          {rev.note ? (
            <p className="flex items-start gap-1.5 text-[15px] text-theme-text font-medium mt-1"><Quotes size={16} weight="fill" className="text-theme-medium shrink-0 mt-1" aria-hidden="true" />{rev.note}</p>
          ) : <p className="text-sm text-theme-muted font-medium mt-1">Açıklama eklenmemiş.</p>}
          {!rev.isNew && rev.baseVersion !== null && <p className="text-xs text-theme-muted font-semibold mt-2">Sürüm {rev.baseVersion} üzerinde hazırlandı{current ? ` · doküman şu an sürüm ${current.version}` : ''}</p>}
          {rev.decidedAt && rev.status !== 'BEKLIYOR' && (
            <p className="text-sm font-semibold text-theme-text mt-3 pt-3 border-t border-theme-light/50">
              {rev.status === 'GERI_CEKILDI' ? 'Öneren kişi geri çekti ya da yenisiyle değiştirdi.' : `${rev.decidedByName ?? 'Yönetici'} ${rev.status === 'ONAYLANDI' ? 'onayladı' : 'reddetti'} · ${dateTime.format(parseServerDate(rev.decidedAt))}`}
              {rev.decisionNote && <span className="block text-theme-muted font-medium mt-0.5">“{rev.decisionNote}”</span>}
            </p>
          )}
        </div>
        {pending && (isAdmin || mine) && (
          <div className="flex flex-wrap gap-2">
            {mine && <Link to={editHref} className="btn-secondary min-h-[40px] px-3 text-sm"><PencilSimple size={16} weight="bold" /> Düzenle</Link>}
            {mine && <button type="button" onClick={() => withdraw.mutate(rev.id, { onSuccess: () => navigate('/docs') })} disabled={withdraw.isPending} className="btn-secondary min-h-[40px] px-3 text-sm">Geri çek</button>}
            {isAdmin && (
              <>
                <button type="button" onClick={() => setDecision('REDDEDILDI')} className="btn-secondary min-h-[40px] px-3 text-sm"><XCircle size={16} weight="bold" /> Reddet</button>
                <button type="button" onClick={() => setDecision('ONAYLANDI')} className="btn-primary min-h-[40px] px-3 text-sm"><CheckCircle size={16} weight="bold" /> Onayla ve yayınla</button>
              </>
            )}
          </div>
        )}
      </div>

      {pending && rev.outdated && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4 mb-5 text-sm font-medium text-warn-ink">
          <Warning size={20} weight="fill" className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Bu öneri hazırlandıktan sonra doküman güncellendi (sürüm {rev.baseVersion} → {rev.docVersion}). Onaylarsanız doküman bu önerideki hâle gelir;
            aradaki değişiklikler “Kaldırıldı” olarak aşağıda görünür. Gerekirse reddedip öneren kişiden son sürüm üzerine yeniden yapmasını isteyin.
          </span>
        </div>
      )}

      {meta.length > 0 && (
        <div className="card p-5 mb-5">
          <p className="eyebrow mb-3">Bilgi değişiklikleri</p>
          <dl className="space-y-2 text-sm">
            {meta.map(m => (
              <div key={m.label} className="grid sm:grid-cols-[100px_1fr] gap-1 sm:gap-3">
                <dt className="font-bold text-theme-muted">{m.label}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <span className="line-through decoration-clay/70 text-theme-muted">{m.before || '—'}</span>
                  <ArrowRight size={13} weight="bold" className="text-theme-muted" aria-label="yerine" />
                  <span className="font-semibold text-theme-text">{m.after || '—'}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {comparable && (
        <div className="mb-4">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            layoutId="doc-review-tab"
            label="Görünüm"
            options={[
              { value: 'diff', label: 'Değişiklikler' },
              { value: 'proposed', label: 'Önerilen hâli' },
              { value: 'current', label: 'Şu anki hâli' },
            ]}
          />
        </div>
      )}

      <div className="card p-6 sm:p-8">
        {tab === 'diff' && comparable ? (
          <DocDiff before={current.content} after={rev.content!} />
        ) : tab === 'current' && current ? (
          <DocContent doc={current.content} />
        ) : (
          <>
            {rev.isNew && (
              <>
                <h2 className="text-3xl font-bold tracking-tight text-theme-text">{rev.title}</h2>
                {rev.summary && <p className="text-lg text-theme-muted font-medium mt-2">{rev.summary}</p>}
                {rev.tags.length > 0 && <p className="flex flex-wrap gap-1.5 mt-3">{rev.tags.map(t => <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-theme-lightest text-theme-deep">#{t}</span>)}</p>}
                <hr className="my-6 border-theme-light/50" />
              </>
            )}
            <DocContent doc={rev.content!} />
          </>
        )}
      </div>

      <DecisionModal
        decision={decision}
        onClose={() => setDecision(null)}
        subject="doküman önerisini"
        pending={decide.isPending}
        hint={decision === 'ONAYLANDI' ? (rev.isNew ? 'Doküman oluşturulur ve herkese görünür.' : `Doküman sürüm ${(rev.docVersion ?? 0) + 1} olarak güncellenir; eski sürüm geçmişte kalır.`) : 'Öneren kişi gerekçenizi bildirimde görür.'}
        onConfirm={note => decide.mutate({ id: rev.id, decision: decision!, note }, {
          onSuccess: () => {
            setDecision(null);
            if (decision === 'ONAYLANDI' && rev.docSlug) navigate(`/docs/${rev.docSlug}`);
            else if (decision === 'ONAYLANDI') navigate('/docs');
          },
        })}
      >
        <p className="text-sm font-semibold text-theme-text">{rev.isNew ? `Yeni doküman: ${rev.title}` : rev.docTitle}</p>
        <p className="text-xs text-theme-muted font-semibold mt-0.5">{rev.authorName ?? 'Silinmiş kullanıcı'}{rev.note ? ` · “${rev.note}”` : ''}</p>
      </DecisionModal>
    </div>
  );
}
