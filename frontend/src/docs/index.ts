import type { Icon } from '@phosphor-icons/react';
import { RocketLaunch, GitBranch, TreeStructure, ShieldCheck } from '@phosphor-icons/react';
import { parseFrontmatter, parseMarkdown, plainText } from '../lib/markdown';
import type { Block } from '../lib/markdown';

/*
 * Dokümantasyon içeriği: articles/ klasöründeki her .md dosyası bir sayfadır (dosya adı = adres).
 * Yeni bir doküman eklemek için frontmatter'ı olan bir .md dosyası bırakmak yeterli:
 *   title, category (aşağıdaki id'lerden biri), order, summary, author, updated (yyyy-MM-dd), tags (virgülle)
 */

export interface DocCategory { id: string; name: string; icon: Icon }

export const DOC_CATEGORIES: DocCategory[] = [
  { id: 'baslarken', name: 'Başlarken', icon: RocketLaunch },
  { id: 'surecler', name: 'Süreçler', icon: GitBranch },
  { id: 'mimari', name: 'Mimari', icon: TreeStructure },
  { id: 'kalite', name: 'Kalite ve Operasyon', icon: ShieldCheck },
];

export interface DocArticle {
  slug: string;
  title: string;
  category: string;
  order: number;
  summary: string;
  author: string;
  updated: string;
  tags: string[];
  blocks: Block[];
  /** arama için düz metin */
  text: string;
  readMinutes: number;
}

const files = import.meta.glob('./articles/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const categoryRank = new Map(DOC_CATEGORIES.map((c, i) => [c.id, i]));

export const DOCS: DocArticle[] = Object.entries(files)
  .map(([path, raw]) => {
    const { meta, body } = parseFrontmatter(raw);
    const text = plainText(body);
    return {
      slug: path.replace(/^.*\/|\.md$/g, ''),
      title: meta.title ?? 'Başlıksız',
      category: meta.category ?? DOC_CATEGORIES[0].id,
      order: Number(meta.order ?? 99),
      summary: meta.summary ?? '',
      author: meta.author ?? '',
      updated: meta.updated ?? '',
      tags: (meta.tags ?? '').split(',').map(t => t.trim()).filter(Boolean),
      blocks: parseMarkdown(body),
      text,
      readMinutes: Math.max(1, Math.round(text.split(' ').length / 200)),
    };
  })
  .sort((a, b) => (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99) || a.order - b.order);

export const docBySlug = (slug: string | undefined) => DOCS.find(d => d.slug === slug);
