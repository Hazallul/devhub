import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash, ArrowUp, ArrowDown, RadioButton, CheckSquare, Star, TextAlignLeft, LockSimple, Eye, PaperPlaneTilt, FloppyDisk, X, MagnifyingGlass,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useMe, useUsers } from '../hooks/api';
import { useCreateSurvey, usePublishSurvey, useSurvey, useUpdateSurvey, type AudienceType, type QuestionType, type SurveyInput } from '../hooks/surveys';
import { Avatar, Segmented, Skeleton } from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';
import { departmentsOf } from '../lib/groups';
import { parseServerDate, toIsoDay, trLower } from '../lib/format';

type Q = SurveyInput['questions'][number] & { key: number };

const TYPES: { value: QuestionType; label: string; icon: Icon; hint: string }[] = [
  { value: 'TEK_SECIM', label: 'Tek seçim', icon: RadioButton, hint: 'Seçeneklerden biri' },
  { value: 'COKLU_SECIM', label: 'Çoklu seçim', icon: CheckSquare, hint: 'Birden fazla seçenek' },
  { value: 'PUAN', label: 'Puan (1-5)', icon: Star, hint: 'Memnuniyet, değerlendirme' },
  { value: 'METIN', label: 'Yazılı yanıt', icon: TextAlignLeft, hint: 'Görüş, öneri' },
];

let nextKey = 1;
const q = (type: QuestionType, text = '', options: string[] = [], required = true): Q => ({ key: nextKey++, type, text, options: type === 'TEK_SECIM' || type === 'COKLU_SECIM' ? (options.length ? options : ['', '']) : [], required });

/** Hazır şablonlar: boş sayfa yerine iyi bir başlangıç. */
const TEMPLATES: { name: string; title: string; description: string; anonymous: boolean; questions: () => Q[] }[] = [
  {
    name: 'Çalışan memnuniyeti', title: 'Çalışan memnuniyeti anketi', anonymous: true,
    description: 'Ekipte işlerin nasıl gittiğini anlamak için kısa bir anket. Yanıtlar anonimdir.',
    questions: () => [q('PUAN', 'Genel olarak işinizden ne kadar memnunsunuz?'), q('PUAN', 'Ekip içi iletişimi nasıl değerlendirirsiniz?'),
      q('TEK_SECIM', 'İş yükünüz nasıl?', ['Çok az', 'Uygun', 'Fazla', 'Çok fazla']), q('METIN', 'Neyi değiştirmemizi istersiniz?', [], false)],
  },
  {
    name: 'Etkinlik / tarih oylaması', title: 'Ekip etkinliği için tarih seçimi', anonymous: false,
    description: 'Size uyan günleri işaretleyin.',
    questions: () => [q('COKLU_SECIM', 'Hangi günler size uyar?', ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']), q('TEK_SECIM', 'Hangi saat aralığını tercih edersiniz?', ['Öğle arası', 'Mesai sonrası']), q('METIN', 'Eklemek istediğiniz bir not var mı?', [], false)],
  },
  {
    name: 'Eğitim değerlendirmesi', title: 'Eğitim değerlendirmesi', anonymous: true,
    description: 'Katıldığınız eğitimi değerlendirin.',
    questions: () => [q('PUAN', 'Eğitim içeriği işinize ne kadar yarayacak?'), q('PUAN', 'Eğitmeni nasıl değerlendirirsiniz?'), q('TEK_SECIM', 'Süre nasıldı?', ['Kısa', 'Uygun', 'Uzun']), q('METIN', 'Bir sonraki eğitim hangi konuda olsun?', [], false)],
  },
];

/** "2026-10-10T14:00:00" (UTC) → datetime-local değeri (yerel saat) */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = parseServerDate(iso);
  return `${toIsoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Anket hazırlama (yeni ya da taslak düzenleme). Yayınlanan anketin soruları değişmez; yanıtlar karışmasın. */
export default function SurveyEditor() {
  const me = useMe();
  if (me.role !== 'ADMIN') return <Navigate to="/surveys" replace />;
  return <Editor />;
}

function Editor() {
  const { id: raw } = useParams();
  const [params] = useSearchParams();
  const editId = raw ? Number(raw) : null;
  const copyId = params.get('kopya') ? Number(params.get('kopya')) : null;
  const source = useSurvey(editId ?? copyId);
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateSurvey();
  const update = useUpdateSurvey();
  const publish = usePublishSurvey();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [resultsPublic, setResultsPublic] = useState(false);
  const [audienceType, setAudienceType] = useState<AudienceType>('HERKES');
  const [audienceValues, setAudienceValues] = useState<string[]>([]);
  const [closesAt, setClosesAt] = useState('');
  const [questions, setQuestions] = useState<Q[]>([q('TEK_SECIM')]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!editId && !copyId);

  useEffect(() => {
    const d = source.data;
    if (!d || loaded) return;
    const s = d.survey;
    if (editId && s.state !== 'TASLAK') { navigate(`/surveys/${editId}`, { replace: true }); return; }
    setTitle(copyId ? `${s.title} (kopya)` : s.title);
    setDescription(s.description ?? '');
    setAnonymous(s.anonymous);
    setResultsPublic(s.resultsPublic);
    setAudienceType(s.audienceType);
    setAudienceValues(s.audienceValues);
    setClosesAt(copyId ? '' : toLocalInput(s.closesAt));
    setQuestions(d.questions.map(x => ({ key: nextKey++, type: x.type, text: x.text, required: x.required, options: x.options })));
    setLoaded(true);
  }, [source.data, loaded, editId, copyId, navigate]);

  const patchQ = (key: number, p: Partial<Q>) => setQuestions(list => list.map(x => (x.key === key ? { ...x, ...p } : x)));
  const move = (key: number, dir: -1 | 1) => setQuestions(list => {
    const i = list.findIndex(x => x.key === key);
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = 'Başlık en az 3 karakter olmalı.';
    if (!questions.length) e.questions = 'En az bir soru ekleyin.';
    questions.forEach(x => {
      if (!x.text.trim()) e[`q${x.key}`] = 'Soruyu yazın.';
      else if ((x.type === 'TEK_SECIM' || x.type === 'COKLU_SECIM') && x.options.filter(o => o.trim()).length < 2) e[`q${x.key}`] = 'En az iki seçenek yazın.';
    });
    if (audienceType !== 'HERKES' && !audienceValues.length) e.audience = audienceType === 'DEPARTMAN' ? 'En az bir departman seçin.' : 'En az bir kişi seçin.';
    if (closesAt && new Date(closesAt).getTime() <= Date.now()) e.closesAt = 'Son tarih ileri bir zaman olmalı.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const body = (): SurveyInput => ({
    title: title.trim(), description: description.trim(), anonymous, resultsPublic, audienceType, audienceValues, closesAt,
    questions: questions.map(x => ({ type: x.type, text: x.text.trim(), required: x.required, options: x.options.map(o => o.trim()).filter(Boolean) })),
  });

  const save = async (andPublish: boolean) => {
    if (!validate()) { toast.error('Eksik alanları tamamlayın.'); return; }
    let id = editId;
    if (id) await update.mutateAsync({ id, ...body() });
    else id = (await create.mutateAsync(body())).id;
    if (andPublish) await publish.mutateAsync(id);
    else toast.success('Taslak kaydedildi');
    navigate(`/surveys/${id}`);
  };

  if (!loaded) return <div className="max-w-3xl space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  const busy = create.isPending || update.isPending || publish.isPending;

  return (
    <div className="max-w-3xl pb-28">
      <Link to="/surveys" className="inline-flex items-center gap-1.5 text-sm text-theme-muted hover:text-theme-text mb-4"><ArrowLeft size={14} weight="bold" aria-hidden="true" /> Anketler</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-theme-text mb-1">{editId ? 'Taslağı düzenle' : 'Yeni anket'}</h1>
      <p className="text-sm text-theme-muted mb-6">Yayınlayınca seçtiğiniz kişilere bildirim gider. Yayınlanan anketin soruları değiştirilemez.</p>

      {!editId && !copyId && (
        <section className="mb-6" aria-label="Şablonlar">
          <p className="text-xs text-theme-muted mb-2">Hazır şablonla başlayın</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map(t => (
              <button key={t.name} type="button" className="btn-secondary min-h-[2.25rem] text-sm"
                onClick={() => { setTitle(t.title); setDescription(t.description); setAnonymous(t.anonymous); setQuestions(t.questions()); setErrors({}); }}>
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5 space-y-4 mb-4">
        <div>
          <label htmlFor="s-title" className="label">Başlık</label>
          <input id="s-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className="input" placeholder="Örn: Ofis düzeni anketi" aria-invalid={!!errors.title} />
          {errors.title && <p className="text-xs text-danger mt-1">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="s-desc" className="label">Açıklama <span className="font-normal text-theme-muted">(isteğe bağlı)</span></label>
          <textarea id="s-desc" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={2} className="input resize-y" placeholder="Anketin amacı, ne kadar süreceği…" />
        </div>
      </section>

      <section className="space-y-3 mb-4" aria-label="Sorular">
        <AnimatePresence initial={false}>
          {questions.map((x, i) => (
            <motion.div key={x.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className={`card p-5 ${errors[`q${x.key}`] ? 'border-danger-line' : ''}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-sm font-semibold text-theme-muted tabular pt-2">{i + 1}.</span>
                <input value={x.text} onChange={e => patchQ(x.key, { text: e.target.value })} maxLength={500} placeholder="Soruyu yazın" aria-label={`${i + 1}. soru`} className="input flex-1" />
                <div className="flex shrink-0">
                  <button type="button" onClick={() => move(x.key, -1)} disabled={i === 0} className="icon-btn disabled:opacity-30" aria-label="Yukarı taşı"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => move(x.key, 1)} disabled={i === questions.length - 1} className="icon-btn disabled:opacity-30" aria-label="Aşağı taşı"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => setQuestions(l => l.filter(y => y.key !== x.key))} disabled={questions.length === 1} className="icon-btn hover:text-danger disabled:opacity-30" aria-label="Soruyu sil"><Trash size={16} /></button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-3 pl-6" role="radiogroup" aria-label="Soru türü">
                {TYPES.map(t => {
                  const on = x.type === t.value;
                  return (
                    <button key={t.value} type="button" role="radio" aria-checked={on} title={t.hint}
                      onClick={() => patchQ(x.key, { type: t.value, options: (t.value === 'TEK_SECIM' || t.value === 'COKLU_SECIM') ? (x.options.length ? x.options : ['', '']) : x.options })}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${on ? 'border-accent bg-accent/[0.07] text-accent' : 'border-theme-light text-theme-muted hover:text-theme-text'}`}>
                      <t.icon size={14} aria-hidden="true" /> {t.label}
                    </button>
                  );
                })}
                <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer">
                  <input type="checkbox" checked={x.required} onChange={e => patchQ(x.key, { required: e.target.checked })} className="w-3.5 h-3.5 accent-[rgb(var(--accent))]" /> Zorunlu
                </label>
              </div>
              {(x.type === 'TEK_SECIM' || x.type === 'COKLU_SECIM') && (
                <div className="pl-6 space-y-1.5">
                  {x.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 border-2 border-theme-dark/30 shrink-0 ${x.type === 'COKLU_SECIM' ? 'rounded' : 'rounded-full'}`} aria-hidden="true" />
                      <input value={o} maxLength={200} placeholder={`Seçenek ${oi + 1}`} aria-label={`Seçenek ${oi + 1}`}
                        onChange={e => patchQ(x.key, { options: x.options.map((v, k) => (k === oi ? e.target.value : v)) })}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (x.options.length < 12) patchQ(x.key, { options: [...x.options, ''] }); } }}
                        className="flex-1 min-w-0 bg-transparent border-b border-theme-light focus:border-theme-medium focus:outline-none py-1 text-sm" />
                      <button type="button" onClick={() => patchQ(x.key, { options: x.options.filter((_, k) => k !== oi) })} disabled={x.options.length <= 2} className="icon-btn w-7 h-7 disabled:opacity-30" aria-label="Seçeneği kaldır"><X size={13} /></button>
                    </div>
                  ))}
                  {x.options.length < 12 && (
                    <button type="button" onClick={() => patchQ(x.key, { options: [...x.options, ''] })} className="text-xs font-medium text-theme-deep hover:underline underline-offset-4 mt-1">+ Seçenek ekle</button>
                  )}
                </div>
              )}
              {x.type === 'PUAN' && <p className="pl-6 text-xs text-theme-muted">Katılımcı 1 (çok kötü) ile 5 (çok iyi) arasında puan verir.</p>}
              {x.type === 'METIN' && <p className="pl-6 text-xs text-theme-muted">Katılımcı serbest metin yazar (en fazla 2000 karakter).</p>}
              {errors[`q${x.key}`] && <p className="pl-6 text-xs text-danger mt-2">{errors[`q${x.key}`]}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
        {questions.length < 30 && (
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setQuestions(l => [...l, q(t.value)])} className="btn-ghost min-h-[2.25rem] text-sm border border-dashed border-theme-light">
                <Plus size={14} weight="bold" /> {t.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5 space-y-5 mb-4" aria-label="Ayarlar">
        <AudienceField type={audienceType} values={audienceValues} error={errors.audience}
          onType={t => { setAudienceType(t); setAudienceValues([]); }} onValues={setAudienceValues} />
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="s-closes" className="label">Son tarih <span className="font-normal text-theme-muted">(isteğe bağlı)</span></label>
            <input id="s-closes" type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} className="input" />
            <p className="text-xs text-theme-muted mt-1">{errors.closesAt ? <span className="text-danger">{errors.closesAt}</span> : 'Bu saatte anket kendiliğinden kapanır.'}</p>
          </div>
          <div className="space-y-3">
            <Toggle icon={LockSimple} checked={anonymous} onChange={setAnonymous} label="Anonim"
              hint="Yanıtlar kişiyle eşleştirilmez; kimin yanıtladığı yalnızca katılım için görünür." />
            <Toggle icon={Eye} checked={resultsPublic} onChange={setResultsPublic} label="Sonuçları katılımcılarla paylaş"
              hint="Yanıtlayan kişi özet sonuçları görür (yazılı yanıtlar adsız)." />
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-30 border-t border-theme-light bg-surface/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-theme-muted mr-auto">{questions.length} soru</span>
          <button type="button" onClick={() => save(false)} disabled={busy} className="btn-ghost"><FloppyDisk size={16} /> Taslak olarak kaydet</button>
          <button type="button" onClick={() => save(true)} disabled={busy} className="btn-primary"><PaperPlaneTilt size={16} weight="bold" /> {busy ? 'Kaydediliyor…' : 'Kaydet ve yayınla'}</button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ icon: IconCmp, checked, onChange, label, hint }: { icon: Icon; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[rgb(var(--accent))]" />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-theme-text"><IconCmp size={14} aria-hidden="true" /> {label}</span>
        <span className="block text-xs text-theme-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Kitle: herkes, departman(lar) ya da seçilen kişiler. */
function AudienceField({ type, values, error, onType, onValues }: {
  type: AudienceType; values: string[]; error?: string; onType: (t: AudienceType) => void; onValues: (v: string[]) => void;
}) {
  const me = useMe();
  const { data: users } = useUsers();
  const departments = useMemo(() => departmentsOf(users), [users]);
  const [query, setQuery] = useState('');
  const people = (users ?? []).filter(u => u.id !== me.id);
  const qx = trLower(query.trim());
  const shown = people.filter(u => !qx || trLower(`${u.fullName} ${u.jobTitle ?? ''} ${u.department ?? ''}`).includes(qx));
  const toggle = (v: string) => onValues(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  const reach = type === 'HERKES' ? people.length
    : type === 'DEPARTMAN' ? people.filter(u => u.department && values.includes(u.department)).length : values.length;

  return (
    <div>
      <span className="label">Kime gönderilecek</span>
      <Segmented<AudienceType> label="Kitle" layoutId="survey-audience" value={type} onChange={onType}
        options={[{ value: 'HERKES', label: 'Herkes' }, { value: 'DEPARTMAN', label: 'Departman' }, { value: 'KISILER', label: 'Seçilen kişiler' }]} />
      {type === 'DEPARTMAN' && (
        departments.length === 0
          ? <p className="text-sm text-theme-muted mt-3">Henüz departman tanımlı değil. Kullanıcılar sayfasından çalışanlara departman verin.</p>
          : <div className="flex flex-wrap gap-1.5 mt-3">
            {departments.map(d => {
              const on = values.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggle(d)} aria-pressed={on}
                  className={`px-2.5 py-1 rounded-lg border text-sm transition-colors ${on ? 'bg-accent text-white border-accent' : 'border-theme-light hover:bg-theme-lightest'}`}>{d}</button>
              );
            })}
          </div>
      )}
      {type === 'KISILER' && (
        <div className="mt-3 rounded-xl border border-theme-light">
          <div className="relative border-b border-theme-light">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Kişi ara" aria-label="Kişi ara" className="w-full bg-transparent pl-8 pr-3 py-2 text-sm focus:outline-none" />
          </div>
          <ul className="max-h-56 overflow-y-auto scrollbar-thin p-1">
            {shown.map(u => {
              const on = values.includes(String(u.id));
              return (
                <li key={u.id}>
                  <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-theme-lightest/60 cursor-pointer">
                    <input type="checkbox" checked={on} onChange={() => toggle(String(u.id))} className="w-4 h-4 accent-[rgb(var(--accent))]" />
                    <Avatar user={u} size="xs" />
                    <span className="text-sm flex-1 truncate">{u.fullName}</span>
                    <span className="text-xs text-theme-muted truncate">{[u.jobTitle, u.department].filter(Boolean).join(' · ')}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-xs mt-2">{error ? <span className="text-danger">{error}</span> : <span className="text-theme-muted">{reach} kişiye gönderilecek (siz hariç).</span>}</p>
    </div>
  );
}
