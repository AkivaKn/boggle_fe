import type { Lifeline } from "../api";

export interface LifelinesProps {
  /** Per-run one-use flags for THIS player's seat (SPEC §1: lifelines are
   *  per-player; the `lifeline_used` broadcast SETS the own-seat flag). */
  used: Record<Lifeline, boolean>;
  /** Lifeline whose `lifeline_used` event is still pending (optimistic
   *  state — the button stays "pressed"/spinning until the broadcast). */
  pending: Lifeline | null;
  /** Overall interlock, same posture as answering: false while the local run
   *  is not active (fallen/walked/won) or the question is resolved/locked. */
  disabled: boolean;
  /** POST via api.useLifeline() happens in App (owns room/token). */
  onUse: (lifeline: Lifeline) => void;
}

const BUTTONS: Array<{
  lifeline: Lifeline;
  label: string;
  hint: string;
}> = [
  { lifeline: "fifty_fifty", label: "50:50", hint: "Remove two wrong answers" },
  { lifeline: "audience", label: "AUD", hint: "Ask the audience" },
  { lifeline: "switch", label: "SWAP", hint: "Switch question" },
];

/** Three circular lifeline buttons (SPEC §1: one use each per run) — M5:
 *  glowing amber circles; used = hollow grey with a strike; the M3 pending
 *  spinner and one-pending-at-a-time logic are untouched. */
export const Lifelines: React.FC<LifelinesProps> = ({
  used,
  pending,
  disabled,
  onUse,
}) => (
  <div className="flex justify-center gap-4">
    {BUTTONS.map(({ lifeline, label, hint }) => {
      const isUsed = used[lifeline];
      const isPending = pending === lifeline;
      // One pending lifeline at a time — every button is inert while one is
      // in flight, and a used lifeline can never fire again this run.
      const off = isUsed || disabled || (pending !== null && !isPending);
      return (
        <div key={lifeline} className={isUsed ? "" : "glow-lifeline"}>
          <button
            type="button"
            disabled={off}
            aria-label={hint}
            title={hint}
            onClick={() => {
              if (!off && !isPending) onUse(lifeline);
            }}
            className={`relative grid h-14 w-14 place-items-center rounded-full border-2 text-xs font-black uppercase tracking-wide transition-all duration-[250ms] hover:-rotate-3 ${
              isUsed
                ? "border-slate-700 bg-transparent text-slate-600 line-through decoration-slate-600 cursor-not-allowed grayscale"
                : off
                  ? "border-slate-700 bg-stage-900/60 text-slate-500 cursor-not-allowed"
                  : "border-gold-500 bg-[radial-gradient(circle_at_35%_30%,rgba(212,175,55,0.25),rgba(11,11,59,0.9))] text-gold-300 hover:border-gold-400 hover:text-gold-200 active:scale-90 cursor-pointer"
            } ${isPending ? "animate-pulse scale-90 border-gold-300 text-gold-200" : ""}`}
          >
            {isPending ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-gold-300 border-t-transparent"
                aria-hidden
              />
            ) : (
              label
            )}
            {isUsed && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-800 px-1.5 text-xs font-black uppercase tracking-widest text-slate-400">
                Used
              </span>
            )}
          </button>
        </div>
      );
    })}
  </div>
);

export interface AudienceChartProps {
  /** Server-computed 4-percentage array (SPEC §2 `lifeline_used` audience
   *  data). Purely the fake poll's weights — deliberately NOT a
   *  correct-answer indicator, so all bars share one neutral color and no
   *  correct_index is ever rendered. */
  percentages: number[];
}

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

/** Inline 4-bar poll chart shown while the audience result is up (auto-
 *  dismissed by App after ~8s or on question change). */
export const AudienceChart: React.FC<AudienceChartProps> = ({
  percentages,
}) => (
  <div
    className="mt-3 rounded-xl border border-gold-500/30 bg-stage-950/85 px-4 py-3 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
    role="status"
    aria-label="Audience poll result"
  >
    <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.25em] text-gold-500/90">
      Audience poll
    </p>
    <div className="flex items-end justify-center gap-4 h-24">
      {percentages.map((pct, i) => {
        const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
        return (
          <div
            key={i}
            className="flex h-full w-12 flex-col items-center justify-end gap-1"
          >
            <span className="text-xs font-mono font-bold text-amber-200">
              {Math.round(safe)}%
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-amber-600/70 to-amber-400/80 transition-[height] duration-500"
              style={{ height: `${Math.max(2, safe)}%` }}
              aria-hidden
            />
            <span className="text-xs font-black text-slate-400">
              {CHOICE_LABELS[i] ?? i}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);
