/**
 * Dokümantasyon için küçük, bağımlılıksız Markdown ayrıştırıcı. Desteklenenler:
 *  - frontmatter (--- ile başlayan "anahtar: değer" satırları)
 *  - ## / ### başlıklar (id'leri Türkçe karakterlerden arındırılmış slug)
 *  - paragraflar, - / 1. listeler, --- ayırıcı
 *  - ```dil kod blokları
 *  - > [!NOT] / [!IPUCU] / [!UYARI] / [!ONEMLI] bilgi kutuları
 *  - | tablo | satırları |
 * Satır içi biçimler (`kod`, **kalın**, *italik*, [bağlantı](url)) render sırasında işlenir.
 */

export type CalloutKind = 'NOT' | 'IPUCU' | 'UYARI' | 'ONEMLI';

export type Block =
  | { type: 'heading'; level: 2 | 3; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'callout'; kind: CalloutKind; lines: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'rule' };

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

export function slugify(text: string) {
  return text
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, ch => TR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/`|\*/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseFrontmatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, string> = {};
  m[1].split(/\r?\n/).forEach(line => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { meta, body: src.slice(m[0].length) };
}

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function parseMarkdown(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const usedIds = new Map<string, number>();
  let i = 0;

  const uniqueId = (text: string) => {
    const base = slugify(text) || 'baslik';
    const n = usedIds.get(base) ?? 0;
    usedIds.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    const fence = /^```(\S*)/.exec(trimmed);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[1] || 'text', code: code.join('\n') });
      continue;
    }

    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length as 2 | 3, text: h[2], id: uniqueId(h[2]) });
      i++;
      continue;
    }

    if (/^---+$/.test(trimmed)) { blocks.push({ type: 'rule' }); i++; continue; }

    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/, ''));
      const kind = /^\[!(NOT|IPUCU|UYARI|ONEMLI)\]/.exec(quote[0] ?? '');
      if (kind) quote[0] = quote[0].slice(kind[0].length).trim();
      blocks.push({ type: 'callout', kind: (kind?.[1] as CalloutKind) ?? 'NOT', lines: quote.filter(Boolean) });
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i++].trim();
        if (!/^\|?\s*:?-{2,}/.test(row)) rows.push(splitRow(row));
      }
      blocks.push({ type: 'table', head: rows[0] ?? [], rows: rows.slice(1) });
      continue;
    }

    const listItem = /^(-|\d+\.)\s+/;
    if (listItem.test(trimmed)) {
      const ordered = /^\d+\./.test(trimmed);
      const items: string[] = [];
      while (i < lines.length && listItem.test(lines[i].trim())) items.push(lines[i++].trim().replace(listItem, ''));
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{2,3}\s|>|\||-\s|\d+\.\s|---+$)/.test(lines[i].trim())) para.push(lines[i++].trim());
    if (!para.length) para.push(lines[i++].trim()); // tanınmayan tek satır: sonsuz döngüye girmesin
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }
  return blocks;
}

/** Satır içi parçalar: render bileşeni bunları React öğelerine çevirir. */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; v: string }
  | { t: 'em'; v: string }
  | { t: 'link'; v: string; href: string };

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'strong', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'em', v: m[3] });
    else out.push({ t: 'link', v: m[4], href: m[5] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/** Arama ve okuma süresi için düz metin */
export function plainText(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[!(NOT|IPUCU|UYARI|ONEMLI)\]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, ' ')
    .replace(/^\s*(#{1,6}|>|-|\d+\.)\s+/gm, ' ')
    .replace(/[*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
