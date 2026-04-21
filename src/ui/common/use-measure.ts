import { useEffect, useRef, useState } from 'react';

export function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    obs.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    return () => obs.disconnect();
  }, []);
  return [ref, size];
}
