import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MagnifyingGlass, CaretRight, CaretLeft, CaretDown, Clock, BookOpenText, ListBullets, X, PencilSimple, Plus, ClockCounterClockwise,
  Trash, HourglassMedium, Warning, FilePlus, DotsThree, ArrowRight,
} from '@phosphor-icons/react';
import { PageHeader, Avatar, EmptyState, Skeleton } from '../components/ui/primitives';
import { Menu, MenuItem, MenuDivider } from '../components/ui/Menu';
import DocContent from '../components/docs/DocContent';
import DocHistoryModal from '../components/docs/DocHistoryModal';
import { usePageMenu } from '../components/layout/ContextMenu';
import { DOC_CATEGORIES, REVISION_STATUS, categoryName, docOutline, readMinutes } from '../docs';
import { useDeleteDoc, useDoc, useDocRevisions, useDocs, useWithdrawDocRevision } from '../hooks/docs';
import { useMe, useUsers } from '../hooks/api';
import { formatDate, parseServerDate, timeAgo, toIsoDay, trLower } from '../lib/format';
import type { DocDetail, DocSummary } from '../types';

const longDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const categoryRank = new Map(DOC_CATEGORIES.map((c, i) => [c.id, i]));

/** Kategori sırası, sonra kategori içindeki sıra: kenar menüsü ve önceki/sonraki bu sırayı izler. */
function useSortedDocs() {
  const query = useDocs();
  const docs = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99) || a.sortOrder - b.sortOrder || a.id - b.id),
    [query.data],
  );
  return { docs, isLoading: query.isLoading };
}

/** Arama: başlık, özet, etiket ve metinde geçen dokümanlar; başlık eşleşmesi öne çıkar. */
function search(docs: DocSummary[], query: string) {
  const q = trLower(query.trim());
  if (!q) return [];
  return docs
    .map(d => {
      const inTitle = trLower(d.title).includes(q);
      const inMeta = trLower(`${d.summary ?? ''} ${d.tags.join(' ')}`).includes(q);
      const idx = trLower(d.plainText).indexOf(q);
      if (!inTitle && !inMeta && idx < 0) return null;
      const snippet = idx >= 0 ? d.plainText.slice(Math.max(0, idx - 60), idx + q.length + 80) : (d.summary ?? '');
      return { doc: d, score: inTitle ? 0 : inMeta ? 1 : 2, snippet: (idx > 60 ? '…' : '') + snippet + '…' };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.score - b.score);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = trLower(query.trim());
  const i = q ? trLower(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-theme-light/70 text-theme-text rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function Docs() {
  const { slug } = useParams();
  if (!slug) return <DocsHome />;
  return <DocPage slug={slug} />;
}

// ---------------- Ana sayfa ----------------

function DocsHome() {
  const navigate = useNavigate();
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { docs, isLoading } = useSortedDocs();
  const [query, setQuery] = useState('');
  const results = useMemo(() => search(docs, query), [docs, query]);
  const recent = useMemo(() => [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4), [docs]);

  usePageMenu([
    { label: 'Yeni doküman yaz', icon: FilePlus, onSelect: () => navigate('/docs/yeni') },
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Dokümantasyon"
        title="Dokümantasyon"
        description="Süreçlerimiz, mimarimiz ve kalite standartlarımız tek yerde. Eksik bir şey mi var? Herkes doküman yazabilir veya düzenleyebilir; değişiklikler yönetici onayıyla yayınlanır."
        actions={<Link to="/docs/yeni" className="btn-primary"><Plus size={18} weight="bold" /> Yeni doküman</Link>}
      />

      {isAdmin ? <PendingReviews /> : <MyProposals />}

      <div className="relative mb-10 max-w-2xl">
        <MagnifyingGlass size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Dokümanlarda ara: ör. migration, commit, nöbet…"
          aria-label="Dokümanlarda ara"
          className="input pl-14 py-4 text-base shadow-soft"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {query.trim() ? (
          <motion.section key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-label="Arama sonuçları" className="pb-10">
            <p className="text-sm text-theme-muted font-semibold mb-4" aria-live="polite">{results.length ? `${results.length} doküman bulundu` : 'Eşleşen doküman yok'}</p>
            <ul className="space-y-3">
              {results.map(({ doc, snippet }) => (
                <li key={doc.slug}>
                  <Link to={`/docs/${doc.slug}`} className="card block p-5 hover:shadow-diffusion hover:border-theme-light transition-[box-shadow,border-color]">
                    <p className="eyebrow mb-1">{categoryName(doc.category)}</p>
                    <p className="text-lg font-bold text-theme-text"><Highlight text={doc.title} query={query} /></p>
                    <p className="text-sm text-theme-muted mt-1 line-clamp-2"><Highlight text={snippet} query={query} /></p>
                  </Link>
                </li>
              ))}
            </ul>
            {!results.length && (
              <Link to="/docs/yeni" className="btn-secondary mt-4"><FilePlus size={17} weight="bold" /> Bu konuda bir doküman yazın</Link>
            )}
          </motion.section>
        ) : (
          <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pb-10 space-y-10">
            <div className="grid md:grid-cols-2 gap-5">
              {DOC_CATEGORIES.map(c => {
                const list = docs.filter(d => d.category === c.id);
                return (
                  <section key={c.id} className="card p-5" aria-labelledby={`cat-${c.id}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-11 h-11 rounded-2xl bg-theme-lightest text-theme-deep flex items-center justify-center"><c.icon size={22} weight="duotone" aria-hidden="true" /></span>
                      <div className="flex-1 min-w-0">
                        <h2 id={`cat-${c.id}`} className="text-lg font-bold text-theme-text">{c.name}</h2>
                        <p className="text-xs text-theme-muted font-semibold">{isLoading ? '…' : `${list.length} doküman`}</p>
                      </div>
                      <Link to={`/docs/yeni?kategori=${c.id}`} className="icon-btn border border-theme-light/60" aria-label={`${c.name} kategorisine doküman ekle`} title="Bu kategoriye doküman ekle">
                        <Plus size={16} weight="bold" />
                      </Link>
                    </div>
                    {isLoading ? (
                      <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-12" />)}</div>
                    ) : list.length ? (
                      <ul className="space-y-1">
                        {list.map(d => (
                          <li key={d.slug}>
                            <Link to={`/docs/${d.slug}`} className="group flex items-start gap-3 p-3 -mx-3 rounded-2xl hover:bg-theme-cream transition-colors">
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-theme-text group-hover:text-theme-deep">{d.title}</span>
                                {d.summary && <span className="block text-xs text-theme-muted font-medium mt-0.5 line-clamp-2">{d.summary}</span>}
                              </span>
                              <CaretRight size={16} weight="bold" className="text-theme-muted mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Link to={`/docs/yeni?kategori=${c.id}`} className="block rounded-2xl border border-dashed border-theme-light p-4 text-sm font-semibold text-theme-muted hover:text-theme-deep hover:bg-theme-cream transition-colors">
                        Henüz doküman yok · ilkini siz yazın
                      </Link>
                    )}
                  </section>
                );
              })}
            </div>

            {recent.length > 0 && (
              <section aria-labelledby="recent-docs">
                <h2 id="recent-docs" className="eyebrow mb-3">Son güncellenenler</h2>
                <ul className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {recent.map(d => (
                    <li key={d.slug}>
                      <Link to={`/docs/${d.slug}`} className="card block p-4 h-full hover:border-theme-dark/30 transition-colors">
                        <p className="text-sm font-bold text-theme-text line-clamp-2">{d.title}</p>
                        <p className="text-xs text-theme-muted font-semibold mt-2">{d.updatedByName ?? 'DevHub'} · {timeAgo(d.updatedAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Yönetici: onay bekleyen değişiklikler. */
function PendingReviews() {
  const { data } = useDocRevisions('pending');
  const { data: users } = useUsers();
  if (!data?.length) return null;
  return (
    <section id="onay-bekleyenler" className="card p-5 mb-8 border-theme-light" aria-labelledby="pending-docs">
      <h2 id="pending-docs" className="flex items-center gap-2 text-base font-bold text-theme-text mb-3">
        <HourglassMedium size={20} weight="duotone" className="text-theme-deep" aria-hidden="true" />
        Onay bekleyen değişiklikler
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent text-white">{data.length}</span>
      </h2>
      <ul className="divide-y divide-theme-light/40">
        {data.map(r => (
          <li key={r.id}>
            <Link to={`/docs/oneri/${r.id}`} className="group flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-theme-cream transition-colors">
              <Avatar user={users?.find(u => u.id === r.authorId) ?? { fullName: r.authorName ?? '?', avatarColor: '', status: null }} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-theme-text">
                  {r.isNew && <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md bg-theme-light text-theme-text">Yeni doküman</span>}
                  {r.isNew ? r.title : r.docTitle}
                  {r.outdated && (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-warn-ink" title="Öneriden sonra doküman güncellendi">
                      <Warning size={13} weight="fill" /> Eski sürüm üzerine
                    </span>
                  )}
                </span>
                <span className="block text-xs text-theme-muted font-medium truncate">
                  {r.authorName ?? 'Silinmiş kullanıcı'} · {timeAgo(r.createdAt)}{r.note ? ` · “${r.note}”` : ''}
                </span>
              </span>
              <span className="text-xs font-bold text-theme-deep flex items-center gap-1 shrink-0">İncele <ArrowRight size={13} weight="bold" className="group-hover:translate-x-0.5 transition-transform" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}


/** Çalışan: kendi önerileri (bekleyenler ve son iki haftada sonuçlananlar). */
function MyProposals() {
  const { data } = useDocRevisions('mine');
  const withdraw = useWithdrawDocRevision();
  const cutoff = Date.now() - 14 * 86_400_000;
  // Kişinin doğrudan yayınladıkları (ör. taşınan dokümanların ilk sürümü) öneri değildir.
  const list = (data ?? [])
    .filter(r => r.decidedById === null || r.decidedById !== r.authorId)
    .filter(r => r.status === 'BEKLIYOR' || (r.status !== 'GERI_CEKILDI' && r.decidedAt && parseServerDate(r.decidedAt).getTime() > cutoff))
    .slice(0, 5);
  if (!list.length) return null;
  return (
    <section className="card p-5 mb-8" aria-labelledby="my-proposals">
      <h2 id="my-proposals" className="text-base font-bold text-theme-text mb-1">Önerilerim</h2>
      <p className="text-xs text-theme-muted font-semibold mb-3">Yönetici onaylayınca değişikliğiniz yayınlanır ve bildirim alırsınız.</p>
      <ul className="divide-y divide-theme-light/40">
        {list.map(r => {
          const st = REVISION_STATUS[r.status];
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-1 rounded-lg ${st.className}`}><st.icon size={13} weight="bold" /> {st.label}</span>
              <Link to={`/docs/oneri/${r.id}`} className="min-w-0 flex-1 text-sm font-bold text-theme-text hover:text-theme-deep">
                {r.isNew ? `Yeni: ${r.title}` : r.docTitle ?? r.title}
                {r.decisionNote && <span className="block text-xs text-theme-muted font-medium">Yönetici: “{r.decisionNote}”</span>}
              </Link>
              <span className="text-xs text-theme-muted font-semibold">{timeAgo(r.decidedAt ?? r.createdAt)}</span>
              {r.status === 'BEKLIYOR' && (
                <span className="flex gap-1.5">
                  <Link to={`/docs/${r.isNew ? 'yeni' : `${r.docSlug}/duzenle`}?oneri=${r.id}`} className="btn-secondary min-h-[2.125rem] px-3 text-xs"><PencilSimple size={13} weight="bold" /> Düzenle</Link>
                  <button type="button" onClick={() => withdraw.mutate(r.id)} disabled={withdraw.isPending} className="btn-secondary min-h-[2.125rem] px-3 text-xs">Geri çek</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------- Doküman ----------------

function DocPage({ slug }: { slug: string }) {
  const { data: doc, isLoading, isError } = useDoc(slug);
  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4 pb-10">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (isError || !doc) {
    return (
      <EmptyState icon={BookOpenText} title="Doküman bulunamadı" description="Aradığınız sayfa taşınmış veya silinmiş olabilir."
        action={<Link to="/docs" className="btn-primary">Dokümantasyona dön</Link>} />
    );
  }
  return <DocView doc={doc} />;
}

function DocView({ doc }: { doc: DocDetail }) {
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { data: users } = useUsers();
  const { docs } = useSortedDocs();
  const pending = useDocRevisions('pending', isAdmin && doc.pendingCount > 0).data?.filter(r => r.docId === doc.id) ?? [];
  const remove = useDeleteDoc();
  const [navOpen, setNavOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const author = users?.find(u => u.id === doc.updatedById);
  const index = docs.findIndex(d => d.id === doc.id);
  const prev = index > 0 ? docs[index - 1] : undefined;
  const next = index >= 0 ? docs[index + 1] : undefined;
  const toc = useMemo(() => docOutline(doc.content), [doc.content]);
  const editHref = `/docs/${doc.slug}/duzenle${doc.myPendingRevisionId ? `?oneri=${doc.myPendingRevisionId}` : ''}`;

  usePageMenu([
    { label: doc.myPendingRevisionId ? 'Önerimi düzenle' : 'Bu dokümanı düzenle', icon: PencilSimple, onSelect: () => navigate(editHref) },
    { label: 'Sürüm geçmişi', icon: ClockCounterClockwise, onSelect: () => setHistoryOpen(true) },
    { label: 'Yeni doküman yaz', icon: FilePlus, onSelect: () => navigate(`/docs/yeni?kategori=${doc.category}`) },
    isAdmin && { label: 'Dokümanı sil…', icon: Trash, tone: 'danger', onSelect: () => setConfirmDelete(true) },
  ]);

  // Adresteki #bölüm varsa oraya kaydır (sayfa değişiminde yerleşim başa kaydırdıktan sonra).
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [doc.slug, location.hash]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <div className="grid gap-8 lg:grid-cols-[13.75rem_minmax(0,1fr)] xl:grid-cols-[13.75rem_minmax(0,1fr)_11.875rem] pb-10">
      {/* Sol: kategori ağacı (mobilde açılır kapanır) */}
      <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-4.5rem-5rem)] lg:overflow-y-auto scrollbar-thin lg:-mt-2 lg:pt-2">
        <button type="button" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen} className="lg:hidden btn-secondary w-full justify-between">
          <span className="flex items-center gap-2"><ListBullets size={18} weight="bold" /> Tüm dokümanlar</span>
          <CaretDown size={16} weight="bold" className={`transition-transform ${navOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className={`${navOpen ? 'block' : 'hidden'} lg:block mt-3 lg:mt-0`}>
          <DocsNav docs={docs} onNavigate={() => setNavOpen(false)} />
        </div>
      </div>

      {/* Orta: içerik */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={doc.slug}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="min-w-0"
        >
          <div className="flex items-center gap-2 mb-4">
            <nav aria-label="Konum" className="flex items-center gap-1.5 text-xs font-semibold text-theme-muted flex-1 min-w-0">
              <Link to="/docs" className="hover:text-theme-deep hover:underline underline-offset-4">Dokümantasyon</Link>
              <CaretRight size={11} weight="bold" aria-hidden="true" />
              <span>{categoryName(doc.category)}</span>
            </nav>
            <Link to={editHref} className="btn-secondary min-h-[2.375rem] px-3 text-sm"><PencilSimple size={16} weight="bold" /> {doc.myPendingRevisionId ? 'Önerimi düzenle' : 'Düzenle'}</Link>
            <button type="button" onClick={e => setMoreAnchor(e.currentTarget)} className="icon-btn border border-theme-light/60" aria-label="Diğer işlemler" aria-haspopup="menu">
              <DotsThree size={20} weight="bold" />
            </button>
            <Menu open={!!moreAnchor} anchor={moreAnchor} onClose={() => setMoreAnchor(null)} label="Doküman işlemleri">
              <MenuItem icon={ClockCounterClockwise} onSelect={() => { setMoreAnchor(null); setHistoryOpen(true); }}>Sürüm geçmişi</MenuItem>
              <MenuItem icon={FilePlus} onSelect={() => navigate(`/docs/yeni?kategori=${doc.category}`)}>Bu kategoriye yeni doküman</MenuItem>
              {isAdmin && (
                <>
                  <MenuDivider />
                  <MenuItem icon={Trash} tone="danger" onSelect={() => { setMoreAnchor(null); setConfirmDelete(true); }}>Dokümanı sil…</MenuItem>
                </>
              )}
            </Menu>
          </div>

          {confirmDelete && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 mb-5 text-sm font-semibold text-danger-ink">
              <Warning size={20} weight="fill" className="shrink-0" />
              <span className="flex-1 min-w-[12.5rem]">“{doc.title}” geçmişi ve bekleyen önerileriyle birlikte silinecek. Bu geri alınamaz.</span>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary min-h-[2.25rem] px-3 text-xs">Vazgeç</button>
              <button
                type="button"
                onClick={() => remove.mutate(doc.id, { onSuccess: () => navigate('/docs', { replace: true }) })}
                disabled={remove.isPending}
                className="min-h-[2.25rem] px-3 rounded-xl text-xs font-bold bg-danger-solid text-white hover:bg-danger-solid-hover"
              >
                Evet, sil
              </button>
            </div>
          )}

          {doc.myPendingRevisionId && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-theme-light bg-theme-lightest/70 p-4 mb-5 text-sm">
              <HourglassMedium size={20} weight="duotone" className="text-theme-deep shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-[12.5rem] font-semibold text-theme-text">Bu doküman için gönderdiğiniz değişiklik yönetici onayı bekliyor. Onaylanana kadar herkes bu hâlini görür.</span>
              <Link to={`/docs/oneri/${doc.myPendingRevisionId}`} className="btn-secondary min-h-[2.25rem] px-3 text-xs">Önerimi gör</Link>
            </div>
          )}
          {isAdmin && pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-theme-light bg-theme-lightest/70 p-4 mb-5 text-sm">
              <HourglassMedium size={20} weight="duotone" className="text-theme-deep shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-[12.5rem] font-semibold text-theme-text">
                Bu dokümanda {pending.length} değişiklik önerisi onay bekliyor ({pending.map(p => p.authorName ?? '?').join(', ')}).
              </span>
              <Link to={`/docs/oneri/${pending[0].id}`} className="btn-primary min-h-[2.25rem] px-3 text-xs">İncele</Link>
            </div>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-theme-text">{doc.title}</h1>
          {doc.summary && <p className="text-lg text-theme-muted font-medium mt-3 leading-relaxed">{doc.summary}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 pb-6 border-b border-theme-light/50 text-sm text-theme-muted font-semibold">
            <span className="flex items-center gap-2">
              <Avatar user={author ?? { fullName: doc.updatedByName ?? 'DevHub', avatarColor: '', status: null }} size="xs" />
              <span className="text-theme-text">{doc.updatedByName ?? 'DevHub'}</span>
            </span>
            <span>{longDate.format(parseServerDate(doc.updatedAt))} tarihinde güncellendi</span>
            <button type="button" onClick={() => setHistoryOpen(true)} className="flex items-center gap-1 hover:text-theme-deep underline-offset-4 hover:underline" title="Sürüm geçmişini aç">
              <ClockCounterClockwise size={14} weight="bold" aria-hidden="true" /> Sürüm {doc.version}
            </button>
            <span className="flex items-center gap-1"><Clock size={14} weight="bold" aria-hidden="true" /> {readMinutes(doc.plainText)} dk okuma</span>
            {doc.tags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {doc.tags.map(t => <span key={t} className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-theme-lightest text-theme-deep">#{t}</span>)}
              </span>
            )}
          </div>

          <div className="mt-2">
            <DocContent doc={doc.content} />
          </div>

          <p className="mt-10 text-xs text-theme-muted font-semibold">
            Bir hata mı gördünüz? <Link to={editHref} className="text-theme-deep underline underline-offset-4">Bu sayfayı düzenleyin</Link>
            {!isAdmin && ' - değişikliğiniz yönetici onayından sonra yayınlanır.'}
            {doc.createdByName && ` · İlk yazan: ${doc.createdByName}, ${formatDate(toIsoDay(parseServerDate(doc.createdAt)))}`}
          </p>

          <nav aria-label="Önceki ve sonraki doküman" className="grid sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-theme-light/50">
            {prev ? (
              <Link to={`/docs/${prev.slug}`} className="card p-4 hover:border-theme-dark/30 transition-colors group">
                <span className="text-xs font-bold text-theme-muted flex items-center gap-1"><CaretLeft size={12} weight="bold" aria-hidden="true" /> Önceki</span>
                <span className="block text-sm font-bold text-theme-text mt-1 group-hover:text-theme-deep">{prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`/docs/${next.slug}`} className="card p-4 hover:border-theme-dark/30 transition-colors group text-right">
                <span className="text-xs font-bold text-theme-muted flex items-center gap-1 justify-end">Sonraki <CaretRight size={12} weight="bold" aria-hidden="true" /></span>
                <span className="block text-sm font-bold text-theme-text mt-1 group-hover:text-theme-deep">{next.title}</span>
              </Link>
            )}
          </nav>
        </motion.article>
      </AnimatePresence>

      {/* Sağ: bu sayfada */}
      <aside className="hidden xl:block sticky top-6 self-start pt-1" aria-label="Bu sayfada">
        <Toc key={doc.slug + doc.version} items={toc} />
      </aside>

      <DocHistoryModal doc={doc} open={historyOpen} onClose={() => setHistoryOpen(false)} isAdmin={isAdmin} />
    </div>
  );
}

function DocsNav({ docs, onNavigate }: { docs: DocSummary[]; onNavigate: () => void }) {
  const [filter, setFilter] = useState('');
  const q = trLower(filter.trim());
  const visible = q ? new Set(search(docs, filter).map(r => r.doc.slug)) : null;

  return (
    <nav aria-label="Dokümanlar" className="space-y-5">
      <div className="relative">
        <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrele…"
          aria-label="Dokümanları filtrele"
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface border border-theme-light/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-medium"
        />
        {filter && (
          <button type="button" onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-deep rounded" aria-label="Filtreyi temizle">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>
      {DOC_CATEGORIES.map(c => {
        const list = docs.filter(d => d.category === c.id && (!visible || visible.has(d.slug)));
        if (!list.length) return null;
        return (
          <div key={c.id}>
            <p className="eyebrow flex items-center gap-1.5 mb-1.5 px-2"><c.icon size={13} weight="bold" aria-hidden="true" /> {c.name}</p>
            <ul className="space-y-0.5">
              {list.map(d => (
                <li key={d.slug}>
                  <NavLink
                    to={`/docs/${d.slug}`}
                    onClick={onNavigate}
                    className={({ isActive }) => `block px-3 py-1.5 rounded-xl text-sm transition-colors ${isActive ? 'bg-theme-lightest text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-surface'}`}
                  >
                    {d.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {visible && visible.size === 0 && <p className="text-sm text-theme-muted font-medium px-2">Eşleşen doküman yok.</p>}
      <Link to="/docs/yeni" onClick={onNavigate} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-theme-deep hover:bg-surface transition-colors">
        <Plus size={15} weight="bold" /> Yeni doküman
      </Link>
    </nav>
  );
}

/** "Bu sayfada": okunan bölüm vurgulanır (kaydırma alanı main olduğu için gözlemcinin kökü o). */
function Toc({ items }: { items: { id: string; text: string; level: number }[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const root = document.getElementById('main-scroll-container');
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!root || !els.length) return;
    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { root, rootMargin: '0px 0px -70% 0px' });
    els.forEach(e => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  if (!items.length) return null;
  return (
    <div>
      <p className="eyebrow mb-3">Bu sayfada</p>
      <ul className="space-y-1 border-l-2 border-theme-light/60">
        {items.map(i => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={e => {
                e.preventDefault();
                document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', `#${i.id}`);
                setActive(i.id);
              }}
              className={`block -ml-0.5 border-l-2 py-1 text-[0.8125rem] leading-snug transition-colors ${i.level === 3 ? 'pl-6' : 'pl-3'} ${
                active === i.id ? 'border-theme-deep text-theme-deep font-bold' : 'border-transparent text-theme-muted font-medium hover:text-theme-deep'
              }`}
              aria-current={active === i.id ? 'location' : undefined}
            >
              {i.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
