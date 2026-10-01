import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { Icon } from '@phosphor-icons/react';
import {
  ArrowCounterClockwise, ArrowClockwise, TextB, TextItalic, TextUnderline, TextStrikethrough, HighlighterCircle, Code, LinkSimple,
  ListBullets, ListNumbers, Terminal, Table, Image as ImageIcon, Plus, Info, CaretDown, Rows, Columns, Trash, ArrowLineUp,
  ArrowLineDown, ArrowLineLeft, ArrowLineRight, SquareSplitHorizontal, CircleNotch, X, Check,
} from '@phosphor-icons/react';
import { docExtensions } from './extensions';
import { BLOCK_ITEMS, filterBlocks } from './blocks';
import type { BlockItem } from './blocks';
import { CALLOUT, CALLOUT_KINDS } from '../../../docs';
import { uploadDocImage } from '../../../hooks/docs';
import { errorMessage } from '../../../services/api';
import { useToast } from '../../ui/Toast';
import { Menu, MenuItem, MenuDivider } from '../../ui/Menu';
import { useContextMenu } from '../../layout/ContextMenu';
import type { DocNode } from '../../../types';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

interface Props {
  initial: DocNode;
  onChange: (doc: DocNode) => void;
}

/**
 * Doküman editörü (TipTap). Kod bilmeden: araç çubuğu, "/" ile blok menüsü, sürükle-bırak / yapıştır ile görsel,
 * tabloda sağ tık menüsü. Markdown kısayolları da çalışır (## başlık, - liste, ``` kod).
 */
export default function DocEditor({ initial, onChange }: Props) {
  const toast = useToast();
  const menu = useContextMenu();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const slashRef = useRef<SlashState | null>(null);
  const slashIndex = useRef(0);
  const [slashIdx, setSlashIdx] = useState(0);
  const moveSlash = (i: number) => { slashIndex.current = i; setSlashIdx(i); };
  const dismissedAt = useRef<number | null>(null);
  const uploadRef = useRef<(files: File[], at?: number) => void>(() => {});
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const editor = useEditor({
    extensions: docExtensions,
    content: initial,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'doc-prose', 'aria-label': 'Doküman içeriği', 'aria-multiline': 'true', role: 'textbox' },
      handleKeyDown: (_view, e) => {
        const s = slashRef.current;
        if (!s) return false;
        const items = filterBlocks(s.query);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          moveSlash((slashIndex.current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1));
          return true;
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && items.length) {
          pickRef.current(items[slashIndex.current] ?? items[0]);
          return true;
        }
        if (e.key === 'Escape') {
          dismissedAt.current = s.from;
          closeSlash();
          return true;
        }
        return false;
      },
      handlePaste: (_view, e) => {
        const files = Array.from(e.clipboardData?.files ?? []).filter(f => IMAGE_TYPES.includes(f.type));
        if (!files.length) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, e, _slice, moved) => {
        if (moved) return false;
        const files = Array.from((e as DragEvent).dataTransfer?.files ?? []).filter(f => IMAGE_TYPES.includes(f.type));
        if (!files.length) return false;
        const pos = view.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY })?.pos;
        uploadRef.current(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current(ed.getJSON() as DocNode),
  });

  function closeSlash() {
    slashRef.current = null;
    setSlash(null);
  }

  // "/" menüsü: boş bir satırın başında "/" yazılınca açılır, yazdıkça süzülür.
  useEffect(() => {
    const check = () => {
      const { selection } = editor.state;
      const $from = selection.$from;
      if (!selection.empty || $from.parent.type.name !== 'paragraph' || !editor.isFocused) return closeSlash();
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
      const m = /^\/(\S{0,24})$/.exec(before);
      if (!m || dismissedAt.current === $from.start()) {
        if (!m) dismissedAt.current = null;
        return closeSlash();
      }
      const coords = editor.view.coordsAtPos($from.pos);
      const next = { query: m[1], from: $from.start(), to: $from.pos, left: coords.left, top: coords.bottom };
      if (slashRef.current?.query !== next.query) moveSlash(0);
      slashRef.current = next;
      setSlash(next);
    };
    editor.on('transaction', check);
    editor.on('blur', closeSlash);
    return () => {
      editor.off('transaction', check);
      editor.off('blur', closeSlash);
    };
  }, [editor]);

  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const pickRef = useRef<(item: BlockItem) => void>(() => {});
  const pick = (item: BlockItem) => {
    const s = slashRef.current;
    if (s) editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    closeSlash();
    item.run(editor, pickImage);
  };

  const upload = async (files: File[], at?: number) => {
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) { toast.error(`${file.name}: yalnızca PNG, JPEG, GIF veya WebP eklenebilir.`); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: görsel en fazla 5 MB olabilir.`); continue; }
      setUploading(n => n + 1);
      try {
        const src = await uploadDocImage(file);
        const node = { type: 'image', attrs: { src, alt: file.name.replace(/\.[a-z0-9]+$/i, '') } };
        if (at !== undefined) editor.chain().focus().insertContentAt(at, node).run();
        else editor.chain().focus().insertContent(node).run();
      } catch (err) {
        toast.error(errorMessage(err, 'Görsel yüklenemedi.'));
      } finally {
        setUploading(n => n - 1);
      }
    }
  };

  // editorProps oluşturulurken bir kez bağlanır; güncel işlevlere ref üzerinden ulaşır.
  useEffect(() => {
    pickRef.current = pick;
    uploadRef.current = upload;
  });

  /** Tablo hücresinde sağ tık: tablo işlemleri. Diğer yerlerde tarayıcının menüsü (yapıştır, yazım denetimi) kalır. */
  const onContextMenu = (e: ReactMouseEvent) => {
    const cell = (e.target as HTMLElement).closest('td, th');
    if (e.shiftKey || !cell || !editor.view.dom.contains(cell)) return;
    // İmleci tıklanan hücreye taşı (işlemler imlecin bulunduğu satır/sütuna uygulanır).
    try { editor.commands.setTextSelection(editor.view.posAtDOM(cell, 0) + 1); } catch { /* hücre bulunamadıysa mevcut seçim kalır */ }
    menu(e, { label: 'Tablo', items: tableActions(editor).map(a => (a === 'divider' ? a : { label: a.label, icon: a.icon, onSelect: a.run, tone: a.danger ? 'danger' : undefined })) });
  };

  return (
    <div className="doc-editor rounded-3xl border border-theme-light/70 bg-surface shadow-soft" onContextMenu={onContextMenu}>
      <Toolbar editor={editor} onImage={pickImage} uploading={uploading > 0} />
      <EditorContent editor={editor} className="px-5 sm:px-8 py-6" />
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        hidden
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) uploadRef.current(files);
        }}
      />
      {slash && <SlashMenu state={slash} index={slashIdx} onPick={pick} onHover={moveSlash} />}
    </div>
  );
}

interface SlashState { query: string; from: number; to: number; left: number; top: number }

function SlashMenu({ state, index, onPick, onHover }: { state: SlashState; index: number; onPick: (b: BlockItem) => void; onHover: (i: number) => void }) {
  const items = filterBlocks(state.query);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  const below = state.top + 340 < window.innerHeight;
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-label="Blok ekle"
      style={{ left: Math.min(state.left, window.innerWidth - 300), ...(below ? { top: state.top + 6 } : { bottom: window.innerHeight - state.top + 30 }) }}
      className="fixed z-[150] w-[284px] max-h-[320px] overflow-y-auto scrollbar-thin bg-surface rounded-2xl shadow-float border border-theme-light/70 p-1.5"
      onMouseDown={e => e.preventDefault()}
    >
      <p className="eyebrow px-2.5 pt-1.5 pb-1">Blok ekle {state.query && `· “${state.query}”`}</p>
      {items.length ? items.map((b, i) => (
        <button
          key={b.id}
          type="button"
          role="option"
          aria-selected={i === index}
          data-i={i}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(b)}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left ${i === index ? 'bg-theme-lightest' : ''}`}
        >
          <span className="w-9 h-9 shrink-0 rounded-xl border border-theme-light/70 bg-surface flex items-center justify-center text-theme-deep"><b.icon size={18} weight="bold" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-theme-text">{b.label}</span>
            <span className="block text-xs text-theme-muted font-medium truncate">{b.hint}</span>
          </span>
        </button>
      )) : <p className="px-2.5 py-3 text-sm text-theme-muted font-medium">Eşleşen blok yok. Esc ile kapatın.</p>}
    </div>,
    document.body,
  );
}

// ---------------- Araç çubuğu ----------------

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.isActive('codeBlock') ? 'code' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      codeBlock: e.isActive('codeBlock'),
      callout: e.isActive('callout'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const [calloutAnchor, setCalloutAnchor] = useState<HTMLElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const c = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-20 rounded-t-3xl bg-surface/95 backdrop-blur border-b border-theme-light/60">
      <div role="toolbar" aria-label="Biçimlendirme" className="flex flex-wrap items-center gap-1 px-3 py-2">
        <Btn icon={ArrowCounterClockwise} label="Geri al" shortcut="Ctrl+Z" disabled={!s.canUndo} onClick={() => c().undo().run()} />
        <Btn icon={ArrowClockwise} label="Yinele" shortcut="Ctrl+Y" disabled={!s.canRedo} onClick={() => c().redo().run()} />
        <Sep />
        <select
          value={s.block === 'code' ? 'p' : s.block}
          disabled={s.block === 'code'}
          onChange={e => BLOCK_ITEMS.find(b => b.id === e.target.value)?.run(editor, onImage)}
          aria-label="Yazı türü"
          title="Yazı türü"
          className="h-9 rounded-xl bg-theme-cream border border-theme-light/60 px-2.5 text-sm font-semibold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium disabled:opacity-50"
        >
          <option value="p">Metin</option>
          <option value="h2">Başlık</option>
          <option value="h3">Alt başlık</option>
        </select>
        <Sep />
        <Btn icon={TextB} label="Kalın" shortcut="Ctrl+B" active={s.bold} onClick={() => c().toggleBold().run()} />
        <Btn icon={TextItalic} label="İtalik" shortcut="Ctrl+I" active={s.italic} onClick={() => c().toggleItalic().run()} />
        <Btn icon={TextUnderline} label="Altı çizili" shortcut="Ctrl+U" active={s.underline} onClick={() => c().toggleUnderline().run()} />
        <Btn icon={TextStrikethrough} label="Üstü çizili" active={s.strike} onClick={() => c().toggleStrike().run()} />
        <Btn icon={HighlighterCircle} label="Vurgula (fosforlu kalem)" shortcut="Ctrl+Shift+H" active={s.highlight} onClick={() => c().toggleHighlight().run()} />
        <Btn icon={Code} label="Satır içi kod" shortcut="Ctrl+E" active={s.code} onClick={() => c().toggleCode().run()} />
        <Btn icon={LinkSimple} label="Bağlantı" active={s.link || linkOpen} onClick={() => setLinkOpen(o => !o)} />
        <Sep />
        <Btn icon={ListBullets} label="Madde listesi" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
        <Btn icon={ListNumbers} label="Numaralı liste" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
        <Btn icon={Terminal} label="Kod / komut bloğu" active={s.codeBlock} onClick={() => c().toggleCodeBlock({ language: 'bash' }).run()} />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => setCalloutAnchor(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={!!calloutAnchor}
          aria-label="Bilgi kutusu ekle"
          title="Bilgi kutusu (vurgulu alan)"
          className={`h-9 px-2 rounded-xl flex items-center gap-1 text-sm font-semibold transition-colors ${s.callout ? 'bg-theme-light text-theme-text' : 'text-theme-deep hover:bg-theme-lightest'}`}
        >
          <Info size={18} weight="bold" /> <span className="hidden md:inline">Kutu</span> <CaretDown size={11} weight="bold" />
        </button>
        <Btn icon={Table} label="Tablo ekle" active={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={s.table} />
        <Btn icon={uploading ? CircleNotch : ImageIcon} label={uploading ? 'Görsel yükleniyor…' : 'Görsel ekle'} onClick={onImage} spin={uploading} />
        <Sep />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => setInsertAnchor(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={!!insertAnchor}
          className="h-9 pl-2.5 pr-3 rounded-xl flex items-center gap-1.5 text-sm font-bold text-theme-deep bg-theme-lightest hover:bg-theme-light/70 transition-colors"
          title="Blok ekle (ya da boş satıra “/” yazın)"
        >
          <Plus size={16} weight="bold" /> Ekle
        </button>
      </div>

      {linkOpen && <LinkBar editor={editor} onClose={() => setLinkOpen(false)} />}
      {s.table && <TableBar editor={editor} />}

      <Menu open={!!insertAnchor} anchor={insertAnchor} onClose={() => setInsertAnchor(null)} align="end" width={280} label="Blok ekle">
        {BLOCK_ITEMS.filter(b => b.id !== 'p').map(b => (
          <MenuItem key={b.id} icon={b.icon} onSelect={() => { setInsertAnchor(null); b.run(editor, onImage); }}>
            <span className="block">{b.label}<span className="block text-xs text-theme-muted font-medium">{b.hint}</span></span>
          </MenuItem>
        ))}
      </Menu>
      <Menu open={!!calloutAnchor} anchor={calloutAnchor} onClose={() => setCalloutAnchor(null)} align="start" width={250} label="Bilgi kutusu">
        {CALLOUT_KINDS.map(k => (
          <MenuItem key={k} icon={CALLOUT[k].icon} onSelect={() => { setCalloutAnchor(null); c().setCallout(k).run(); }}>
            <span className="block">{CALLOUT[k].label}<span className="block text-xs text-theme-muted font-medium">{CALLOUT[k].hint}</span></span>
          </MenuItem>
        ))}
        {s.callout && (
          <>
            <MenuDivider />
            <MenuItem icon={X} onSelect={() => { setCalloutAnchor(null); c().lift('callout').run(); }}>Kutudan çıkar</MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}

function Btn({ icon: I, label, shortcut, active, disabled, onClick, spin }: {
  icon: Icon; label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; spin?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
        active ? 'bg-theme-light text-theme-text' : 'text-theme-deep hover:bg-theme-lightest'
      }`}
    >
      <I size={18} weight="bold" className={spin ? 'animate-spin' : undefined} />
    </button>
  );
}

const Sep = () => <span className="w-px h-6 bg-theme-light/70 mx-1" aria-hidden="true" />;

/** Bağlantı ekleme / düzenleme şeridi. Adres yoksa https:// eklenir; seçili metin yoksa yazılan metin bağlantı olarak eklenir. */
function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes('link').href as string | undefined) ?? '';
  const hasSelection = !editor.state.selection.empty || editor.isActive('link');
  const [href, setHref] = useState(current);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const apply = () => {
    let h = href.trim();
    if (!h) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return onClose();
    }
    if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h)) h = h.includes('@') && !h.includes('/') ? `mailto:${h}` : `https://${h}`;
    if (hasSelection) editor.chain().focus().extendMarkRange('link').setLink({ href: h }).run();
    else editor.chain().focus().insertContent({ type: 'text', text: text.trim() || h, marks: [{ type: 'link', attrs: { href: h } }] }).insertContent(' ').run();
    onClose();
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); apply(); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); editor.commands.focus(); } }}
      className="flex flex-wrap items-center gap-2 px-3 pb-2"
    >
      {!hasSelection && (
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Görünecek metin" aria-label="Bağlantı metni" className="input py-2 text-sm w-44" />
      )}
      <input
        ref={inputRef}
        value={href}
        onChange={e => setHref(e.target.value)}
        placeholder="https://… ya da /docs/sayfa"
        aria-label="Bağlantı adresi"
        className="input py-2 text-sm flex-1 min-w-[200px]"
      />
      <button type="submit" className="btn-primary min-h-[38px] px-3 text-sm"><Check size={15} weight="bold" /> Uygula</button>
      {current && (
        <button type="button" onClick={() => { setHref(''); editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); }} className="btn-secondary min-h-[38px] px-3 text-sm">
          Kaldır
        </button>
      )}
      <button type="button" onClick={onClose} className="icon-btn" aria-label="Kapat"><X size={15} weight="bold" /></button>
    </form>
  );
}

type TableAction = { label: string; icon: Icon; run: () => void; danger?: boolean } | 'divider';

function tableActions(editor: Editor): TableAction[] {
  const c = () => editor.chain().focus();
  return [
    { label: 'Üste satır ekle', icon: ArrowLineUp, run: () => c().addRowBefore().run() },
    { label: 'Alta satır ekle', icon: ArrowLineDown, run: () => c().addRowAfter().run() },
    { label: 'Sola sütun ekle', icon: ArrowLineLeft, run: () => c().addColumnBefore().run() },
    { label: 'Sağa sütun ekle', icon: ArrowLineRight, run: () => c().addColumnAfter().run() },
    'divider',
    { label: 'Başlık satırını aç/kapat', icon: Rows, run: () => c().toggleHeaderRow().run() },
    { label: 'Hücreleri birleştir / ayır', icon: SquareSplitHorizontal, run: () => c().mergeOrSplit().run() },
    'divider',
    { label: 'Satırı sil', icon: Rows, run: () => c().deleteRow().run(), danger: true },
    { label: 'Sütunu sil', icon: Columns, run: () => c().deleteColumn().run(), danger: true },
    { label: 'Tabloyu sil', icon: Trash, run: () => c().deleteTable().run(), danger: true },
  ];
}

/** İmleç tablodayken görünen şerit (aynı işlemler hücrede sağ tıkla da açılır). */
function TableBar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-2" role="toolbar" aria-label="Tablo">
      <span className="eyebrow mr-1">Tablo</span>
      {tableActions(editor).map((a, i) =>
        a === 'divider' ? <Sep key={i} /> : (
          <button
            key={a.label}
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={a.run}
            title={a.label}
            aria-label={a.label}
            className={`h-8 px-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors ${a.danger ? 'text-danger hover:bg-danger-soft' : 'text-theme-deep hover:bg-theme-lightest'}`}
          >
            <a.icon size={15} weight="bold" />
            <span className="hidden xl:inline">{a.label.replace(' ekle', '').replace(' aç/kapat', '')}</span>
          </button>
        ),
      )}
      <span className="text-[11px] text-theme-muted font-semibold ml-auto hidden lg:inline">İpucu: hücrede sağ tıklayın · Tab ile sonraki hücre</span>
    </div>
  );
}
