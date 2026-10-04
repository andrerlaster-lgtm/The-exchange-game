// Small GSAP hooks shared by the game screen.

import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Flip, gsap, onBeforeChange, reducedMotion, stageDelayMs } from './stage';

/** Items marked with data-flip-id inside `container` slide to their new places
    when `orderKey` changes (standings overtaking, holdings bought or sold),
    instead of jumping. Positions are recorded just before each state change. */
export function useFlipReorder(container: RefObject<HTMLElement>, orderKey: string, scope = '') {
  const saved = useRef<Flip.FlipState | null>(null);
  const lastKey = useRef(orderKey);
  const lastScope = useRef(scope);

  useEffect(() => onBeforeChange(() => {
    const items = container.current?.querySelectorAll('[data-flip-id]');
    saved.current = items && items.length ? Flip.getState(items) : null;
  }), [container]);

  useLayoutEffect(() => {
    // A different list altogether (another player's portfolio) just swaps in.
    const sameScope = lastScope.current === scope;
    lastScope.current = scope;
    if (lastKey.current === orderKey) return;
    lastKey.current = orderKey;
    const state = saved.current;
    saved.current = null;
    if (!sameScope) return;
    const items = container.current?.querySelectorAll('[data-flip-id]');
    if (!state || !items || reducedMotion()) return;
    Flip.from(state, {
      targets: items,
      duration: 0.6,
      delay: stageDelayMs() / 1000,
      ease: 'power2.inOut',
      prune: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }),
    });
  }, [orderKey, scope, container]);
}

/** Plays a short entrance on `ref` each time `key` becomes a new non-null value. */
export function useEntrance(ref: RefObject<HTMLElement>, key: string | null, vars: gsap.TweenVars = { y: 22, opacity: 0, scale: 0.96 }) {
  const last = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (key === last.current) return;
    last.current = key;
    if (!key || !ref.current || reducedMotion()) return;
    gsap.from(ref.current, { ...vars, duration: 0.42, ease: 'back.out(1.5)', clearProps: 'transform,opacity' });
  });
}
