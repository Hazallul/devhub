import { WarningCircle, ArrowFatUp } from '@phosphor-icons/react';
import type { taskUrgency } from '../../lib/urgency';

/** Kartın başındaki etiketler: "2 gün gecikti" (dolu kırmızı) ve "Yüksek" (turuncu). Renk tek başına anlam taşımaz: ikon + metin. */
export function UrgencyTags({ u, className = '' }: { u: ReturnType<typeof taskUrgency>; className?: string }) {
  if (!u.overdue && !u.high) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {u.overdue > 0 && (
        <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-danger-solid text-white text-[0.6875rem] font-semibold whitespace-nowrap">
          <WarningCircle size={12} weight="fill" aria-hidden="true" /> {u.overdue} gün gecikti
        </span>
      )}
      {u.high && (
        <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-surface border border-clay-line text-clay-ink text-[0.6875rem] font-semibold whitespace-nowrap">
          <ArrowFatUp size={11} weight="fill" aria-hidden="true" /> Yüksek öncelik
        </span>
      )}
    </span>
  );
}
