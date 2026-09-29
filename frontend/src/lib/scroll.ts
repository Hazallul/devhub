/**
 * Bir elemanı kaydırılabilir kapsayıcının ortasına yumuşakça getirir; kaydırma bitince çözülür.
 * Tarayıcının 'smooth' kaydırması yerine rAF kullanılır: süre mesafeye göre ayarlanır, bitişi kesin bilinir
 * ve kullanıcı tekerlek/dokunmayla araya girerse animasyon hemen bırakılır.
 */
export function scrollIntoCenter(container: HTMLElement, el: HTMLElement, instant = false): Promise<void> {
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const target = container.scrollTop + (r.top - c.top) - (c.height - Math.min(r.height, c.height)) / 2;
  const to = Math.max(0, Math.min(target, container.scrollHeight - container.clientHeight));
  const from = container.scrollTop;
  const distance = to - from;

  if (Math.abs(distance) < 2) return Promise.resolve();
  if (instant) {
    container.scrollTop = to;
    return Promise.resolve();
  }

  // Kısa mesafe hızlı, uzun mesafe biraz daha uzun ama 1.1 sn'yi geçmez.
  const duration = Math.min(1100, Math.max(450, Math.abs(distance) * 0.6));
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  return new Promise(resolve => {
    let frame = 0;
    let start: number | null = null;
    const stop = () => {
      cancelAnimationFrame(frame);
      container.removeEventListener('wheel', stop);
      container.removeEventListener('touchstart', stop);
      resolve();
    };
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      container.scrollTop = from + distance * ease(t);
      if (t < 1) frame = requestAnimationFrame(step);
      else stop();
    };
    container.addEventListener('wheel', stop, { passive: true });
    container.addEventListener('touchstart', stop, { passive: true });
    frame = requestAnimationFrame(step);
  });
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
