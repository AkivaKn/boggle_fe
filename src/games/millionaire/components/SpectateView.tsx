import { GBP, amountAt } from "../api";
import { JourneyRecap, type JourneyStep } from "./JourneyRecap";
import { OpponentPanel } from "./OpponentPanel";

/**
 * UX v3 wave 5a — the SPECTATE screen (docs/plan/v3-ux-plan.md, wave-5a
 * record): when THIS seat has lapsed (fallen/walked) and the duel room still
 * has an ACTIVE survivor, this replaces the bare run-end interim — the
 * fallen card (compact) + the live rival strip + the COMPLETE journey.
 *
 * The rival strip reuses `OpponentPanel` (compact mirrored ladder) driven by
 * the wave-4 `opponent_progress` public facts ({seat, level, amount,
 * status:"active"}) — NEVER the survivor's private reveal (`answer_result`
 * is private; `opponent_reveal` is only sent to still-active seats), so
 * `reveal` is hard-null here and no correct answer can leak into this view.
 * No question plate renders (a lapsed seat cannot answer — the run-end card
 * and the journey own the screen until `game_over`).
 */
export interface SpectateViewProps {
  /** Run-end headline (the RUN_END_COPY title, e.g. "You fell"). */
  title: string;
  /** Run-end headline color class (rose/sky per status). */
  titleCls: string;
  /** This seat's banked amount (the run_ended amount). */
  amount: number;
  /** Flavor line: walked seats locked winnings in; fallen seats lost out. */
  walked: boolean;
  /** The survivor's name (the rival). */
  rivalName: string;
  /** The survivor's persisted amount (opponent_progress / snapshot). */
  rivalAmount: number;
  /** The survivor's highest SECURED level (lights their earned rungs). */
  rivalLevelReached: number;
  /** The survivor's level IN PLAY (the shared question level). */
  rivalCurrentLevel: number;
  /** The complete journey of THIS (lapsed) run. */
  journey: JourneyStep[];
}

export const SpectateView: React.FC<SpectateViewProps> = ({
  title,
  titleCls,
  amount,
  walked,
  rivalName,
  rivalAmount,
  rivalLevelReached,
  rivalCurrentLevel,
  journey,
}) => {
  return (
    <div className="w-full anim-fade-in">
      {/* Compact fallen card (the run-end interim's facts, compacted — the
          results screen still owns the full ceremony after game_over). */}
      <div className="plate p-5 text-center">
        <p
          className={`font-display text-xl font-black tracking-wide ${titleCls}`}
        >
          {title}
        </p>
        <p className="mt-2 text-3xl font-black font-mono text-gold-300">
          {GBP(amount)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {walked
            ? "Winnings locked in — your rival is still climbing."
            : "The correct answer stays private to your rival's reveal — you watch the climb."}
        </p>
      </div>

      {/* Live rival panel — the spectate heart: "Alpha is climbing… Level N
          — playing for £X" + their mirrored strip. `reveal` is ALWAYS null
          (their answer_result/opponent_reveal are never sent to a lapsed
          seat — invariant 1). */}
      <div className="mt-4">
        <p
          className="mb-2 text-center text-xs font-black uppercase tracking-[0.3em] text-gold-400"
          role="status"
          aria-live="polite"
          data-testid="spectate-line"
        >
          {rivalName} is climbing… Level {rivalCurrentLevel} — playing for{" "}
          {GBP(amountAt(rivalCurrentLevel))}
        </p>
        <OpponentPanel
          name={rivalName}
          status="active"
          amount={rivalAmount}
          levelReached={rivalLevelReached}
          currentLevel={rivalCurrentLevel}
          reveal={null}
        />
      </div>

      {/* The journey so far — complete for a lapsed run (nothing more can
          arrive for this seat). */}
      <JourneyRecap steps={journey} final={null} className="mt-4" />
    </div>
  );
};
