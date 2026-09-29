/**
 * Grafik renkleri. Sıralı zeytin rampası (açık → koyu) dataviz doğrulayıcısından geçti:
 * tek ton, monoton açıklık, adımlar arası yeterli fark, açık uç beyaz yüzeyde >= 2:1.
 */
export const OLIVE_RAMP = ['#9CAB84', '#6F7F52', '#465233'] as const;
/** Tek serili grafikler için rampanın orta basamağı */
export const SERIES_COLOR = OLIVE_RAMP[1];

/**
 * Sağlık durumu renkleri (doğrulandı: CVD ayrımı ve normal görüş eşiği geçer). Uyarı rengi beyaz yüzeyde 3:1'in altında
 * olduğu için durum her zaman ikon + yazıyla birlikte gösterilir; metinler bu renkleri giymez.
 */
export const STATUS_COLOR = {
  UP: '#5E7D2C',
  WARN: '#C08F1F',
  DOWN: '#B5532E',
  UNKNOWN: '#CFC8B0',
} as const;
