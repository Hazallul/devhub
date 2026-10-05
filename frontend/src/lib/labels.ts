import type { LabelColor } from '../types';

/**
 * Etiket renkleri. Sınıf adları burada açıkça yazılı durur (Tailwind yalnızca kaynakta gördüğü sınıfları tutar);
 * değerler index.css'teki --lbl-* değişkenleridir ve koyu temada açılır.
 */
export const LABEL_COLORS: Record<LabelColor, { name: string; cls: string }> = {
  blue: { name: 'Mavi', cls: 'label-blue' },
  green: { name: 'Yeşil', cls: 'label-green' },
  amber: { name: 'Sarı', cls: 'label-amber' },
  red: { name: 'Kırmızı', cls: 'label-red' },
  violet: { name: 'Mor', cls: 'label-violet' },
  teal: { name: 'Turkuaz', cls: 'label-teal' },
  pink: { name: 'Pembe', cls: 'label-pink' },
  gray: { name: 'Gri', cls: 'label-gray' },
};

export const LABEL_COLOR_LIST = Object.keys(LABEL_COLORS) as LabelColor[];
