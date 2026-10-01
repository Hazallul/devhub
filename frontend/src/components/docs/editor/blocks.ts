import type { Editor } from '@tiptap/core';
import type { Icon } from '@phosphor-icons/react';
import { TextH, TextHThree, Paragraph, ListBullets, ListNumbers, Terminal, Table, Image as ImageIcon, Minus, Info, Lightbulb, Warning, WarningOctagon } from '@phosphor-icons/react';

/** Editöre eklenebilen bloklar: araç çubuğu, "/" menüsü ve sağ tık aynı listeyi kullanır. */
export interface BlockItem {
  id: string;
  label: string;
  hint: string;
  icon: Icon;
  /** "/" menüsünde aramaya yardımcı kelimeler */
  keywords: string;
  run: (editor: Editor, pickImage: () => void) => void;
}

const chain = (e: Editor) => e.chain().focus();

export const BLOCK_ITEMS: BlockItem[] = [
  { id: 'p', label: 'Metin', hint: 'Düz paragraf', icon: Paragraph, keywords: 'metin paragraf yazi', run: e => chain(e).setParagraph().run() },
  { id: 'h2', label: 'Başlık', hint: 'Bölüm başlığı, "Bu sayfada" listesinde görünür', icon: TextH, keywords: 'baslik heading h2', run: e => chain(e).setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Alt başlık', hint: 'Bölüm içinde küçük başlık', icon: TextHThree, keywords: 'alt baslik h3', run: e => chain(e).setHeading({ level: 3 }).run() },
  { id: 'ul', label: 'Madde listesi', hint: '• ile sıralanan liste', icon: ListBullets, keywords: 'liste madde bullet', run: e => chain(e).toggleBulletList().run() },
  { id: 'ol', label: 'Numaralı liste', hint: '1, 2, 3 adımlar', icon: ListNumbers, keywords: 'liste numarali adim sirali', run: e => chain(e).toggleOrderedList().run() },
  { id: 'code', label: 'Kod / komut', hint: 'Terminal, CMD, SQL… kopyalanabilir kutu', icon: Terminal, keywords: 'kod komut cmd terminal bash powershell sql', run: e => chain(e).toggleCodeBlock({ language: 'bash' }).run() },
  { id: 'table', label: 'Tablo', hint: '3 × 3, başlık satırlı', icon: Table, keywords: 'tablo table', run: e => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'image', label: 'Görsel', hint: 'Bilgisayardan resim yükle (en fazla 5 MB)', icon: ImageIcon, keywords: 'gorsel resim foto image ekran goruntusu', run: (_e, pick) => pick() },
  { id: 'NOT', label: 'Not kutusu', hint: 'Ek bilgi için vurgulu alan', icon: Info, keywords: 'not kutu vurgu bilgi', run: e => chain(e).setCallout('NOT').run() },
  { id: 'IPUCU', label: 'İpucu kutusu', hint: 'İşi kolaylaştıran öneri', icon: Lightbulb, keywords: 'ipucu kutu vurgu', run: e => chain(e).setCallout('IPUCU').run() },
  { id: 'UYARI', label: 'Uyarı kutusu', hint: 'Dikkat edilmesi gereken', icon: Warning, keywords: 'uyari dikkat kutu vurgu', run: e => chain(e).setCallout('UYARI').run() },
  { id: 'ONEMLI', label: 'Önemli kutusu', hint: 'Atlanmaması gereken kural', icon: WarningOctagon, keywords: 'onemli kritik kutu vurgu', run: e => chain(e).setCallout('ONEMLI').run() },
  { id: 'hr', label: 'Ayırıcı çizgi', hint: 'Bölümleri ayırır', icon: Minus, keywords: 'ayirici cizgi', run: e => chain(e).setHorizontalRule().run() },
];

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, ch => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[ch] ?? ch);

export const filterBlocks = (query: string) => {
  const q = fold(query.trim());
  return q ? BLOCK_ITEMS.filter(b => fold(`${b.label} ${b.keywords}`).includes(q)) : BLOCK_ITEMS;
};
