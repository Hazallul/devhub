import { useEffect, useMemo, useRef, useState } from 'react';
import { SERIES_COLOR, STATUS_COLOR } from './palette';
import { HEALTH_STATUS } from '../../lib/meta';
import type { HealthStatus } from '../../types';

/*
 * Zaman serisi grafikleri (Sistem İzleme). Bağımlılıksız SVG:
 *  - tek eksen, tek seri; 2px çizgi, altında hafif alan dolgusu
 *  - veri boşlukları (konteyner durduğunda) çizgiyi böler, uydurma değer çizilmez
 *  - üzerine gelince dikey imleç çizgisi + nokta + balon; klavyede ←/→ ile gezilir
 *  - güncellemelerde animasyon yok: canlı veri titremeden akar
 */

export interface Point { t: number; v: number | null }

const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const timeFmtSec = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Noktaları boşluklarda (null ya da beklenenden uzun ara) parçalara ayırır. */
function segments(points: Point[], gapMs: number) {
  const out: { t: number; v: number }[][] = [];
  let cur: { t: number; v: number }[] = [];
  let prevT = -Infinity;
  for (const p of points) {
    if (p.v === null || p.t - prevT > gapMs) {
      if (cur.length) out.push(cur);
      cur = [];
    }
    if (p.v !== null) cur.push({ t: p.t, v: p.v });
    prevT = p.t;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function LineChart({ points, from, to, format, label, height = 150, minMax = 1, gapMs = 25_000, color = SERIES_COLOR }: {
  points: Point[];
  /** x ekseni aralığı (ms); veri daha kısaysa grafik boş kısmı gösterir */
  from: number;
  to: number;
  format: (v: number) => string;
  label: string;
  height?: number;
  /** y ekseninin en az çıkacağı değer (ör. düşük CPU'da grafik abartılı görünmesin) */
  minMax?: number;
  gapMs?: number;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 10, t: 10, b: 22 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;

  const valid = useMemo(() => points.filter(p => p.v !== null) as { t: number; v: number }[], [points]);
  const yMax = niceMax(Math.max(minMax, ...valid.map(p => p.v)));
  const x = (t: number) => pad.l + ((t - from) / Math.max(1, to - from)) * w;
  const y = (v: number) => pad.t + h - (v / yMax) * h;
  const segs = useMemo(() => segments(points, gapMs), [points, gapMs]);
  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [0, 1, 2, 3].map(i => from + ((to - from) * i) / 3);

  const nearest = (clientX: number, rect: DOMRect) => {
    if (!valid.length) return null;
    const t = from + ((clientX - rect.left - pad.l) / Math.max(1, w)) * (to - from);
    let best = 0;
    for (let i = 1; i < valid.length; i++) if (Math.abs(valid[i].t - t) < Math.abs(valid[best].t - t)) best = i;
    return best;
  };

  const hp = hover !== null ? valid[hover] : null;
  const summary = valid.length
    ? `${label}: son ${format(valid[valid.length - 1].v)}, en yüksek ${format(Math.max(...valid.map(p => p.v)))}`
    : `${label}: henüz veri yok`;

  return (
    <div
      ref={ref}
      className="relative outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-theme-deep"
      tabIndex={0}
      role="img"
      aria-label={summary}
      onKeyDown={e => {
        if (!valid.length) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(i => Math.max(0, (i ?? valid.length) - 1)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); setHover(i => Math.min(valid.length - 1, (i ?? -1) + 1)); }
        if (e.key === 'Escape') setHover(null);
      }}
      onBlur={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block" onPointerMove={e => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))} onPointerLeave={() => setHover(null)} aria-hidden="true">
          {yTicks.map(v => (
            <g key={v}>
              <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} stroke="rgb(var(--grid))" strokeWidth={1} />
              <text x={pad.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-theme-muted text-[0.625rem] font-semibold tabular">{format(v)}</text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={t} x={x(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} className="fill-theme-muted text-[0.625rem] font-semibold tabular">{timeFmt.format(t)}</text>
          ))}
          {segs.map((s, i) => {
            const line = s.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
            const area = `${line}L${x(s[s.length - 1].t).toFixed(1)},${y(0)}L${x(s[0].t).toFixed(1)},${y(0)}Z`;
            return (
              <g key={i}>
                <path d={area} fill={color} opacity={0.12} />
                <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.length === 1 && <circle cx={x(s[0].t)} cy={y(s[0].v)} r={2.5} fill={color} />}
              </g>
            );
          })}
          {hp && (
            <g>
              <line x1={x(hp.t)} x2={x(hp.t)} y1={pad.t} y2={pad.t + h} stroke="rgb(var(--text))" strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={x(hp.t)} cy={y(hp.v)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          {/* Fare için tüm çizim alanı hedef */}
          <rect x={pad.l} y={pad.t} width={w} height={h} fill="transparent" />
        </svg>
      )}
      {hp && (
        <div
          role="tooltip"
          className="absolute pointer-events-none bg-ink text-white rounded-xl shadow-float px-3 py-2 whitespace-nowrap z-10"
          style={{
            left: Math.min(Math.max(x(hp.t) + 12, 0), Math.max(0, width - 130)),
            top: Math.max(0, y(hp.v) - 52),
          }}
        >
          <p className="text-sm font-bold tabular leading-tight">{format(hp.v)}</p>
          <p className="text-[0.6875rem] text-white/80 font-medium tabular">{timeFmtSec.format(hp.t)}</p>
        </div>
      )}
      {valid.length < 2 && width > 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-theme-muted pointer-events-none">Veri toplanıyor…</p>
      )}
    </div>
  );
}

/** Satır içi küçük eğilim çizgisi; değerin kendisi yanında yazı olarak durur (bu yüzden ekran okuyucudan gizli). */
export function Sparkline({ values, width = 88, height = 26, max }: { values: (number | null)[]; width?: number; height?: number; max?: number }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden="true" />;
  const top = max ?? Math.max(...nums, 0.0001) * 1.15;
  const step = width / Math.max(1, values.length - 1);
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    const px = (i * step).toFixed(1);
    const py = (height - 2 - (Math.min(v, top) / top) * (height - 4)).toFixed(1);
    d += `${pen ? 'L' : 'M'}${px},${py}`;
    pen = true;
  });
  return (
    <svg width={width} height={height} className="block shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={SERIES_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Durum zaman şeridi (Grafana "state timeline"): ardışık aynı durumlar tek parça olur, parçalar arasında 2px boşluk.
 * Renk tek başına anlam taşımaz: her parçanın balonunda durum adı ve saat aralığı yazar, altta lejant vardır.
 */
export function StateTimeline({ samples, from, to }: { samples: { t: number; status: HealthStatus }[]; from: number; to: number }) {
  const runs = useMemo(() => {
    const out: { status: HealthStatus; start: number; end: number }[] = [];
    samples.forEach(s => {
      const last = out[out.length - 1];
      if (last && last.status === s.status) last.end = s.t;
      else out.push({ status: s.status, start: s.t, end: s.t });
    });
    return out;
  }, [samples]);
  const span = Math.max(1, to - from);
  const covered = runs.length ? runs[0].start : to;

  return (
    <div className="flex h-3 w-full gap-[0.125rem]" role="list" aria-label="Durum geçmişi">
      {covered > from && <span className="h-full rounded-[0.1875rem] bg-theme-lightest" style={{ flexGrow: (covered - from) / span }} title="Veri yok" role="listitem" aria-label="Bu aralık için veri yok" />}
      {runs.map((r, i) => {
        const next = runs[i + 1]?.start ?? to;
        const label = `${HEALTH_STATUS[r.status].label} · ${timeFmt.format(r.start)}–${timeFmt.format(next)}`;
        return (
          <span
            key={r.start}
            role="listitem"
            aria-label={label}
            title={label}
            className="h-full rounded-[0.1875rem] min-w-[0.1875rem]"
            style={{ flexGrow: Math.max(next - r.start, 1) / span, backgroundColor: STATUS_COLOR[r.status] }}
          />
        );
      })}
    </div>
  );
}
