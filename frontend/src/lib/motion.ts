import type { Transition, Variants } from 'framer-motion';

// Tüm animasyonlar aynı ritmi paylaşır.
export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 };
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 26 };

// Çıkışlar girişten ~%60 daha kısa.
export const popover: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.11, ease: [0.4, 0, 1, 1] } },
};

export const modal: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: softSpring },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

export const page: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

/**
 * Sayfa geçişi (deneme): yeni sayfa soldaki menünün kenarından başlayıp sağa doğru açılarak alanı doldurur.
 * clip-path yalnızca geçiş sırasında uygulanır; bitince kaldırılır ki gölgeler/taşan öğeler kırpılmasın.
 * Eski hâline dönmek için AppLayout'ta pageWipe yerine page kullanmak yeterli.
 */
const WIPE_EASE = [0.65, 0, 0.35, 1] as const;
export const WIPE_DURATION = 0.6;

export const pageWipe: Variants = {
  hidden: { clipPath: 'inset(0% 100% 0% 0%)' },
  visible: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: WIPE_DURATION, ease: WIPE_EASE }, transitionEnd: { clipPath: 'none' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
};

/** Açılan sayfanın önünden giden ince ışık kenarı */
export const wipeEdge: Variants = {
  hidden: { left: '0%', opacity: 1 },
  visible: {
    left: '100%',
    opacity: 0,
    transition: { left: { duration: WIPE_DURATION, ease: WIPE_EASE }, opacity: { delay: WIPE_DURATION * 0.75, duration: WIPE_DURATION * 0.25 } },
  },
};

// Liste öğeleri 40ms arayla gelir.
export const listContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};
