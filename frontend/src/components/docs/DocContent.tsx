import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, ArrowSquareOut, LinkSimple } from '@phosphor-icons/react';
import { CALLOUT, docOutline, langLabel, safeHref } from '../../docs';
import type { CalloutKind } from '../../docs';
import { imageSrc } from '../../hooks/docs';
import type { DocMark, DocNode } from '../../types';

/**
 * Editörün JSON'unu sayfanın tasarım diliyle çizer. Yalnızca bilinen düğüm ve biçimler çizilir; HTML hiçbir zaman
 * olduğu gibi basılmaz, bağlantılar safeHref'ten geçer.
 */
export default function DocContent({ doc, className = '' }: { doc: DocNode; className?: string }) {
  const ids = docOutline(doc).map(o => o.id);
  let h = 0;
  return (
    <div className={`doc-content space-y-5 text-[0.9375rem] leading-7 text-theme-text ${className}`}>
      {(doc.content ?? []).map((n, i) => <Block key={i} node={n} headingId={n.type === 'heading' ? ids[h++] : undefined} />)}
    </div>
  );
}

function Children({ nodes, tight }: { nodes?: DocNode[]; tight?: boolean }) {
  if (!nodes?.length) return null;
  return <div className={tight ? 'space-y-1.5' : 'space-y-3'}>{nodes.map((n, i) => <Block key={i} node={n} />)}</div>;
}

/** Bir düğümü çizer; DocDiff de blokları tek tek çizmek için kullanır. */
export function Block({ node: n, headingId }: { node: DocNode; headingId?: string }) {
  switch (n.type) {
    case 'paragraph':
      return n.content?.length ? <p><Inline nodes={n.content} /></p> : <div className="h-3" aria-hidden="true" />;
    case 'heading': {
      const level = Number(n.attrs?.level ?? 2);
      const Tag = level === 3 ? 'h3' : 'h2';
      return (
        <Tag id={headingId} className={`group scroll-mt-6 font-bold flex items-center gap-2 ${level === 3 ? 'text-lg pt-2' : 'text-2xl tracking-tight pt-6'}`}>
          <span><Inline nodes={n.content} /></span>
          {headingId && <Anchor id={headingId} />}
        </Tag>
      );
    }
    case 'bulletList':
      return <ul className="space-y-1.5 pl-6 list-disc marker:text-theme-medium">{n.content?.map((li, i) => <li key={i} className="pl-1"><Children nodes={li.content} tight /></li>)}</ul>;
    case 'orderedList':
      return (
        <ol start={Number(n.attrs?.start ?? 1)} className="space-y-1.5 pl-6 list-decimal marker:font-bold marker:text-theme-deep">
          {n.content?.map((li, i) => <li key={i} className="pl-1"><Children nodes={li.content} tight /></li>)}
        </ol>
      );
    case 'codeBlock':
      return <CodeBlock lang={n.attrs?.language} code={(n.content ?? []).map(t => t.text ?? '').join('')} />;
    case 'callout':
      return <Callout kind={(n.attrs?.kind as CalloutKind) in CALLOUT ? (n.attrs!.kind as CalloutKind) : 'NOT'} nodes={n.content} />;
    case 'table':
      return (
        <div className="overflow-x-auto scrollbar-thin rounded-2xl border border-theme-light/60 bg-surface">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {n.content?.map((row, ri) => (
                <tr key={ri} className={ri ? 'border-t border-theme-light/40' : ''}>
                  {row.content?.map((cell, ci) => {
                    const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
                    return (
                      <Cell
                        key={ci}
                        colSpan={Number(cell.attrs?.colspan ?? 1)}
                        rowSpan={Number(cell.attrs?.rowspan ?? 1)}
                        scope={cell.type === 'tableHeader' ? 'col' : undefined}
                        className={`px-4 py-2.5 align-top text-left ${cell.type === 'tableHeader' ? 'bg-theme-cream font-bold' : ''} ${ci ? 'border-l border-theme-light/30' : ''}`}
                      >
                        <Children nodes={cell.content} tight />
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'image': {
      const src = typeof n.attrs?.src === 'string' ? n.attrs.src : '';
      if (!src.startsWith('/api/docs/images/') && !src.startsWith('https://')) return null;
      const width = Number(n.attrs?.width) || undefined;
      const alt = typeof n.attrs?.alt === 'string' ? n.attrs.alt : '';
      return (
        <figure className="my-2">
          <a href={imageSrc(src)} target="_blank" rel="noopener noreferrer" className="inline-block max-w-full rounded-2xl overflow-hidden border border-theme-light/50 bg-surface" title="Görseli tam boyutta aç">
            <img src={imageSrc(src)} alt={alt} loading="lazy" style={width ? { width } : undefined} className="max-w-full h-auto block" />
          </a>
          {alt && <figcaption className="text-xs text-theme-muted font-semibold mt-1.5">{alt}</figcaption>}
        </figure>
      );
    }
    case 'horizontalRule':
      return <hr className="border-theme-light/60" />;
    default:
      return null;
  }
}

function Inline({ nodes }: { nodes?: DocNode[] }) {
  return <>{nodes?.map((n, i) => (n.type === 'hardBreak' ? <br key={i} /> : n.type === 'text' ? <Marked key={i} text={n.text ?? ''} marks={n.marks ?? []} /> : null))}</>;
}

const LINK = 'font-semibold text-theme-deep underline decoration-theme-medium underline-offset-4 hover:decoration-theme-deep';

/** Biçimleri dıştan içe sarar; bağlantı en dışta olur ki tüm metin tıklanabilsin. */
function Marked({ text, marks }: { text: string; marks: DocMark[] }) {
  const ordered = [...marks].sort((a, b) => Number(b.type === 'link') - Number(a.type === 'link'));
  return ordered.reduceRight<ReactNode>((child, m) => {
    switch (m.type) {
      case 'bold': return <strong className="font-bold">{child}</strong>;
      case 'italic': return <em>{child}</em>;
      case 'underline': return <u className="underline-offset-2">{child}</u>;
      case 'strike': return <s>{child}</s>;
      case 'highlight': return <mark className="bg-theme-light/80 text-theme-text rounded px-0.5">{child}</mark>;
      case 'code': return <code className="px-1.5 py-0.5 rounded-md bg-theme-lightest text-theme-deep text-[0.88em] font-mono font-semibold break-words">{child}</code>;
      case 'link': {
        const href = safeHref(m.attrs?.href);
        if (!href) return child;
        if (href.startsWith('/') || href.startsWith('#')) return <Link to={href} className={LINK}>{child}</Link>;
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className={`${LINK} inline-flex items-center gap-0.5`}>
            {child}<ArrowSquareOut size={13} weight="bold" aria-label="(yeni sekmede açılır)" />
          </a>
        );
      }
      default: return child;
    }
  }, text);
}

/** Başlığın yanında üzerine gelince görünen bağlantı: bölümün adresini kopyalar. */
function Anchor({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        const url = `${location.origin}${location.pathname}#${id}`;
        navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
        history.replaceState(null, '', `#${id}`);
      }}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-theme-muted hover:text-theme-deep transition-opacity rounded"
      aria-label="Bu bölümün bağlantısını kopyala"
      title={copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
    >
      {copied ? <Check size={16} weight="bold" /> : <LinkSimple size={16} weight="bold" />}
    </button>
  );
}

function CodeBlock({ lang, code }: { lang: unknown; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="rounded-2xl overflow-hidden bg-ink shadow-soft">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-[0.6875rem] font-bold text-white/60">{langLabel(lang)}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Kodu kopyala">
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
          <span aria-live="polite">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto scrollbar-thin p-4 text-[0.8125rem] leading-6 text-[#E7EBF1]"><code className="font-mono">{code}</code></pre>
    </div>
  );
}

function Callout({ kind, nodes }: { kind: CalloutKind; nodes?: DocNode[] }) {
  const c = CALLOUT[kind];
  return (
    <aside className={`flex gap-3 rounded-2xl border p-4 ${c.className}`} aria-label={c.label}>
      <c.icon size={20} weight="duotone" className={`shrink-0 mt-1 ${c.iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold mb-0.5 ${c.iconClass}`}>{c.label}</p>
        <Children nodes={nodes} tight />
      </div>
    </aside>
  );
}
