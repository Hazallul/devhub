import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, ArrowDown, PencilSimple, Trash, Plus, Lightning, BookOpenText, Compass, Link as LinkIcon, X } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import Combobox from '../ui/Combobox';
import type { ComboOption } from '../ui/Combobox';
import { Skeleton } from '../ui/primitives';
import { useDocs } from '../../hooks/docs';
import {
  useOnboardingSteps, useSaveOnboardingStep, useDeleteOnboardingStep, useReorderOnboardingSteps, RULE_LABEL,
} from '../../hooks/onboarding';
import type { StepInput } from '../../hooks/onboarding';
import type { OnboardingRule, OnboardingStep } from '../../types';

/** Bağlantı seçicide sunulan sayfalar (dokümanlar ayrıca listelenir) */
const PAGES: { path: string; label: string }[] = [
  { path: '/settings', label: 'Ayarlar' },
  { path: '/team', label: 'Çalışanlar' },
  { path: '/projects', label: 'Projeler' },
  { path: '/tasks', label: 'Görevler' },
  { path: '/leaves', label: 'İzinler' },
  { path: '/todo', label: 'Yapılacaklarım' },
  { path: '/docs', label: 'Dokümantasyon' },
];

const RULES: { value: '' | OnboardingRule; label: string }[] = [
  { value: '', label: 'Kişi kendisi işaretler' },
  { value: 'DOKUMAN', label: 'Bağlı dokümanı açınca' },
  { value: 'SIFRE', label: 'Kendi şifresini belirleyince' },
  { value: 'ILETISIM', label: 'İletişim bilgisi ekleyince' },
];

const EMPTY: StepInput = { title: '', description: null, link: null, autoRule: null };

/**
 * Yönetici: işe başlangıç adımlarının şablonu. Değişiklik, listesi açık herkesin kartına hemen yansır;
 * silinen adımın ilerlemesi de silinir.
 */
export default function OnboardingStepsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: steps, isLoading } = useOnboardingSteps(open);
  const reorder = useReorderOnboardingSteps();
  const remove = useDeleteOnboardingStep();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const move = (index: number, dir: -1 | 1) => {
    if (!steps) return;
    const ids = steps.map(s => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <Modal open={open} onClose={() => { setEditing(null); setConfirmDelete(null); onClose(); }} size="lg" title="İşe başlangıç adımları"
      description="Yeni kullanıcılar Genel Bakış'ta bu listeyi görür. Değişiklikler listesi açık olan herkese hemen yansır.">
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {(steps ?? []).map((s, i) => (
              <motion.li key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="rounded-2xl border border-theme-light/60 bg-surface">
                {editing === s.id ? (
                  <StepForm initial={s} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex items-start gap-3 p-3">
                    <span className="w-7 h-7 rounded-lg bg-theme-lightest text-theme-deep text-xs font-bold tabular flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{s.title}</p>
                      {s.description && <p className="text-xs text-theme-muted mt-0.5 line-clamp-2">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[0.6875rem] font-semibold text-theme-muted">
                        {s.link && <span className="inline-flex items-center gap-1"><LinkIcon size={12} weight="bold" /> {s.link}</span>}
                        <span className="inline-flex items-center gap-1">
                          {s.autoRule ? <><Lightning size={12} weight="fill" className="text-theme-dark" /> {RULE_LABEL[s.autoRule]}</> : 'Kişi işaretler'}
                        </span>
                      </div>
                    </div>
                    {confirmDelete === s.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-semibold text-danger">Silinsin mi?</span>
                        <button type="button" onClick={() => remove.mutate(s.id, { onSettled: () => setConfirmDelete(null) })} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-danger-solid text-white hover:bg-danger-solid-hover">Sil</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="icon-btn w-8 h-8" aria-label="Vazgeç"><X size={14} weight="bold" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} className="icon-btn w-8 h-8 disabled:opacity-30" aria-label={`${s.title}: yukarı taşı`}><ArrowUp size={15} weight="bold" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === (steps?.length ?? 0) - 1 || reorder.isPending} className="icon-btn w-8 h-8 disabled:opacity-30" aria-label={`${s.title}: aşağı taşı`}><ArrowDown size={15} weight="bold" /></button>
                        <button type="button" onClick={() => { setEditing(s.id); setConfirmDelete(null); }} className="icon-btn w-8 h-8" aria-label={`${s.title}: düzenle`}><PencilSimple size={15} weight="bold" /></button>
                        <button type="button" onClick={() => setConfirmDelete(s.id)} className="icon-btn w-8 h-8 hover:text-danger hover:bg-danger-soft" aria-label={`${s.title}: sil`}><Trash size={15} weight="bold" /></button>
                      </div>
                    )}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
          <li>
            {editing === 'new' ? (
              <div className="rounded-2xl border border-theme-medium/60 bg-surface"><StepForm initial={null} onDone={() => setEditing(null)} /></div>
            ) : (
              <button type="button" onClick={() => setEditing('new')} className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-theme-light text-sm font-semibold text-theme-muted hover:text-theme-deep hover:border-theme-medium transition-colors">
                <Plus size={16} weight="bold" /> Adım ekle
              </button>
            )}
          </li>
        </ol>
      )}
    </Modal>
  );
}

function StepForm({ initial, onDone }: { initial: OnboardingStep | null; onDone: () => void }) {
  const save = useSaveOnboardingStep();
  const { data: docs } = useDocs();
  const [form, setForm] = useState<StepInput>(initial
    ? { title: initial.title, description: initial.description, link: initial.link, autoRule: initial.autoRule }
    : EMPTY);
  const [error, setError] = useState<string | null>(null);

  const linkOptions = useMemo<ComboOption[]>(() => [
    { value: '', label: 'Bağlantı yok' },
    ...PAGES.map(p => ({ value: p.path, label: p.label, hint: p.path, leading: <Compass size={16} weight="duotone" /> })),
    ...(docs ?? []).map(d => ({ value: `/docs/${d.slug}`, label: d.title, hint: 'Doküman', leading: <BookOpenText size={16} weight="duotone" /> })),
    // Listede olmayan (ör. https) bir bağlantı kayıtlıysa o da seçili görünsün.
    ...(form.link && !PAGES.some(p => p.path === form.link) && !(docs ?? []).some(d => `/docs/${d.slug}` === form.link)
      ? [{ value: form.link, label: form.link, hint: 'Kayıtlı adres' }] : []),
  ], [docs, form.link]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Başlık boş olamaz.'); return; }
    if (form.autoRule === 'DOKUMAN' && !form.link?.startsWith('/docs/')) { setError('"Bağlı dokümanı açınca" için bağlantı olarak bir doküman seçin.'); return; }
    setError(null);
    save.mutate({ ...form, title: form.title.trim(), description: form.description?.trim() || null, id: initial?.id }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <div>
        <label htmlFor="onb-title-in" className="label">Başlık</label>
        <input id="onb-title-in" className="input" autoFocus maxLength={150} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Örn: Güvenlik kontrol listesini oku" />
      </div>
      <div>
        <label htmlFor="onb-desc-in" className="label">Açıklama <span className="text-theme-muted font-medium">(isteğe bağlı)</span></label>
        <textarea id="onb-desc-in" className="input min-h-[4.5rem] resize-y" maxLength={500} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <span className="label">Bağlantı</span>
          <Combobox label="Bağlantı" value={form.link ?? ''} onChange={v => setForm(f => ({ ...f, link: v || null, autoRule: !v && f.autoRule === 'DOKUMAN' ? null : f.autoRule }))}
            options={linkOptions} placeholder="Bağlantı yok" searchPlaceholder="Sayfa ya da doküman ara…" className="w-full" width={340} />
        </div>
        <div>
          <label htmlFor="onb-rule-in" className="label">Ne zaman tamamlanır?</label>
          <select id="onb-rule-in" className="input" value={form.autoRule ?? ''} onChange={e => setForm(f => ({ ...f, autoRule: (e.target.value || null) as OnboardingRule | null }))}>
            {RULES.map(r => <option key={r.value} value={r.value} disabled={r.value === 'DOKUMAN' && !form.link?.startsWith('/docs/')}>{r.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="btn-ghost h-10 min-h-0">Vazgeç</button>
        <button type="submit" disabled={save.isPending} className="btn-primary h-10 min-h-0">{initial ? 'Kaydet' : 'Ekle'}</button>
      </div>
    </form>
  );
}
