import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Lightbulb, Warning, WarningOctagon, Copy, Check, ArrowSquareOut, LinkSimple } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { parseInline } from '../../lib/markdown';
import type { Block, CalloutKind } from '../../lib/markdown';

/** Ayrıştırılmış Markdown bloklarını sayfanın tasarım diliyle çizer. */
export default function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[15px] leading-7 text-theme-text">
      {blocks.map((b, i) => <BlockView key={i} block={b} />)}
    </div>
  );
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case 'heading':
      return b.level === 2 ? (
        <h2 id={b.id} className="group scroll-mt-6 text-2xl font-bold tracking-tight pt-6 flex items-center gap-2">
          <InlineText text={b.text} />
          <Anchor id={b.id} />
        </h2>
      ) : (
        <h3 id={b.id} className="group scroll-mt-6 text-lg font-bold pt-2 flex items-center gap-2">
          <InlineText text={b.text} />
          <Anchor id={b.id} />
        </h3>
      );
    case 'paragraph':
      return <p><InlineText text={b.text} /></p>;
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`space-y-1.5 pl-6 ${b.ordered ? 'list-decimal marker:font-bold marker:text-theme-deep' : 'list-disc marker:text-theme-medium'}`}>
          {b.items.map((item, i) => <li key={i} className="pl-1"><InlineText text={item} /></li>)}
        </Tag>
      );
    }
    case 'code':
      return <CodeBlock lang={b.lang} code={b.code} />;
    case 'callout':
      return <Callout kind={b.kind} lines={b.lines} />;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl border border-theme-light/60 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-theme-cream">
              <tr>{b.head.map((h, i) => <th key={i} scope="col" className="text-left font-bold px-4 py-2.5 whitespace-nowrap"><InlineText text={h} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className="border-t border-theme-light/40">
                  {r.map((c, ci) => <td key={ci} className="px-4 py-2.5 align-top"><InlineText text={c} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr className="border-theme-light/60" />;
  }
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

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((p, i) => {
        switch (p.t) {
          case 'code':
            return <code key={i} className="px-1.5 py-0.5 rounded-md bg-theme-lightest text-theme-deep text-[0.88em] font-mono font-semibold break-words">{p.v}</code>;
          case 'strong':
            return <strong key={i} className="font-bold">{p.v}</strong>;
          case 'em':
            return <em key={i}>{p.v}</em>;
          case 'link':
            return p.href.startsWith('/') ? (
              <Link key={i} to={p.href} className="font-semibold text-theme-deep underline decoration-theme-medium underline-offset-4 hover:decoration-theme-deep">{p.v}</Link>
            ) : (
              <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-theme-deep underline decoration-theme-medium underline-offset-4 hover:decoration-theme-deep inline-flex items-center gap-0.5">
                {p.v}<ArrowSquareOut size={13} weight="bold" aria-label="(yeni sekmede açılır)" />
              </a>
            );
          default:
            return <span key={i}>{p.v}</span>;
        }
      })}
    </>
  );
}

const LANG_LABEL: Record<string, string> = {
  bash: 'Terminal', text: 'Metin', java: 'Java', sql: 'SQL', json: 'JSON', http: 'HTTP', yaml: 'YAML', properties: 'Properties', ts: 'TypeScript', tsx: 'TSX',
};

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="rounded-2xl overflow-hidden bg-theme-text shadow-soft">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">{LANG_LABEL[lang] ?? lang}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Kodu kopyala">
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
          <span aria-live="polite">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto scrollbar-thin p-4 text-[13px] leading-6 text-[#F6F0D7]"><code className="font-mono">{code}</code></pre>
    </div>
  );
}

const CALLOUT: Record<CalloutKind, { label: string; icon: Icon; className: string; iconClass: string }> = {
  NOT: { label: 'Not', icon: Info, className: 'bg-theme-lightest/70 border-theme-light', iconClass: 'text-theme-deep' },
  IPUCU: { label: 'İpucu', icon: Lightbulb, className: 'bg-[#F1F5E6] border-[#C5D89D]', iconClass: 'text-[#5E7D2C]' },
  UYARI: { label: 'Uyarı', icon: Warning, className: 'bg-[#F7ECD0] border-[#E8D39C]', iconClass: 'text-[#6E5210]' },
  ONEMLI: { label: 'Önemli', icon: WarningOctagon, className: 'bg-[#FBEDE5] border-[#EFC9B5]', iconClass: 'text-[#9A3B1B]' },
};

function Callout({ kind, lines }: { kind: CalloutKind; lines: string[] }) {
  const c = CALLOUT[kind];
  return (
    <aside className={`flex gap-3 rounded-2xl border p-4 ${c.className}`} aria-label={c.label}>
      <c.icon size={20} weight="duotone" className={`shrink-0 mt-1 ${c.iconClass}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${c.iconClass}`}>{c.label}</p>
        {lines.map((l, i) => <p key={i}><InlineText text={l} /></p>)}
      </div>
    </aside>
  );
}
