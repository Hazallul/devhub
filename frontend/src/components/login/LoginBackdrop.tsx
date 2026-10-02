import { motion, useReducedMotion } from 'framer-motion';

/**
 * Giriş ekranının zemini: perspektifte uzanan ışık bantları (3D tavan/duvar paneli hissi).
 * src/assets/login/ altına bir görsel (bg.jpg / bg.png / bg.webp) konursa o kullanılır; yoksa bantlar CSS ile çizilir.
 * Görsel derleme anında bulunur (import.meta.glob), dosya yoksa ağ isteği de yapılmaz.
 */
const images = import.meta.glob('../../assets/login/bg.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const IMAGE = Object.values(images)[0];

/** Bantların dikey konumu (%), kalınlığı (rem), yatay kayma ve sürüklenme süresi */
const BANDS = [
  { top: 4, h: 5.5, shift: -18, dur: 38 },
  { top: 17, h: 4, shift: 6, dur: 31 },
  { top: 28, h: 7, shift: -4, dur: 44 },
  { top: 43, h: 3.5, shift: 14, dur: 27 },
  { top: 54, h: 6, shift: -12, dur: 36 },
  { top: 68, h: 4.5, shift: 8, dur: 33 },
  { top: 80, h: 6.5, shift: -6, dur: 41 },
];

export default function LoginBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-ink">
      {IMAGE ? (
        <motion.img src={IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover"
          initial={reduce ? false : { scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
      ) : (
        <div className="absolute inset-0 [perspective:70rem]">
          <div className="absolute -inset-x-1/4 -top-1/4 h-[150%] [transform:rotateX(58deg)_rotateZ(-9deg)] [transform-origin:50%_30%]">
            {BANDS.map((b, i) => (
              <motion.div
                key={i}
                className="absolute left-0 right-0 rounded-full blur-[1.5px]"
                style={{
                  top: `${b.top}%`,
                  height: `${b.h}rem`,
                  background: 'linear-gradient(90deg, transparent 0%, rgb(var(--accent) / 0.55) 18%, rgb(var(--medium)) 42%, rgb(255 255 255 / 0.95) 50%, rgb(var(--medium)) 58%, rgb(var(--accent) / 0.6) 80%, transparent 100%)',
                  boxShadow: '0 0 3rem rgb(var(--medium) / 0.35)',
                }}
                initial={{ x: `${b.shift}%` }}
                animate={reduce ? undefined : { x: [`${b.shift}%`, `${b.shift + (i % 2 ? -7 : 7)}%`, `${b.shift}%`] }}
                transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      )}
      {/* Okunurluk: kenarlar ve alt kısım koyulaşır, kartın arkası sakin kalır */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_0%,rgb(0_0_0/0.25)_60%,rgb(0_0_0/0.55)_100%)]" />
    </div>
  );
}
