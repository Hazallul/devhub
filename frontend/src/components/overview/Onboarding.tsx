import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flag, Check, CaretDown, ArrowRight, ArrowSquareOut, Lightning, Confetti } from '@phosphor-icons/react';
import { useCloseOnboarding, useMyOnboarding, useToggleOnboardingStep, RULE_LABEL } from '../../hooks/onboarding';
import { useMe } from '../../hooks/api';
import type { OnboardingMyStep } from '../../types';

const COLLAPSE_KEY = (userId: number) => `devhub.onboarding.collapsed.${userId}`;

/**
 * Genel Bakış'ın en üstünde, yeni başlayan kişinin "İşe başlangıç" listesi. Bazı adımlar kendiliğinden tamamlanır
 * (şifre, iletişim bilgisi, bağlı dokümanı açma); diğerlerini kişi işaretler. Hepsi bitince kart kaldırılabilir.
 */
export default function Onboarding() {
  const me = useMe();
  const { data } = useMyOnboarding();
  const toggle = useToggleOnboardingStep();
  const close = useCloseOnboarding();
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY(me.id)) === '1'; } catch { return false; }
  });

  if (!data?.active || data.closed || data.total === 0) return null;

  const allDone = data.done === data.total;
  const next = data.steps.find(s => !s.done);
  const pct = Math.round((data.done / data.total) * 100);
  const setCollapse = (v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem(COLLAPSE_KEY(me.id), v ? '1' : '0'); } catch { /* yalnızca bu oturum */ }
  };

  return (
    <motion.section
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 sm:p-7 mb-8 relative overflow-hidden"
      aria-labelledby="onb-title"
    >
      {/* Üst kenarda ilerleme şeridi */}
      <div className="absolute inset-x-0 top-0 h-1 bg-theme-lightest" aria-hidden="true">
        <motion.div className="h-full bg-theme-medium" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${allDone ? 'bg-good-soft text-good-ink' : 'bg-theme-lightest text-theme-deep'}`}>
          {allDone ? <Confetti size={24} weight="duotone" /> : <Flag size={24} weight="duotone" />}
        </span>
        <div className="flex-1 min-w-[13.75rem]">
          <h2 id="onb-title" className="text-lg font-bold tracking-tight">{allDone ? 'İşe başlangıç tamamlandı' : 'İşe başlangıç'}</h2>
          <p className="text-sm text-theme-muted mt-0.5">
            {allDone
              ? 'Tüm adımları bitirdin, yöneticine haber verildi. Bu kartı artık kaldırabilirsin.'
              : 'Hoş geldin! İlk günlerinde bu adımlar yolunu bulmanı kolaylaştırır. Bazıları sen yaptıkça kendiliğinden işaretlenir.'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold tabular leading-none">{data.done}<span className="text-base text-theme-muted font-semibold">/{data.total}</span></p>
            <p className="text-[0.6875rem] font-semibold text-theme-muted mt-1">adım tamam</p>
          </div>
          {allDone ? (
            <button type="button" onClick={() => close.mutate()} disabled={close.isPending} className="btn-primary h-10 min-h-0 px-4 text-sm">Kartı kaldır</button>
          ) : (
            <button type="button" onClick={() => setCollapse(!collapsed)} className="icon-btn" aria-expanded={!collapsed} aria-controls="onb-steps"
              aria-label={collapsed ? 'Adımları göster' : 'Adımları gizle'} title={collapsed ? 'Adımları göster' : 'Adımları gizle'}>
              <motion.span animate={{ rotate: collapsed ? 0 : 180 }} className="flex"><CaretDown size={18} weight="bold" /></motion.span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {collapsed && !allDone ? (
          next && (
            <motion.div key="next" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 flex items-center gap-2 text-sm">
              <span className="eyebrow">Sıradaki</span>
              <span className="font-semibold truncate">{next.title}</span>
            </motion.div>
          )
        ) : (
          <motion.ol
            key="steps"
            id="onb-steps"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            className="grid md:grid-cols-2 gap-2 mt-5 overflow-hidden"
          >
            {data.steps.map((s, i) => (
              <Step key={s.id} step={s} index={i} isNext={s.id === next?.id}
                onToggle={() => toggle.mutate({ id: s.id, done: !s.done })} />
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Step({ step, index, isNext, onToggle }: { step: OnboardingMyStep; index: number; isNext: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  // Şifre ve iletişim adımları yalnızca gereken işlem yapılınca tamamlanır; elle işaretlenemez.
  const autoOnly = step.autoRule === 'SIFRE' || step.autoRule === 'ILETISIM';
  const external = !!step.link && /^https:\/\//.test(step.link);

  return (
    <li className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${
      step.done ? 'bg-theme-cream/60 border-transparent' : isNext ? 'bg-surface border-theme-medium/60 shadow-soft' : 'bg-surface border-theme-light/50'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={autoOnly}
        role="checkbox"
        aria-checked={step.done}
        aria-label={`${step.title}${autoOnly ? ' (kendiliğinden tamamlanır)' : ''}`}
        title={autoOnly ? `${RULE_LABEL[step.autoRule!]} kendiliğinden işaretlenir` : step.done ? 'İşareti kaldır' : 'Tamamlandı olarak işaretle'}
        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:cursor-default ${
          step.done ? 'bg-accent border-accent text-white' : 'border-theme-medium hover:border-theme-deep hover:bg-theme-lightest'}`}
      >
        <AnimatePresence initial={false}>
          {step.done && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="flex">
              <Check size={13} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-snug ${step.done ? 'text-theme-muted line-through decoration-theme-medium' : ''}`}>
          <span className="text-theme-muted tabular mr-1.5">{index + 1}.</span>{step.title}
        </p>
        {step.description && !step.done && <p className="text-xs text-theme-muted mt-1 leading-relaxed">{step.description}</p>}
        {(step.link || step.autoRule) && !step.done && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {step.link && (
              external ? (
                <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-theme-deep hover:underline underline-offset-4">
                  Aç <ArrowSquareOut size={13} weight="bold" />
                </a>
              ) : (
                <button type="button" onClick={() => navigate(step.link!)} className="inline-flex items-center gap-1 text-xs font-bold text-theme-deep hover:underline underline-offset-4">
                  {step.link.startsWith('/docs/') ? 'Dokümanı aç' : 'Git'} <ArrowRight size={13} weight="bold" />
                </button>
              )
            )}
            {step.autoRule && (
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-theme-muted">
                <Lightning size={12} weight="fill" className="text-theme-dark" /> {RULE_LABEL[step.autoRule]} işaretlenir
              </span>
            )}
          </div>
        )}
      </div>
      {isNext && <span className="text-[0.625rem] font-bold uppercase tracking-wide text-theme-deep bg-theme-lightest px-1.5 py-0.5 rounded-md shrink-0">Sıradaki</span>}
    </li>
  );
}
