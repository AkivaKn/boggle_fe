// Ported from Boggle FE (`boggle_fe/src/components/Timer.tsx`) and RESTYLED in
// M5: the visible countdown now retreats CONTINUOUSLY via requestAnimationFrame
// (SPEC v1.1: never 1-second steps — every frame updates the bar from the
// wall-clock `ends_at`), the bar is a thin gold gradient with a glow, and the
// end phase pulses red under 10s. The WebAudio beeps remain the M2-approved
// sample-accurate scheduling, byte-identical (M2 review finding 5 posture
// kept: past-due targets filtered before AudioContext creation).
import { useEffect, useRef, useState } from "react";

export interface TimerProps {
  /** ISO deadline issued by the server (stateless `ends_at`, SPEC §1). */
  endsAt: string;
  /** Total budget for this question in seconds — sizes the progress bar. */
  budgetSeconds: number;
}

const remainingMs = (endsAt: string): number => {
  const t = new Date(endsAt).getTime();
  // Invalid/missing `ends_at` renders 0 — never NaN (defensive, M2 review 6).
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0;
};

type AudioCtxCtor = new () => AudioContext;

const newAudioContext = (): AudioContext => {
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtxCtor })
      .webkitAudioContext;
  if (!ctor) throw new Error("WebAudio unavailable");
  return new ctor();
};

const ensureResume = async (ctx: AudioContext): Promise<void> => {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
};

/** Sample-accurate tone on the AudioContext clock (Boggle pattern). */
const scheduleTone = (
  ctx: AudioContext,
  targetMs: number,
  frequency: number,
  durationMs: number,
): OscillatorNode => {
  const startAt = ctx.currentTime + Math.max(0, (targetMs - Date.now()) / 1000);
  const dur = Math.max(0.08, durationMs / 1000);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + dur + 0.01);

  return osc;
};

const stopOscillators = (oscillatorsRef: React.RefObject<OscillatorNode[]>) => {
  oscillatorsRef.current?.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* ignore */
    }
  });
  oscillatorsRef.current = [];
};

export const Timer: React.FC<TimerProps> = ({ endsAt, budgetSeconds }) => {
  // Lazy init: no synchronous setState in effects (react-hooks v7 rule);
  // while the first rAF frame catches up, a fresh endsAt can read a
  // negligible fraction of a frame off.
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() =>
    remainingMs(endsAt),
  );

  const audioRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  const getAudio = async (): Promise<AudioContext> => {
    if (!audioRef.current) {
      try {
        audioRef.current = newAudioContext();
      } catch {
        // No WebAudio — the countdown still works, just silently.
        return null as unknown as AudioContext;
      }
    }
    await ensureResume(audioRef.current);
    return audioRef.current;
  };

  // Warm audio on first user gesture so the first real beep is not clipped
  // (refs only — no effect deps).
  useEffect(() => {
    const warm = () => {
      if (!audioRef.current) {
        try {
          audioRef.current = newAudioContext();
        } catch {
          return;
        }
      }
      void ensureResume(audioRef.current);
    };
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  // M5 continuous retreat: requestAnimationFrame loop — the bar is updated
  // EVERY frame straight from the wall clock (no 250ms tick, no 1s jumps).
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      setTimeLeftMs(remainingMs(endsAt));
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [endsAt]);

  // Schedule beeps on the AudioContext clock (sample-accurate): 880Hz at
  // 3/2/1s remaining, 440Hz at 0 — the last-3-seconds pattern.
  useEffect(() => {
    let cancelled = false;
    stopOscillators(oscillatorsRef);

    const run = async () => {
      const endsMs = new Date(endsAt).getTime();
      if (!Number.isFinite(endsMs)) return;

      // M2 review finding 5: on an already-expired `ends_at` (e.g. a rejoin
      // mounting mid-window-end) skip ALL past-due targets silently — no
      // beep burst, no clamping, and no AudioContext created needlessly.
      const now = Date.now();
      const targets = [
        { at: endsMs - 3000, freq: 880, dur: 180 },
        { at: endsMs - 2000, freq: 880, dur: 180 },
        { at: endsMs - 1000, freq: 880, dur: 180 },
        { at: endsMs, freq: 440, dur: 420 },
      ].filter((t) => t.at > now);
      if (targets.length === 0) return;

      const ctx = await getAudio();
      if (cancelled || !ctx) return;

      targets.forEach((t) => {
        oscillatorsRef.current.push(scheduleTone(ctx, t.at, t.freq, t.dur));
      });
    };

    void run();

    return () => {
      cancelled = true;
      stopOscillators(oscillatorsRef);
    };
  }, [endsAt]);

  // Full teardown on unmount.
  useEffect(() => {
    return () => {
      stopOscillators(oscillatorsRef);
      if (audioRef.current) {
        try {
          void audioRef.current.close();
        } catch {
          /* ignore */
        }
        audioRef.current = null;
      }
    };
  }, []);

  const seconds = Math.ceil(timeLeftMs / 1000);
  // Urgent phase keyed on raw ms (continuous, not stepped).
  const urgent = timeLeftMs < 10_000;
  // Fraction of the FULL budget remaining — continuous ms fraction, so the
  // bar retreats smoothly every frame instead of in 1/second or 1/4s steps.
  const budgetMs = Math.max(1, budgetSeconds * 1000);
  const percentage = (timeLeftMs / budgetMs) * 100;

  return (
    <div className="w-full mb-4" aria-label="Question timer">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-black text-gold-500/80 uppercase tracking-[0.25em]">
          Time
        </span>
        <span
          className={`text-2xl font-mono font-black transition-colors duration-[250ms] ${
            urgent ? "text-red-500 animate-pulse" : "text-gold-300"
          }`}
        >
          {seconds}
        </span>
      </div>
      <div className="h-2 w-full bg-stage-void rounded-full overflow-hidden border border-gold-500/25">
        <div
          className={`h-full ${
            urgent
              ? "bg-gradient-to-r from-red-600 to-red-400 animate-pulse"
              : "bg-gradient-to-r from-gold-600 via-gold-500 to-gold-300 shadow-[0_0_10px_rgba(212,175,55,0.6)]"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};
