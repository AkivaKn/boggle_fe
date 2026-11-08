import { useCallback, useEffect, useRef, useState } from "react";

export type TurnClock = {
  remainingMs: number;
  remainingSec: number;
  progress: number;
  paused: boolean;
  pause: () => void;
  resume: () => void;
};

export function useTurnClock(
  durationSec: number,
  onExpire: () => void,
): TurnClock {
  const durationMs = Math.max(1, durationSec * 1000);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [paused, setPaused] = useState(false);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(durationMs);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const pausedRef = useRef(false);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const start = useCallback(
    (ms: number) => {
      stopRaf();
      doneRef.current = false;
      deadlineRef.current = performance.now() + ms;
      const tick = () => {
        if (pausedRef.current || doneRef.current) return;
        const left = Math.max(0, deadlineRef.current - performance.now());
        remainingRef.current = left;
        setRemainingMs(left);
        if (left <= 0) {
          doneRef.current = true;
          expireRef.current();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopRaf],
  );

  useEffect(() => {
    start(durationMs);
    return stopRaf;
  }, [durationMs, start, stopRaf]);

  const pause = useCallback(() => {
    if (pausedRef.current || doneRef.current) return;
    pausedRef.current = true;
    remainingRef.current = Math.max(
      0,
      deadlineRef.current - performance.now(),
    );
    setRemainingMs(remainingRef.current);
    setPaused(true);
    stopRaf();
  }, [stopRaf]);

  const resume = useCallback(() => {
    if (!pausedRef.current || doneRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    start(remainingRef.current);
  }, [start]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.hidden) pause();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  return {
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    progress: Math.min(1, Math.max(0, remainingMs / durationMs)),
    paused,
    pause,
    resume,
  };
}
