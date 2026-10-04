// Numbers that roll to their new value instead of jumping, with a brief green
// or red glow for the direction. The tween starts when the current move has
// played out (the piece has landed), so money changes line up with the coin
// sounds. React renders the span empty and GSAP owns its text.

import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { gsap, reducedMotion, stageDelayMs } from './stage';

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export default function AnimatedNumber({ value, format = money, from, flash = true, delay: extraDelay = 0, className, style, title }: {
  value: number;
  format?: (v: number) => string;
  /** Count up from this on first show (e.g. 0 on the win screen); otherwise start at the value. */
  from?: number;
  flash?: boolean;
  /** Extra seconds to wait before counting (on top of the current move playing out). */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = shown.current ?? from ?? value;
    if (start === value || reducedMotion()) {
      shown.current = value;
      el.textContent = formatRef.current(value);
      return;
    }
    el.textContent = formatRef.current(start);
    const delay = stageDelayMs() / 1000 + extraDelay;
    const obj = { v: start };
    const size = Math.abs(value - start);
    const tween = gsap.to(obj, {
      v: value, delay, ease: 'power2.out',
      duration: Math.min(1.3, 0.45 + Math.log10(size + 1) * 0.14),
      onUpdate: () => { shown.current = obj.v; el.textContent = formatRef.current(obj.v); },
      onComplete: () => { shown.current = value; el.textContent = formatRef.current(value); },
    });
    const glow = flash && shown.current !== null
      ? gsap.fromTo(el,
        { backgroundColor: value > start ? 'rgba(34,197,94,0.32)' : 'rgba(239,68,68,0.30)', scale: 1.1 },
        { backgroundColor: 'rgba(0,0,0,0)', scale: 1, delay, duration: 1.1, ease: 'power2.out', immediateRender: false, clearProps: 'backgroundColor,transform' })
      : null;
    if (shown.current === null) shown.current = start;
    return () => { tween.kill(); glow?.kill(); };
  }, [value, from, flash, extraDelay]);

  return <span ref={ref} className={className} title={title}
    style={{ display: 'inline-block', borderRadius: 3, padding: '0 2px', margin: '0 -2px', ...style }} />;
}
