import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, PencilSimple, PaperPlaneTilt, RocketLaunch, X, Warning, Info, ClockCounterClockwise, Lightbulb } from '@phosphor-icons/react';
import DocEditor from '../components/docs/editor/DocEditor';
import DocContent from '../components/docs/DocContent';
import Modal from '../components/ui/Modal';
import { EmptyState, Skeleton } from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';
import { usePageMenu } from '../components/layout/ContextMenu';
import { DOC_CATEGORIES, EMPTY_DOC, categoryName, nodeText } from '../docs';
import { useDoc, useDocRevision, useSubmitDoc } from '../hooks/docs';
import type { DocDraft } from '../hooks/docs';
import { useMe } from '../hooks/api';
import { errorMessage } from '../services/api';
import { timeAgo } from '../lib/format';
import type { DocNode } from '../types';
import axios from 'axios';

/**
 * Doküman yazma / düzenleme. /docs/yeni (?kategori=…) yeni doküman, /docs/:slug/duzenle mevcut doküman;
 * ?oneri=ID kişinin bekleyen önerisinden devam eder (gönderince eskisinin yerine geçer).
 */
export default function DocEdit() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const proposalId = Number(params.get('oneri')) || null;
  const doc = useDoc(slug);
  const proposal = useDocRevision(proposalId);

  if ((slug && doc.isLoading) || (proposalId && proposal.isLoading)) {
    return <div className="space-y-4 max-w-4xl"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-14" /><Skeleton className="h-[30rem]" /></div>;
  }
  if (slug && !doc.data) {
    return <EmptyState icon={Warning} title="Doküman bulunamadı" description="Silinmiş olabilir." action={<Link to="/docs" className="btn-primary">Dokümantasyona dön</Link>} />;
  }
  const p = proposal.data && proposal.data.status === 'BEKLIYOR' && proposal.data.content ? proposal.data : null;
  const d = doc.data;
  const initial: DocDraft = p
    ? { title: p.title, summary: p.summary ?? '', category: p.category, tags: p.tags, content: p.content! }
    : d
      ? { title: d.title, summary: d.summary ?? '', category: d.category, tags: d.tags, content: d.content }
      : { title: '', summary: '', category: DOC_CATEGORIES.some(c => c.id === params.get('kategori')) ? params.get('kategori')! : DOC_CATEGORIES[0].id, tags: [], content: EMPTY_DOC };

  return (
    <EditForm
      key={`${slug ?? 'yeni'}-${p?.id ?? 0}`}
      initial={initial}
      docId={d?.id}
      slug={slug}
      baseVersion={p?.baseVersion ?? d?.version}
      currentVersion={d?.version}
      proposalId={p?.id}
    />
  );
}

interface StoredDraft extends DocDraft { savedAt: number }

const draftKey = (slug: string | undefined, proposalId: number | undefined) => `devhub.docDraft.${slug ?? 'yeni'}${proposalId ? `.${proposalId}` : ''}`;

function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

const same = (a: DocDraft, b: DocDraft) => JSON.stringify([a.title, a.summary, a.category, a.tags, a.content]) === JSON.stringify([b.title, b.summary, b.category, b.tags, b.content]);
const isEmptyContent = (c: DocNode) => !nodeText(c).trim() && !JSON.stringify(c).match(/"type":"(image|table|horizontalRule)"/);

function EditForm({ initial, docId, slug, baseVersion, currentVersion, proposalId }: {
  initial: DocDraft; docId?: number; slug?: string; baseVersion?: number; currentVersion?: number; proposalId?: number;
}) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const navigate = useNavigate();
  const toast = useToast();
  const submit = useSubmitDoc();
  const key = draftKey(slug, proposalId);

  const [draft, setDraft] = useState<DocDraft>(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [editorInitial, setEditorInitial] = useState<DocNode>(initial.content);
  const [stored, setStored] = useState<StoredDraft | null>(() => {
    const s = readDraft(key);
    return s && !same(s, initial) ? s : null;
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [note, setNote] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const done = useRef(false);

  const dirty = useMemo(() => !same(draft, initial), [draft, initial]);
  const set = <K extends keyof DocDraft>(k: K, v: DocDraft[K]) => setDraft(d => ({ ...d, [k]: v }));

  // Taslak bu tarayıcıda saklanır: sayfa kapansa da yazılanlar kaybolmaz.
  useEffect(() => {
    if (!dirty || stored) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
        setSavedAt(Date.now());
      } catch { /* depolama kapalıysa taslak yalnızca sayfada kalır */ }
    }, 700);
    return () => clearTimeout(t);
  }, [draft, dirty, key, stored]);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { if (!done.current) e.preventDefault(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const clearDraft = () => { try { localStorage.removeItem(key); } catch { /* yok say */ } };

  const restoreDraft = () => {
    if (!stored) return;
    setDraft({ title: stored.title, summary: stored.summary, category: stored.category, tags: stored.tags, content: stored.content });
    setEditorInitial(stored.content);
    setEditorKey(k => k + 1);
    setStored(null);
  };

  const validate = () => {
    const e: typeof errors = {};
    if (draft.title.trim().length < 3) e.title = 'Başlık en az 3 karakter olmalı.';
    if (isEmptyContent(draft.content)) e.content = 'Doküman boş olamaz; birkaç satır yazın.';
    setErrors(e);
    if (e.title) document.getElementById('doc-title')?.focus();
    return !e.title && !e.content;
  };

  const openSend = () => {
    if (!dirty && docId) return toast.error('Henüz bir değişiklik yapmadınız.');
    if (validate()) { setConflict(null); setSendOpen(true); }
  };

  const send = (force = false) => {
    submit.mutate(
      {
        ...draft, title: draft.title.trim(), summary: draft.summary.trim(), docId, baseVersion, note: note.trim() || undefined, replaces: proposalId, force,
      },
      {
        onSuccess: rev => {
          done.current = true;
          clearDraft();
          setSendOpen(false);
          if (rev.status === 'ONAYLANDI') {
            toast.success(docId ? 'Değişiklikler yayınlandı' : 'Doküman yayınlandı');
            navigate(`/docs/${rev.docSlug ?? slug ?? ''}`, { replace: true });
          } else {
            toast.success('Öneriniz yöneticiye gönderildi. Onaylanınca bildirim alacaksınız.');
            navigate(docId ? `/docs/${slug}` : `/docs/oneri/${rev.id}`, { replace: true });
          }
        },
        onError: err => {
          if (axios.isAxiosError(err) && err.response?.status === 409 && isAdmin) setConflict(errorMessage(err));
          else toast.error(errorMessage(err));
        },
      },
    );
  };

  const cancel = () => navigate(slug ? `/docs/${slug}` : '/docs');

  usePageMenu([
    { label: preview ? 'Düzenlemeye dön' : 'Önizleme', icon: preview ? PencilSimple : Eye, onSelect: () => setPreview(p => !p) },
    { label: isAdmin ? 'Yayınla' : 'Onaya gönder', icon: isAdmin ? RocketLaunch : PaperPlaneTilt, onSelect: openSend },
    { label: 'Vazgeç', icon: X, onSelect: cancel },
  ]);

  const outdated = proposalId && baseVersion !== undefined && currentVersion !== undefined && baseVersion !== currentVersion;

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={slug ? `/docs/${slug}` : '/docs'} className="icon-btn border border-theme-light/60" aria-label="Geri dön"><ArrowLeft size={18} weight="bold" /></Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{docId ? (proposalId ? 'Önerimi düzenle' : 'Dokümanı düzenle') : (proposalId ? 'Yeni doküman önerim' : 'Yeni doküman')}</p>
          <p className="text-sm font-semibold text-theme-muted truncate">{docId ? initial.title : 'Başlık, kategori ve içeriği doldurun'}</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-2xl border border-theme-light bg-theme-lightest/60 p-4 mb-5 text-sm font-medium text-theme-text">
          <Info size={20} weight="duotone" className="text-theme-deep shrink-0 mt-0.5" aria-hidden="true" />
          <span>Değişiklikleriniz bir <b>öneri</b> olarak yöneticiye gider; onaylanana kadar herkes dokümanın şu anki hâlini görür. Onaylanınca ya da reddedilince bildirim alırsınız.</span>
        </div>
      )}
      {outdated && (
        <div className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4 mb-5 text-sm font-medium text-warn-ink">
          <Warning size={20} weight="fill" className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>Öneriniz hazırlandıktan sonra doküman güncellendi (sürüm {baseVersion} → {currentVersion}). Gönderirseniz yönetici aradaki farkı görecek; dilerseniz dokümanın son hâlini açıp değişikliğinizi yeniden yapın.</span>
        </div>
      )}
      {stored && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-theme-light bg-surface p-4 mb-5 text-sm shadow-soft">
          <ClockCounterClockwise size={20} weight="duotone" className="text-theme-deep shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-[13.75rem] font-semibold text-theme-text">Bu tarayıcıda gönderilmemiş bir taslağınız var ({timeAgo(new Date(stored.savedAt).toISOString().slice(0, 19))} kaydedildi).</span>
          <button type="button" onClick={() => { clearDraft(); setStored(null); }} className="btn-secondary min-h-[2.25rem] px-3 text-xs">Sil</button>
          <button type="button" onClick={restoreDraft} className="btn-primary min-h-[2.25rem] px-3 text-xs">Taslaktan devam et</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem] mb-5">
        <div className="space-y-3">
          <div>
            <label htmlFor="doc-title" className="sr-only">Başlık</label>
            <input
              id="doc-title"
              value={draft.title}
              onChange={e => { set('title', e.target.value); if (errors.title) setErrors(x => ({ ...x, title: undefined })); }}
              placeholder="Doküman başlığı"
              maxLength={200}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'doc-title-err' : undefined}
              className="w-full bg-transparent text-2xl font-bold tracking-tight text-theme-text placeholder:text-theme-muted/50 focus:outline-none border-b-2 border-transparent focus:border-theme-light pb-1"
            />
            {errors.title && <p id="doc-title-err" className="text-sm font-semibold text-danger mt-1">{errors.title}</p>}
          </div>
          <div>
            <label htmlFor="doc-summary" className="sr-only">Özet</label>
            <textarea
              id="doc-summary"
              value={draft.summary}
              onChange={e => set('summary', e.target.value)}
              placeholder="Kısa özet: bu doküman ne anlatıyor? (listede ve aramada görünür)"
              rows={2}
              maxLength={500}
              className="w-full resize-none bg-transparent text-lg text-theme-muted font-medium placeholder:text-theme-muted/50 focus:outline-none rounded-xl focus:bg-surface/60 px-0 py-1"
            />
          </div>
        </div>
        <div className="card p-4 space-y-3 self-start">
          <div>
            <label htmlFor="doc-category" className="eyebrow block mb-1.5">Kategori</label>
            <select id="doc-category" value={draft.category} onChange={e => set('category', e.target.value)} className="input py-2.5">
              {DOC_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <TagInput tags={draft.tags} onChange={t => set('tags', t)} />
        </div>
      </div>

      {preview ? (
        <div className="card p-5 sm:p-10">
          <p className="eyebrow mb-2">Önizleme · {categoryName(draft.category)}</p>
          <h2 className="text-2xl font-bold tracking-tight text-theme-text">{draft.title.trim() || 'Başlıksız doküman'}</h2>
          {draft.summary.trim() && <p className="text-lg text-theme-muted font-medium mt-3">{draft.summary}</p>}
          <hr className="my-6 border-theme-light/50" />
          <DocContent doc={draft.content} />
        </div>
      ) : (
        <>
          <DocEditor key={editorKey} initial={editorInitial} onChange={c => { set('content', c); if (errors.content) setErrors(x => ({ ...x, content: undefined })); }} />
          {errors.content && <p role="alert" className="text-sm font-semibold text-danger mt-2">{errors.content}</p>}
          <p className="flex items-start gap-2 text-xs text-theme-muted font-semibold mt-3">
            <Lightbulb size={15} weight="bold" className="shrink-0 mt-px" aria-hidden="true" />
            <span>Boş satıra <kbd className="px-1 rounded bg-theme-lightest text-theme-deep">/</kbd> yazarak blok ekleyin. Görselleri sürükleyip bırakabilir ya da yapıştırabilirsiniz. Kısayollar: <kbd className="px-1 rounded bg-theme-lightest">##</kbd> + boşluk başlık, <kbd className="px-1 rounded bg-theme-lightest">-</kbd> + boşluk liste, <kbd className="px-1 rounded bg-theme-lightest">```</kbd> kod bloğu.</span>
          </p>
        </>
      )}

      {/* Alt eylem çubuğu: uzun dokümanda da hep erişilebilir */}
      <div className="sticky bottom-4 z-30 mt-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface/95 backdrop-blur border border-theme-light/70 shadow-float px-4 py-3">
            <span className="text-xs text-theme-muted font-semibold flex-1 min-w-[10rem]" aria-live="polite">
              {dirty ? (savedAt ? 'Taslak bu tarayıcıda saklandı' : 'Değişiklikler kaydedilmedi') : 'Değişiklik yok'}
            </span>
            <button type="button" onClick={cancel} className="btn-secondary min-h-[2.5rem] px-4 text-sm">Vazgeç</button>
            <button type="button" onClick={() => setPreview(p => !p)} className="btn-secondary min-h-[2.5rem] px-4 text-sm" aria-pressed={preview}>
              {preview ? <><PencilSimple size={16} weight="bold" /> Düzenle</> : <><Eye size={16} weight="bold" /> Önizleme</>}
            </button>
            <button type="button" onClick={openSend} className="btn-primary min-h-[2.5rem] px-4 text-sm">
              {isAdmin ? <><RocketLaunch size={16} weight="bold" /> Yayınla</> : <><PaperPlaneTilt size={16} weight="bold" /> Onaya gönder</>}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        size="sm"
        title={isAdmin ? (docId ? 'Değişiklikleri yayınla' : 'Dokümanı yayınla') : 'Onaya gönder'}
        description={isAdmin ? 'Değişiklik hemen herkese görünür ve sürüm geçmişine eklenir.' : 'Yönetici değişikliklerinizi görüp onaylayınca yayınlanır.'}
        onSubmit={e => { e.preventDefault(); send(false); }}
        footer={
          conflict ? (
            <>
              <button type="button" onClick={() => setSendOpen(false)} className="btn-secondary">Vazgeç</button>
              <button type="button" onClick={() => send(true)} disabled={submit.isPending} className="btn-primary">Yine de yayınla</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSendOpen(false)} className="btn-secondary">Vazgeç</button>
              <button type="submit" disabled={submit.isPending} className="btn-primary">
                {submit.isPending ? 'Gönderiliyor…' : isAdmin ? 'Yayınla' : 'Gönder'}
              </button>
            </>
          )
        }
      >
        {conflict ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4 text-sm font-medium text-warn-ink">
            <Warning size={20} weight="fill" className="shrink-0 mt-0.5" />
            <span>{conflict}</span>
          </div>
        ) : (
          <div>
            <label htmlFor="doc-note" className="block text-sm font-bold text-theme-text mb-1.5">
              {isAdmin ? 'Değişiklik notu' : 'Ne değiştirdiniz?'} <span className="font-medium text-theme-muted">(isteğe bağlı)</span>
            </label>
            <textarea
              id="doc-note"
              data-autofocus
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={docId ? 'ör. Kurulum adımlarına Windows komutlarını ekledim' : 'ör. Yeni başlayanlar için VPN kurulumu'}
              className="input resize-none"
            />
            <p className="text-xs text-theme-muted font-semibold mt-1.5">{isAdmin ? 'Sürüm geçmişinde görünür.' : 'Yönetici bu notu inceleme sırasında görür.'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Etiketler: yazıp Enter veya virgül; Backspace son etiketi siler. En fazla 8. */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [value, setValue] = useState('');
  const add = () => {
    const t = value.trim().replace(/^#/, '').replace(/,/g, ' ').slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 8) onChange([...tags, t]);
    setValue('');
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !value && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div>
      <label htmlFor="doc-tags" className="eyebrow block mb-1.5">Etiketler</label>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl border border-theme-light/70 bg-surface focus-within:ring-2 focus-within:ring-theme-medium">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 text-xs font-bold pl-2 pr-1 py-1 rounded-full bg-theme-lightest text-theme-deep">
            #{t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="rounded-full p-0.5 hover:bg-theme-light" aria-label={`${t} etiketini kaldır`}>
              <X size={11} weight="bold" />
            </button>
          </span>
        ))}
        <input
          id="doc-tags"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={tags.length ? '' : 'ör. git, kurulum'}
          disabled={tags.length >= 8}
          className="flex-1 min-w-[5rem] bg-transparent text-sm font-medium focus:outline-none px-1"
        />
      </div>
      <p className="text-[0.6875rem] text-theme-muted font-semibold mt-1">Enter ile ekleyin · aramada kullanılır</p>
    </div>
  );
}
