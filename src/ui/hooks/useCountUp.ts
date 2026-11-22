import { useEffect, useState } from 'react';

export function useCountUp(value: number | undefined) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined) {
      setDisplayValue(0);
      return;
    }
    const from = displayValue;
    const start = performance.now();
    let frame = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return displayValue;
}
