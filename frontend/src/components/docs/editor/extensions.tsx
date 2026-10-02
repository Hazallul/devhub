import { Node, mergeAttributes } from '@tiptap/core';
import type { Extensions } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { X } from '@phosphor-icons/react';
import { CALLOUT, CALLOUT_KINDS, CODE_LANGS, safeHref } from '../../../docs';
import type { CalloutKind } from '../../../docs';
import { imageSrc, storedImageSrc } from '../../../hooks/docs';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Seçili blokları bir bilgi kutusuna alır (zaten kutudaysa türünü değiştirir). */
      setCallout: (kind: CalloutKind) => ReturnType;
    };
  }
}

/** Bilgi kutusu (Not / İpucu / Uyarı / Önemli): içinde paragraf, liste, kod olabilir. */
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'NOT',
        parseHTML: el => (CALLOUT_KINDS as string[]).includes(el.getAttribute('data-kind') ?? '') ? el.getAttribute('data-kind') : 'NOT',
        renderHTML: attrs => ({ 'data-kind': attrs.kind }),
      },
    };
  },
  parseHTML: () => [{ tag: 'aside[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),

  addCommands() {
    return {
      setCallout: kind => ({ editor, commands }) =>
        editor.isActive('callout') ? commands.updateAttributes('callout', { kind }) : commands.wrapIn('callout', { kind }),
    };
  },
});

function CalloutView({ node, updateAttributes, editor, getPos }: ReactNodeViewProps) {
  const kind = (node.attrs.kind as CalloutKind) in CALLOUT ? (node.attrs.kind as CalloutKind) : 'NOT';
  const c = CALLOUT[kind];
  /** Kutuyu kaldırır, içindeki yazı yerinde kalır. */
  const unwrap = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().setTextSelection({ from: pos + 1, to: pos + node.nodeSize - 1 }).lift('callout').run();
  };
  return (
    <NodeViewWrapper as="aside" className={`doc-callout flex gap-3 rounded-2xl border p-4 my-4 ${c.className}`}>
      <span contentEditable={false} className="shrink-0 mt-1"><c.icon size={20} weight="duotone" className={c.iconClass} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <div contentEditable={false} className="flex items-center gap-2 mb-1 select-none">
          <label className="sr-only" htmlFor={`callout-${getPos()}`}>Kutu türü</label>
          <select
            id={`callout-${getPos()}`}
            value={kind}
            onChange={e => updateAttributes({ kind: e.target.value })}
            className={`text-xs font-bold bg-transparent rounded-md pr-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-theme-medium ${c.iconClass}`}
            title="Kutunun türünü değiştir"
          >
            {CALLOUT_KINDS.map(k => <option key={k} value={k}>{CALLOUT[k].label}</option>)}
          </select>
          <span className="text-[0.6875rem] text-theme-muted font-semibold hidden sm:inline">{c.hint}</span>
          <button type="button" onClick={unwrap} className="ml-auto p-1 rounded-lg text-theme-muted hover:text-theme-text hover:bg-surface/70" title="Kutuyu kaldır (yazı kalır)" aria-label="Kutuyu kaldır">
            <X size={13} weight="bold" />
          </button>
        </div>
        <NodeViewContent className="doc-callout-body" />
      </div>
    </NodeViewWrapper>
  );
}

/** Kod bloğu: üstte dil seçimi; Tab tuşu girinti ekler. */
const DocCodeBlock = CodeBlock.extend({
  addNodeView: () => ReactNodeViewRenderer(CodeBlockView),
}).configure({ defaultLanguage: 'bash', enableTabIndentation: true, HTMLAttributes: { spellcheck: 'false' } });

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const lang = (node.attrs.language as string | null) ?? 'text';
  return (
    <NodeViewWrapper className="rounded-2xl overflow-hidden bg-ink my-4">
      <div contentEditable={false} className="flex items-center gap-2 px-4 py-2 border-b border-white/10 select-none">
        <select
          value={CODE_LANGS.some(l => l.id === lang) ? lang : 'text'}
          onChange={e => updateAttributes({ language: e.target.value })}
          className="text-[0.6875rem] font-bold text-white/80 bg-transparent rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-theme-text"
          aria-label="Kod dili"
          title="Kodun dilini seçin"
        >
          {CODE_LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <span className="ml-auto text-[0.6875rem] text-white/45 font-semibold hidden sm:inline">Çıkmak için alta iki kez Enter</span>
      </div>
      <pre className="overflow-x-auto scrollbar-thin p-4 text-[0.8125rem] leading-6 text-[#E7EBF1] m-0">
        <NodeViewContent<'code'> as="code" className="font-mono block whitespace-pre" />
      </pre>
    </NodeViewWrapper>
  );
}

/** Görsel: dokümanda göreli adres saklanır, editörde sunucunun tam adresiyle gösterilir; köşeden boyutlandırılabilir. */
const DocImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => storedImageSrc(el.getAttribute('src') ?? ''),
        renderHTML: (attrs: Record<string, unknown>) => ({ src: typeof attrs.src === 'string' ? imageSrc(attrs.src) : null }),
      },
    };
  },
}).configure({
  resize: { enabled: true, directions: ['bottom-right', 'bottom-left'], minWidth: 80, minHeight: 40, alwaysPreserveAspectRatio: true },
  HTMLAttributes: { class: 'doc-image' },
});

export const docExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && safeHref(url) !== null,
    },
  }),
  DocCodeBlock,
  Callout,
  DocImage,
  Highlight.configure({ multicolor: false }),
  TableKit.configure({ table: { resizable: false } }),
  Placeholder.configure({
    placeholder: ({ node }) => (node.type.name === 'heading' ? 'Başlık yazın' : 'Yazmaya başlayın… Tablo, görsel, kod veya kutu eklemek için “/” yazın'),
    showOnlyCurrent: true,
  }),
];
