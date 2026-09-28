import { useEffect, useRef, useState } from 'react';

// Ease-out cubic — fast start, gentle landing, classic "counter roll-up" feel.
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Rolls a number up/down from its previous value to the new one whenever the
// target changes (e.g. the range switcher on the manager overview). The value
// is formatted every frame through the supplied `format` fn, so currency and
// plain counts both work: <AnimatedNumber value={x} format={formatPeso} />
export default function AnimatedNumber({ value, format = (n) => n, duration = 650 }) {
  const [display, setDisplay] = useState(() => Number(value) || 0);
  const fromRef = useRef(Number(value) || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // Whatever we were heading toward becomes the next starting point, so
      // rapid range-switching never "rewinds" through stale numbers.
      fromRef.current = to;
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}