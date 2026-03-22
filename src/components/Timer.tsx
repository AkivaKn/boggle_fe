// ...existing code...
import { useEffect, useState, useRef } from "react";

async function ensureResume(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

export const Timer: React.FC<{ endsAt: string }> = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalDuration = 180;

  const audioRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  const getAudio = async () => {
    const ctx =
      audioRef.current ??
      (audioRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )());
    await ensureResume(ctx);
    return ctx;
  };

  // Warm audio on first user gesture so first real beep is not clipped
  useEffect(() => {
    const warm = () => {
      void getAudio();
    };
    window.addEventListener("pointerdown", warm, { once: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  const scheduleTone = (
    ctx: AudioContext,
    targetMs: number,
    frequency: number,
    durationMs: number,
  ) => {
    const nowMs = Date.now();
    const startAt = ctx.currentTime + Math.max(0, (targetMs - nowMs) / 1000);
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

    oscillatorsRef.current.push(osc);
  };

  // visible countdown
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      return diff > 0 ? Math.ceil(diff / 1000) : 0;
    };

    setTimeLeft(calc());
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => setTimeLeft(calc()), 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endsAt]);

  // schedule beeps on AudioContext clock (sample-accurate)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // stop any previous scheduled oscillators
      oscillatorsRef.current.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* ignore */
        }
      });
      oscillatorsRef.current = [];

      const endsMs = new Date(endsAt).getTime();
      if (!Number.isFinite(endsMs)) return;

      const ctx = await getAudio();
      if (cancelled) return;

      [3, 2, 1].forEach((s) => {
        scheduleTone(ctx, endsMs - s * 1000, 880, 180);
      });
      scheduleTone(ctx, endsMs, 440, 420);
    };

    void run();

    return () => {
      cancelled = true;
      oscillatorsRef.current.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* ignore */
        }
      });
      oscillatorsRef.current = [];
    };
  }, [endsAt]);

  useEffect(() => {
    return () => {
      oscillatorsRef.current.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* ignore */
        }
      });
      oscillatorsRef.current = [];

      if (intervalRef.current) clearInterval(intervalRef.current);

      if (audioRef.current) {
        try {
          audioRef.current.close();
        } catch {
          /* ignore */
        }
        audioRef.current = null;
      }
    };
  }, []);

  const percentage = (timeLeft / totalDuration) * 100;

  return (
    <div className="w-full mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
          Live Clock
        </span>
        <span
          className={`text-3xl font-mono font-black ${timeLeft < 30 ? "text-red-500 animate-pulse" : "text-indigo-600"}`}
        >
          {Math.floor(timeLeft / 60)}:
          {(timeLeft % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timeLeft < 30 ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
