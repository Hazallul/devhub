import { useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

/*
 * Hafif, bağımlılıksız grafik parçaları (dataviz kuralları):
 *  - çubuk ≤ 24px, veri ucunda 4px yuvarlak, taban tarafı düz; bölütler arası 2px yüzey boşluğu
 *  - her bölüt kendi hover/focus balonunu taşır; değer önde, etiket arkada
 *  - metin hiçbir zaman seri rengini giymez; kimlik yanındaki renk anahtarından gelir
 *  - sıralı veriler tek tonlu zeytin rampasıyla (açık → koyu) çizilir; palet doğrulandı
 */

import { SERIES_COLOR } from './palette';

export interface Series { key: string; label: string; color: string }

interface TipState { x: number; y: number; value: string; label: string; color: string; extra?: ReactNode }

/** Grafik başına tek balon; fixed konum, animasyonsuz (konumu hiçbir transform ezmez). */
function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const bind = (value: string, label: string, color: string, extra?: ReactNode) => ({
    onPointerMove: (e: React.PointerEvent) => setTip({ x: e.clientX, y: e.clientY, value, label, color, extra }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, value, label, color, extra });
    },
    onBlur: () => setTip(null),
  });
  const node = tip && createPortal(
    <div
      role="tooltip"
      className="fixed z-[170] pointer-events-none bg-ink text-white rounded-xl shadow-float px-3 py-2 text-left"
      style={{ left: Math.min(tip.x + 14, window.innerWidth - 220), top: Math.max(tip.y - 56, 8), maxWidth: 220 }}
    >
      <p className="text-base font-bold tabular leading-tight">{tip.value}</p>
      <p className="text-xs text-white/80 font-medium flex items-center gap-1.5 mt-0.5">
        <span className="inline-block w-3 h-[0.1875rem] rounded-full" style={{ backgroundColor: tip.color }} aria-hidden="true" />
        {tip.label}
      </p>
      {tip.extra && <div className="text-xs text-white/80 mt-1.5 pt-1.5 border-t border-white/15">{tip.extra}</div>}
    </div>,
    document.body,
  );
  return { bind, node };
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-theme-muted" aria-label="Lejant">
      {series.map(s => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[0.1875rem]" style={{ backgroundColor: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export interface StackRow { id: string | number; label: ReactNode; ariaLabel: string; values: Record<string, number>; end?: ReactNode }

/**
 * Yatay yığılmış çubuklar. `normalize` ile her satır %100'e ölçeklenir (oran), yoksa en büyük toplama göre.
 * Satır sonu etiketi (end) çubuğun dışına yazılır, kırpılmaz.
 */
export function HBarStack({ rows, series, normalize = false, unit, labelWidth = 150 }: {
  rows: StackRow[]; series: Series[]; normalize?: boolean; unit: string; labelWidth?: number;
}) {
  const { bind, node } = useTooltip();
  const max = Math.max(1, ...rows.map(r => series.reduce((sum, s) => sum + (r.values[s.key] ?? 0), 0)));
  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((r, ri) => {
          const total = series.reduce((sum, s) => sum + (r.values[s.key] ?? 0), 0);
          const width = normalize ? 100 : (total / max) * 100;
          const present = series.filter(s => (r.values[s.key] ?? 0) > 0);
          return (
            <li key={r.id} className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth}px 1fr` }}>
              <div className="text-sm font-semibold text-theme-text truncate" title={r.ariaLabel}>{r.label}</div>
              <div className="flex items-center gap-2 min-w-0">
                <motion.div
                  className="flex h-[1.375rem] gap-[0.125rem] origin-left"
                  style={{ width: `calc(${width}% - ${r.end ? 64 : 0}px)`, minWidth: total ? 6 : 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: Math.min(ri, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  {present.map((s, i) => {
                    const v = r.values[s.key];
                    const last = i === present.length - 1;
                    return (
                      <span
                        key={s.key}
                        tabIndex={0}
                        aria-label={`${r.ariaLabel}, ${s.label}: ${v} ${unit}`}
                        {...bind(`${v} ${unit}`, `${r.ariaLabel} · ${s.label}`, s.color)}
                        className={`h-full outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-theme-text focus-visible:ring-offset-1 ${last ? 'rounded-r-[0.25rem]' : ''}`}
                        style={{ flexGrow: v, flexBasis: 0, backgroundColor: s.color, minWidth: 3 }}
                      />
                    );
                  })}
                </motion.div>
                {r.end && <span className="text-xs font-bold text-theme-text tabular whitespace-nowrap">{r.end}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {node}
    </div>
  );
}

export interface ColumnDatum { id: string; label: string; value: number; ariaLabel: string; extra?: ReactNode }

/** Tek serili sütun grafik: temiz y-eksen işaretleri, değer sütun başında. */
export function ColumnChart({ data, unit, height = 180 }: { data: ColumnDatum[]; unit: string; height?: number }) {
  const { bind, node } = useTooltip();
  const rawMax = Math.max(1, ...data.map(d => d.value));
  const step = niceStep(rawMax);
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return (
    <div>
      <div className="flex gap-2">
        <div className="relative w-7 shrink-0 text-[0.6875rem] font-semibold text-theme-muted tabular" style={{ height }} aria-hidden="true">
          {ticks.map(t => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map(t => (
            <span key={t} className="absolute inset-x-0 h-px bg-theme-lightest" style={{ top: `${(1 - t / max) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="absolute inset-0 flex items-end gap-[0.125rem]">
            {data.map((d, i) => (
              <div key={d.id} className="flex-1 h-full flex flex-col items-center justify-end min-w-0">
                {d.value > 0 && <span className="text-[0.6875rem] font-bold text-theme-text tabular mb-1">{d.value}</span>}
                <motion.span
                  tabIndex={0}
                  aria-label={`${d.ariaLabel}: ${d.value} ${unit}`}
                  {...bind(`${d.value} ${unit}`, d.ariaLabel, SERIES_COLOR, d.extra)}
                  className="block w-full max-w-[1.5rem] rounded-t-[0.25rem] origin-bottom outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-theme-text focus-visible:ring-offset-1"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, backgroundColor: SERIES_COLOR }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.5, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="w-7 shrink-0" />
        <div className="flex-1 flex gap-[0.125rem]">
          {data.map(d => <span key={d.id} className="flex-1 text-center text-[0.6875rem] font-semibold text-theme-muted truncate">{d.label}</span>)}
        </div>
      </div>
      {node}
    </div>
  );
}

function niceStep(max: number) {
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Tek değerli yatay ölçer: dolu kısım koyu, ray aynı rampanın açık basamağı. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-2 rounded-full bg-theme-lightest overflow-hidden" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <motion.div
        className="h-full rounded-full origin-left"
        style={{ width: `${pct * 100}%`, backgroundColor: pct >= 1 ? 'rgb(var(--danger))' : SERIES_COLOR }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** Grafiğin verisini tablo olarak açan erişilebilir alternatif (değerler hover'a kilitli kalmaz). */
export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 group">
      <summary className="text-xs font-bold text-theme-deep cursor-pointer select-none hover:underline underline-offset-4 w-fit">Veriyi tablo olarak göster</summary>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left">
              {headers.map((h, i) => <th key={h} scope="col" className={`eyebrow py-2 pr-4 ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-theme-light/40">
                {r.map((c, ci) => <td key={ci} className={`py-2 pr-4 ${ci > 0 ? 'text-right tabular' : 'font-semibold'}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
