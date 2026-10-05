import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, LockSimple, CheckCircle, BellRinging, DownloadSimple, Trash, Lock, LockOpen, Users, CalendarBlank, PencilSimple, Star, PaperPlaneTilt,
} from '@phosphor-icons/react';
import { useMe } from '../hooks/api';
import {
  useCloseSurvey, useDeleteSurvey, usePublishSurvey, useRemindSurvey, useReopenSurvey, useRespondSurvey, useSurvey, useSurveyResults,
  type QuestionResult, type SurveyDetail, type SurveyQuestion,
} from '../hooks/surveys';
import { Skeleton } from '../components/ui/primitives';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { usePageMenu } from '../components/layout/ContextMenu';
import { errorMessage } from '../services/api';
import { downloadFile } from '../lib/download';
import { timeAgo } from '../lib/format';
import { SURVEY_STATE, closesFull, closesText } from '../lib/surveys';

const RATING_LABELS = ['Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'];

/** Tek anket: çalışan için yanıt formu (ya da teşekkür + sonuçlar), yönetici için sonuçlar ve yönetim düğmeleri. */
export default function SurveyView() {
  const { id: raw } = useParams();
  const id = Number(raw);
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const { data, isLoading, error } = useSurvey(Number.isFinite(id) ? id : null);

  if (isLoading) return <div className="max-w-3xl space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error || !data) {
    return (
      <div className="max-w-3xl">
        <BackLink />
        <p className="card p-8 text-center text-sm text-theme-muted">Bu anket bulunamadı ya da size gönderilmedi.</p>
      </div>
    );
  }
  const s = data.survey;
  const answering = !isAdmin && s.state === 'ACIK' && s.recipient && !s.responded;
  return (
    <div className="max-w-4xl pb-12">
      <BackLink />
      <Header detail={data} admin={isAdmin} />
      {answering ? <AnswerForm detail={data} /> : (
        <>
          {!isAdmin && s.responded && (
            <div className="card p-5 mb-6 flex items-start gap-3">
              <CheckCircle size={22} weight="fill" className="text-good shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-theme-text">Yanıtınız alındı, teşekkürler.</p>
                <p className="text-sm text-theme-muted mt-0.5">
                  {s.anonymous ? 'Bu anket anonim: yanıtlarınız adınızla eşleştirilmeden saklandı.' : data.canSeeResults ? 'Aşağıda ekibin özet sonuçlarını görebilirsiniz.' : 'Sonuçları anketi hazırlayan yönetici görür.'}
                </p>
              </div>
            </div>
          )}
          {!isAdmin && !s.responded && s.state === 'KAPALI' && <p className="card p-5 mb-6 text-sm text-theme-muted">Bu anket kapandı; artık yanıt alınmıyor.</p>}
          {!isAdmin && !s.anonymous && s.responded && Object.keys(data.myAnswers).length > 0 && <MyAnswers detail={data} />}
          {data.canSeeResults && s.state !== 'TASLAK' && <Results id={s.id} admin={isAdmin} />}
          {isAdmin && s.state === 'TASLAK' && <DraftPreview detail={data} />}
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/surveys" className="inline-flex items-center gap-1.5 text-sm text-theme-muted hover:text-theme-text mb-4">
      <ArrowLeft size={14} weight="bold" aria-hidden="true" /> Anketler
    </Link>
  );
}

function Header({ detail, admin }: { detail: SurveyDetail; admin: boolean }) {
  const s = detail.survey;
  const navigate = useNavigate();
  const toast = useToast();
  const publish = usePublishSurvey();
  const close = useCloseSurvey();
  const reopen = useReopenSurvey();
  const remove = useDeleteSurvey();
  const remind = useRemindSurvey();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const st = SURVEY_STATE[s.state];
  const exportXlsx = () => downloadFile(`/surveys/${s.id}/export`, `anket-${s.id}-yanitlar.xlsx`).catch(e => toast.error(errorMessage(e)));
  const sendReminder = () => remind.mutate(s.id, { onSuccess: r => toast.success(r.sent ? `${r.sent} kişiye hatırlatma gönderildi` : 'Herkes yanıtladı ya da son bir saat içinde hatırlatıldı') });

  usePageMenu(admin ? [
    s.state === 'TASLAK' && { label: 'Düzenle', icon: PencilSimple, onSelect: () => navigate(`/surveys/${s.id}/duzenle`) },
    s.state === 'ACIK' && { label: 'Yanıtlamayanlara hatırlat', icon: BellRinging, onSelect: sendReminder },
    s.state !== 'TASLAK' && { label: 'Yanıtları Excel olarak indir', icon: DownloadSimple, onSelect: exportXlsx },
    { label: 'Anketi sil', icon: Trash, tone: 'danger', onSelect: () => setConfirmDelete(true) },
  ] : []);

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
            {s.anonymous && <span className="inline-flex items-center gap-1 text-xs text-theme-muted"><LockSimple size={12} weight="bold" aria-hidden="true" /> Anonim</span>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-theme-text">{s.title}</h1>
          {s.description && <p className="text-sm text-theme-muted mt-1.5 max-w-[65ch] whitespace-pre-wrap">{s.description}</p>}
          <p className="text-xs text-theme-muted mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {admin && <span className="inline-flex items-center gap-1"><Users size={12} weight="bold" aria-hidden="true" /> {s.audienceLabel}{s.state !== 'TASLAK' ? `, ${s.respondedCount}/${s.recipientCount} yanıtladı` : ''}</span>}
            {s.closesAt && s.state === 'ACIK' && <span className="inline-flex items-center gap-1" title={closesFull(s.closesAt)}><CalendarBlank size={12} weight="bold" aria-hidden="true" /> {closesText(s)}</span>}
            {s.state === 'KAPALI' && <span>{closesText(s)}</span>}
            {s.createdByName && <span>{s.createdByName} hazırladı</span>}
          </p>
        </div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            {s.state === 'TASLAK' && <>
              <Link to={`/surveys/${s.id}/duzenle`} className="btn-ghost"><PencilSimple size={16} /> Düzenle</Link>
              <button type="button" onClick={() => publish.mutate(s.id)} disabled={publish.isPending} className="btn-primary"><PaperPlaneTilt size={16} weight="bold" /> Yayınla</button>
            </>}
            {s.state === 'ACIK' && <>
              <button type="button" onClick={sendReminder} disabled={remind.isPending || s.respondedCount === s.recipientCount} className="btn-ghost"><BellRinging size={16} /> Hatırlat</button>
              <button type="button" onClick={exportXlsx} className="btn-ghost"><DownloadSimple size={16} /> Excel</button>
              <button type="button" onClick={() => close.mutate(s.id)} disabled={close.isPending} className="btn-secondary"><Lock size={16} /> Anketi kapat</button>
            </>}
            {s.state === 'KAPALI' && <>
              <button type="button" onClick={exportXlsx} className="btn-ghost"><DownloadSimple size={16} /> Excel</button>
              <button type="button" onClick={() => reopen.mutate(s.id)} disabled={reopen.isPending} className="btn-secondary"><LockOpen size={16} /> Yeniden aç</button>
            </>}
          </div>
        )}
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Anket silinsin mi?" size="sm"
        description={`"${s.title}" ve ${s.respondedCount} yanıt kalıcı olarak silinecek.`}
        footer={<>
          <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost">Vazgeç</button>
          <button type="button" className="btn-danger" disabled={remove.isPending} onClick={() => remove.mutate(s.id, { onSuccess: () => navigate('/surveys') })}>Sil</button>
        </>}>
        <p className="text-sm text-theme-muted">Sonuçları saklamak istiyorsanız önce Excel olarak indirin.</p>
      </Modal>
    </header>
  );
}

// ======================================================================= yanıt formu

type AnswerValue = number | number[] | string | undefined;

function AnswerForm({ detail }: { detail: SurveyDetail }) {
  const respond = useRespondSurvey();
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const refs = useRef<Record<number, HTMLElement | null>>({});
  const qs = detail.questions;
  const filled = (q: SurveyQuestion) => {
    const v = answers[q.id];
    return v !== undefined && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'string' && !v.trim());
  };
  const done = qs.filter(filled).length;
  const set = (id: number, v: AnswerValue) => {
    setAnswers(a => ({ ...a, [id]: v }));
    setMissing(m => { const n = new Set(m); n.delete(id); return n; });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const miss = qs.filter(q => q.required && !filled(q)).map(q => q.id);
    if (miss.length) {
      setMissing(new Set(miss));
      refs.current[miss[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const body: Record<string, unknown> = {};
    qs.forEach(q => { if (filled(q)) body[String(q.id)] = answers[q.id]; });
    respond.mutate({ id: detail.survey.id, answers: body });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {detail.survey.anonymous && (
        <p className="flex items-center gap-2 text-sm text-theme-muted"><LockSimple size={16} weight="bold" aria-hidden="true" /> Anonim anket: yanıtlarınız adınızla eşleştirilmez.</p>
      )}
      {qs.map((q, i) => (
        <section key={q.id} ref={el => { refs.current[q.id] = el; }} aria-labelledby={`q-${q.id}`}
          className={`card p-5 transition-colors ${missing.has(q.id) ? 'border-danger-line bg-danger-soft/30' : ''}`}>
          <p id={`q-${q.id}`} className="text-sm font-semibold text-theme-text mb-3">
            <span className="text-theme-muted tabular mr-1.5">{i + 1}.</span>{q.text}
            {!q.required && <span className="ml-2 text-xs font-normal text-theme-muted">İsteğe bağlı</span>}
          </p>
          <QuestionInput q={q} value={answers[q.id]} onChange={v => set(q.id, v)} />
          {missing.has(q.id) && <p role="alert" className="text-xs font-medium text-danger mt-2">Bu soruyu yanıtlayın.</p>}
        </section>
      ))}
      <div className="sticky bottom-4 z-10">
        <div className="card shadow-float px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[10rem]">
            <p className="text-xs text-theme-muted mb-1"><span className="tabular text-theme-text font-medium">{done}/{qs.length}</span> soru yanıtlandı</p>
            <div className="h-1.5 rounded-full bg-theme-lightest overflow-hidden">
              <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${qs.length ? (done / qs.length) * 100 : 0}%` }} />
            </div>
          </div>
          <button type="submit" disabled={respond.isPending} className="btn-primary"><PaperPlaneTilt size={16} weight="bold" /> {respond.isPending ? 'Gönderiliyor…' : 'Yanıtı gönder'}</button>
        </div>
      </div>
    </form>
  );
}

function QuestionInput({ q, value, onChange }: { q: SurveyQuestion; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  if (q.type === 'TEK_SECIM' || q.type === 'COKLU_SECIM') {
    const multi = q.type === 'COKLU_SECIM';
    const selected = multi ? ((value as number[] | undefined) ?? []) : value;
    return (
      <div className="grid sm:grid-cols-2 gap-2" role={multi ? 'group' : 'radiogroup'} aria-labelledby={`q-${q.id}`}>
        {multi && <p className="sm:col-span-2 text-xs text-theme-muted -mt-1">Birden fazla seçebilirsiniz.</p>}
        {q.options.map((o, i) => {
          const on = multi ? (selected as number[]).includes(i) : selected === i;
          return (
            <button key={i} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on}
              onClick={() => onChange(multi ? (on ? (selected as number[]).filter(x => x !== i) : [...(selected as number[]), i].sort((a, b) => a - b)) : i)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${on ? 'border-accent bg-accent/[0.06] text-theme-text' : 'border-theme-light hover:bg-theme-lightest/60 text-theme-text/90'}`}>
              <span className={`w-4 h-4 shrink-0 border-2 flex items-center justify-center ${multi ? 'rounded' : 'rounded-full'} ${on ? 'border-accent bg-accent' : 'border-theme-dark/40'}`} aria-hidden="true">
                {on && <span className={`bg-white ${multi ? 'w-2 h-2 rounded-sm' : 'w-1.5 h-1.5 rounded-full'}`} />}
              </span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === 'PUAN') {
    return (
      <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="grid grid-cols-5 gap-2 max-w-lg">
        {RATING_LABELS.map((l, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
              className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${on ? 'border-accent bg-accent text-white' : 'border-theme-light hover:bg-theme-lightest/60'}`}>
              <span className="block text-lg font-semibold tabular">{v}</span>
              <span className={`block text-[0.6875rem] ${on ? 'text-white/90' : 'text-theme-muted'}`}>{l}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <textarea value={(value as string | undefined) ?? ''} onChange={e => onChange(e.target.value)} rows={3} maxLength={2000}
      placeholder="Yanıtınız" aria-labelledby={`q-${q.id}`} className="input resize-y min-h-[5rem] text-sm" />
  );
}

function MyAnswers({ detail }: { detail: SurveyDetail }) {
  const text = (q: SurveyQuestion) => {
    const v = detail.myAnswers[String(q.id)];
    if (v === undefined) return '-';
    if (q.type === 'PUAN') return `${v} / 5`;
    if (q.type === 'METIN') return String(v);
    if (Array.isArray(v)) return v.map(i => q.options[i]).join(', ');
    return q.options[v as number];
  };
  return (
    <section className="card p-5 mb-6">
      <h2 className="text-sm font-semibold text-theme-text mb-3">Yanıtlarınız</h2>
      <dl className="space-y-2.5">
        {detail.questions.map((q, i) => (
          <div key={q.id}>
            <dt className="text-xs text-theme-muted">{i + 1}. {q.text}</dt>
            <dd className="text-sm text-theme-text whitespace-pre-wrap">{text(q)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DraftPreview({ detail }: { detail: SurveyDetail }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-theme-text mb-1">Taslak</h2>
      <p className="text-sm text-theme-muted mb-4">Henüz yayınlanmadı; kimse görmüyor. {detail.questions.length} soru, kitle: {detail.survey.audienceLabel}.</p>
      <ol className="space-y-1.5 text-sm list-decimal pl-5">
        {detail.questions.map(q => <li key={q.id} className="text-theme-text">{q.text}</li>)}
      </ol>
    </section>
  );
}

// ======================================================================= sonuçlar

function Results({ id, admin }: { id: number; admin: boolean }) {
  const { data, isLoading } = useSurveyResults(id);
  const [showPending, setShowPending] = useState(false);
  if (isLoading || !data) return <Skeleton className="h-60" />;
  const s = data.survey;
  const rate = s.recipientCount ? Math.round((s.respondedCount / s.recipientCount) * 100) : 0;
  return (
    <div className="space-y-4">
      <section className="card p-5 grid sm:grid-cols-3 gap-5">
        <Stat label="Yanıtlayan" value={`${s.respondedCount} / ${s.recipientCount}`} hint={`Katılım %${rate}`} />
        <Stat label="Soru" value={String(data.questions.length)} hint={s.anonymous ? 'Anonim anket' : 'Adıyla anket'} />
        <Stat label={s.state === 'KAPALI' ? 'Kapandı' : 'Son tarih'} value={s.state === 'KAPALI' ? (s.closedAt ? timeAgo(s.closedAt) : '-') : s.closesAt ? closesFull(s.closesAt) : 'Yok'}
          hint={s.publishedAt ? `Yayın: ${timeAgo(s.publishedAt)}` : undefined} />
      </section>

      {admin && data.pending && data.pending.length > 0 && (
        <section className="card p-5">
          <button type="button" onClick={() => setShowPending(x => !x)} className="text-sm font-semibold text-theme-text hover:underline underline-offset-4" aria-expanded={showPending}>
            Henüz yanıtlamayanlar ({data.pending.length})
          </button>
          {showPending && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {data.pending.map(p => (
                <li key={p.id} className="text-xs px-2 py-1 rounded-md border border-theme-light bg-theme-lightest/60" title={p.remindedAt ? `Son hatırlatma ${timeAgo(p.remindedAt)}` : 'Hatırlatma gönderilmedi'}>
                  {p.fullName}{p.department ? ` · ${p.department}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data.questions.map((q, i) => <QuestionResultCard key={q.questionId} q={q} index={i} total={s.respondedCount} />)}
      {s.respondedCount === 0 && <p className="card p-6 text-sm text-theme-muted text-center">Henüz yanıt yok. Yanıt geldikçe sonuçlar burada görünür.</p>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-lg font-semibold text-theme-text tabular">{value}</p>
      {hint && <p className="text-xs text-theme-muted">{hint}</p>}
    </div>
  );
}

function QuestionResultCard({ q, index, total }: { q: QuestionResult; index: number; total: number }) {
  const max = useMemo(() => Math.max(1, ...(q.counts ?? q.distribution ?? [0])), [q]);
  return (
    <section className="card p-5" aria-labelledby={`r-${q.questionId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 id={`r-${q.questionId}`} className="text-sm font-semibold text-theme-text"><span className="text-theme-muted tabular mr-1.5">{index + 1}.</span>{q.text}</h3>
        <span className="text-xs text-theme-muted">{q.answered} yanıt{q.type === 'COKLU_SECIM' ? ' · birden çok seçilebilir' : ''}</span>
      </div>
      {(q.type === 'TEK_SECIM' || q.type === 'COKLU_SECIM') && q.counts && (
        <ul className="space-y-2.5">
          {q.options.map((o, i) => {
            const n = q.counts![i];
            const pct = q.answered ? Math.round((n / q.answered) * 100) : 0;
            const top = n === max && n > 0;
            return (
              <li key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={top ? 'font-medium text-theme-text' : 'text-theme-text/90'}>{o}</span>
                  <span className="tabular text-theme-muted">{n} · %{pct}</span>
                </div>
                <div className="h-2 rounded-full bg-theme-lightest overflow-hidden">
                  <motion.div className={`h-full rounded-full ${top ? 'bg-accent' : 'bg-theme-medium/60'}`} initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {q.type === 'PUAN' && q.distribution && (
        <div className="grid sm:grid-cols-[10rem_1fr] gap-5 items-center">
          <div>
            <p className="text-3xl font-semibold text-theme-text tabular">{q.average != null ? String(q.average).replace('.', ',') : '-'}<span className="text-base text-theme-muted font-normal"> / 5</span></p>
            <p className="flex gap-0.5 mt-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map(v => <Star key={v} size={16} weight={q.average != null && q.average >= v - 0.25 ? 'fill' : 'regular'} className="text-warn" />)}
            </p>
          </div>
          <ul className="space-y-1.5">
            {[5, 4, 3, 2, 1].map(v => {
              const n = q.distribution![v - 1];
              return (
                <li key={v} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-xs">
                  <span className="text-theme-muted">{v} · {RATING_LABELS[v - 1]}</span>
                  <span className="h-2 rounded-full bg-theme-lightest overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="tabular text-theme-muted text-right">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {q.type === 'METIN' && (
        q.texts && q.texts.length > 0 ? (
          <ul className="divide-y divide-theme-light rounded-xl border border-theme-light max-h-96 overflow-y-auto scrollbar-thin">
            {q.texts.map((t, i) => (
              <li key={i} className="px-3.5 py-2.5 text-sm">
                <p className="text-theme-text whitespace-pre-wrap break-words">{t.text}</p>
                {t.name && <p className="text-xs text-theme-muted mt-0.5">{t.name}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-theme-muted">Bu soruya yazılı yanıt yok.</p>
      )}
      {total > 0 && q.answered < total && q.type !== 'METIN' && <p className="text-xs text-theme-muted mt-3">{total - q.answered} kişi bu soruyu boş bıraktı.</p>}
    </section>
  );
}
