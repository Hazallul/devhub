import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MagnifyingGlass, CaretRight, CaretLeft, CaretDown, Clock, BookOpenText, ListBullets, X } from '@phosphor-icons/react';
import { PageHeader, Avatar, EmptyState } from '../components/ui/primitives';
import Markdown from '../components/docs/Markdown';
import { DOCS, DOC_CATEGORIES, docBySlug } from '../docs';
import type { DocArticle } from '../docs';
import { useUsers } from '../hooks/api';
import { formatDate, trLower } from '../lib/format';

const longDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const categoryName = (id: string) => DOC_CATEGORIES.find(c => c.id === id)?.name ?? id;

/** Arama: başlık, özet, etiket ve metinde geçen dokümanlar; başlık eşleşmesi öne çıkar. */
function search(query: string) {
  const q = trLower(query.trim());
  if (!q) return [];
  return DOCS
    .map(d => {
      const inTitle = trLower(d.title).includes(q);
      const inMeta = trLower(`${d.summary} ${d.tags.join(' ')}`).includes(q);
      const idx = trLower(d.text).indexOf(q);
      if (!inTitle && !inMeta && idx < 0) return null;
      const snippet = idx >= 0 ? d.text.slice(Math.max(0, idx - 60), idx + q.length + 80) : d.summary;
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
  const doc = docBySlug(slug);
  if (!doc) {
    return (
      <EmptyState icon={BookOpenText} title="Doküman bulunamadı" description="Aradığınız sayfa taşınmış veya silinmiş olabilir."
        action={<Link to="/docs" className="btn-primary">Dokümantasyona dön</Link>} />
    );
  }
  return <DocView doc={doc} />;
}

// ---------------- Ana sayfa ----------------

function DocsHome() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => search(query), [query]);
  const recent = useMemo(() => [...DOCS].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4), []);

  return (
    <>
      <PageHeader eyebrow="Dokümantasyon" title="Mühendislik El Kitabı" description="Süreçlerimiz, mimarimiz ve kalite standartlarımız tek yerde. Yeni başladıysanız Başlarken bölümünden başlayın." />

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
          </motion.section>
        ) : (
          <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pb-10 space-y-10">
            <div className="grid md:grid-cols-2 gap-5">
              {DOC_CATEGORIES.map(c => {
                const docs = DOCS.filter(d => d.category === c.id);
                return (
                  <section key={c.id} className="card p-6" aria-labelledby={`cat-${c.id}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-11 h-11 rounded-2xl bg-theme-lightest text-theme-deep flex items-center justify-center"><c.icon size={22} weight="duotone" aria-hidden="true" /></span>
                      <div>
                        <h2 id={`cat-${c.id}`} className="text-lg font-bold text-theme-text">{c.name}</h2>
                        <p className="text-xs text-theme-muted font-semibold">{docs.length} doküman</p>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {docs.map(d => (
                        <li key={d.slug}>
                          <Link to={`/docs/${d.slug}`} className="group flex items-start gap-3 p-3 -mx-3 rounded-2xl hover:bg-theme-cream transition-colors">
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-theme-text group-hover:text-theme-deep">{d.title}</span>
                              <span className="block text-xs text-theme-muted font-medium mt-0.5 line-clamp-2">{d.summary}</span>
                            </span>
                            <CaretRight size={16} weight="bold" className="text-theme-muted mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <section aria-labelledby="recent-docs">
              <h2 id="recent-docs" className="eyebrow mb-3">Son güncellenenler</h2>
              <ul className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {recent.map(d => (
                  <li key={d.slug}>
                    <Link to={`/docs/${d.slug}`} className="card block p-4 h-full hover:shadow-diffusion transition-shadow">
                      <p className="text-sm font-bold text-theme-text line-clamp-2">{d.title}</p>
                      <p className="text-xs text-theme-muted font-semibold mt-2">{d.author} · {formatDate(d.updated)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------- Doküman ----------------

function DocView({ doc }: { doc: DocArticle }) {
  const location = useLocation();
  const { data: users } = useUsers();
  const [navOpen, setNavOpen] = useState(false);
  const author = users?.find(u => u.fullName === doc.author);
  const index = DOCS.indexOf(doc);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];
  const toc = useMemo(
    () => doc.blocks.flatMap(b => (b.type === 'heading' ? [{ id: b.id, text: b.text.replace(/`|\*/g, ''), level: b.level }] : [])),
    [doc],
  );

  // Adresteki #bölüm varsa oraya kaydır (sayfa değişiminde yerleşim başa kaydırdıktan sonra).
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [doc.slug, location.hash]);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_190px] pb-10">
      {/* Sol: kategori ağacı (mobilde açılır kapanır) */}
      <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-72px-5rem)] lg:overflow-y-auto scrollbar-thin lg:-mt-2 lg:pt-2">
        <button type="button" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen} className="lg:hidden btn-secondary w-full justify-between">
          <span className="flex items-center gap-2"><ListBullets size={18} weight="bold" /> Tüm dokümanlar</span>
          <CaretDown size={16} weight="bold" className={`transition-transform ${navOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className={`${navOpen ? 'block' : 'hidden'} lg:block mt-3 lg:mt-0`}>
          <DocsNav onNavigate={() => setNavOpen(false)} />
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
          <nav aria-label="Konum" className="flex items-center gap-1.5 text-xs font-semibold text-theme-muted mb-4">
            <Link to="/docs" className="hover:text-theme-deep hover:underline underline-offset-4">Dokümantasyon</Link>
            <CaretRight size={11} weight="bold" aria-hidden="true" />
            <span>{categoryName(doc.category)}</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-theme-text">{doc.title}</h1>
          <p className="text-lg text-theme-muted font-medium mt-3 leading-relaxed">{doc.summary}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 pb-6 border-b border-theme-light/50 text-sm text-theme-muted font-semibold">
            <span className="flex items-center gap-2">
              {author ? <Avatar user={author} size="xs" /> : <Avatar user={{ fullName: doc.author || '?', avatarColor: '', status: null }} size="xs" />}
              <span className="text-theme-text">{doc.author}</span>
            </span>
            {doc.updated && <span>{longDate.format(new Date(`${doc.updated}T00:00:00`))} tarihinde güncellendi</span>}
            <span className="flex items-center gap-1"><Clock size={14} weight="bold" aria-hidden="true" /> {doc.readMinutes} dk okuma</span>
            {doc.tags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {doc.tags.map(t => <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-theme-lightest text-theme-deep">#{t}</span>)}
              </span>
            )}
          </div>

          <div className="mt-2">
            <Markdown blocks={doc.blocks} />
          </div>

          <nav aria-label="Önceki ve sonraki doküman" className="grid sm:grid-cols-2 gap-4 mt-12 pt-6 border-t border-theme-light/50">
            {prev ? (
              <Link to={`/docs/${prev.slug}`} className="card p-4 hover:shadow-diffusion transition-shadow group">
                <span className="text-xs font-bold text-theme-muted flex items-center gap-1"><CaretLeft size={12} weight="bold" aria-hidden="true" /> Önceki</span>
                <span className="block text-sm font-bold text-theme-text mt-1 group-hover:text-theme-deep">{prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`/docs/${next.slug}`} className="card p-4 hover:shadow-diffusion transition-shadow group text-right">
                <span className="text-xs font-bold text-theme-muted flex items-center gap-1 justify-end">Sonraki <CaretRight size={12} weight="bold" aria-hidden="true" /></span>
                <span className="block text-sm font-bold text-theme-text mt-1 group-hover:text-theme-deep">{next.title}</span>
              </Link>
            )}
          </nav>
        </motion.article>
      </AnimatePresence>

      {/* Sağ: bu sayfada */}
      <aside className="hidden xl:block sticky top-6 self-start pt-1" aria-label="Bu sayfada">
        <Toc key={doc.slug} items={toc} />
      </aside>
    </div>
  );
}

function DocsNav({ onNavigate }: { onNavigate: () => void }) {
  const [filter, setFilter] = useState('');
  const q = trLower(filter.trim());
  const visible = q ? new Set(search(filter).map(r => r.doc.slug)) : null;

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
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-theme-light/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-medium"
        />
        {filter && (
          <button type="button" onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-deep rounded" aria-label="Filtreyi temizle">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>
      {DOC_CATEGORIES.map(c => {
        const docs = DOCS.filter(d => d.category === c.id && (!visible || visible.has(d.slug)));
        if (!docs.length) return null;
        return (
          <div key={c.id}>
            <p className="eyebrow flex items-center gap-1.5 mb-1.5 px-2"><c.icon size={13} weight="bold" aria-hidden="true" /> {c.name}</p>
            <ul className="space-y-0.5">
              {docs.map(d => (
                <li key={d.slug}>
                  <NavLink
                    to={`/docs/${d.slug}`}
                    onClick={onNavigate}
                    className={({ isActive }) => `block px-3 py-1.5 rounded-xl text-sm transition-colors ${isActive ? 'bg-theme-lightest text-theme-deep font-bold' : 'text-theme-muted font-medium hover:text-theme-deep hover:bg-white'}`}
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
              className={`block -ml-0.5 border-l-2 py-1 text-[13px] leading-snug transition-colors ${i.level === 3 ? 'pl-6' : 'pl-3'} ${
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
