import { useMemo, useState } from 'react';
import { Plus, Minus, CaretUpDown } from '@phosphor-icons/react';
import { Block } from './DocContent';
import type { DocNode } from '../../types';

type Row = { kind: 'same' | 'add' | 'del'; node: DocNode };

/** Üst düzey bloklar üzerinde en uzun ortak alt dizi: aynı kalan, eklenen ve kaldırılan bloklar. */
function diffBlocks(before: DocNode[], after: DocNode[]): Row[] {
  const a = before.map(n => JSON.stringify(n));
  const b = after.map(n => JSON.stringify(n));
  const m = a.length, n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const rows: Row[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { rows.push({ kind: 'same', node: after[j] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) rows.push({ kind: 'del', node: before[i++] });
    else rows.push({ kind: 'add', node: after[j++] });
  }
  while (i < m) rows.push({ kind: 'del', node: before[i++] });
  while (j < n) rows.push({ kind: 'add', node: after[j++] });
  return rows;
}

/** Değişmeyen uzun bölümler katlanır; değişiklikler etiket + kenar çizgisiyle gösterilir (yalnızca renge dayanmaz). */
export default function DocDiff({ before, after }: { before: DocNode; after: DocNode }) {
  const rows = useMemo(() => diffBlocks(before.content ?? [], after.content ?? []), [before, after]);
  const added = rows.filter(r => r.kind === 'add').length;
  const removed = rows.filter(r => r.kind === 'del').length;
  const [open, setOpen] = useState<Set<number>>(new Set());

  // Değişikliğin hemen önü/arkası (1 blok) bağlam olarak açık kalır, gerisi katlanır.
  const near = (idx: number) => rows[idx - 1]?.kind !== 'same' && rows[idx - 1] !== undefined || rows[idx + 1]?.kind !== 'same' && rows[idx + 1] !== undefined;
  const groups: ({ type: 'row'; row: Row; idx: number } | { type: 'fold'; start: number; rows: { row: Row; idx: number }[] })[] = [];
  rows.forEach((row, idx) => {
    if (row.kind !== 'same' || near(idx)) return groups.push({ type: 'row', row, idx });
    const last = groups[groups.length - 1];
    if (last?.type === 'fold') last.rows.push({ row, idx });
    else groups.push({ type: 'fold', start: idx, rows: [{ row, idx }] });
  });

  return (
    <div>
      <p className="text-sm font-semibold text-theme-muted mb-4" aria-live="polite">
        {added || removed ? (
          <>
            <span className="text-good-ink">{added} bölüm eklendi / değişti</span>
            {' · '}
            <span className="text-danger">{removed} bölüm kaldırıldı / değişti</span>
          </>
        ) : 'İçerikte değişiklik yok (yalnızca başlık, özet, kategori veya etiketler değişmiş olabilir).'}
      </p>
      <div className="space-y-3 text-[0.9375rem] leading-7 text-theme-text">
        {groups.map(g => {
          if (g.type === 'row') return <DiffRow key={g.idx} row={g.row} />;
          if (g.rows.length === 1 || open.has(g.start)) return g.rows.map(r => <DiffRow key={r.idx} row={r.row} />);
          return (
            <button
              key={`f${g.start}`}
              type="button"
              onClick={() => setOpen(s => new Set(s).add(g.start))}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-theme-light text-xs font-bold text-theme-muted hover:text-theme-deep hover:bg-theme-cream transition-colors"
            >
              <CaretUpDown size={14} weight="bold" /> {g.rows.length} değişmeyen bölümü göster
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiffRow({ row }: { row: Row }) {
  if (row.kind === 'same') return <div className="opacity-60 pl-4 border-l-4 border-transparent"><Block node={row.node} /></div>;
  const add = row.kind === 'add';
  return (
    <div className={`relative rounded-r-2xl pl-4 pr-3 py-2 border-l-4 ${add ? 'border-good bg-good-soft' : 'border-clay bg-danger-soft'}`}>
      <span className={`inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider mb-1 ${add ? 'text-good-ink' : 'text-danger'}`}>
        {add ? <Plus size={11} weight="bold" /> : <Minus size={11} weight="bold" />} {add ? 'Eklendi' : 'Kaldırıldı'}
      </span>
      <div className={add ? '' : 'line-through decoration-clay/60 opacity-80'}><Block node={row.node} /></div>
    </div>
  );
}
