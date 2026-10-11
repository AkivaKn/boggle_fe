import type { PlayerStatus } from "../api";
import { GBP } from "../api";
import { MoneyLadder } from "./MoneyLadder";

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
const label = (index: number): string =>
  CHOICE_LABELS[index] ?? String(index);

/**
 * The `opponent_reveal` payload (SPEC §2), camelCased for component use.
 * `chosenIndex` is −1 when the rival ran out of time (timeout fall).
 *
 * LEAK GATE (M2 review note 1 — hard rule): App only hands this to the panel
 * once the LOCAL player has resolved the reveal's level (own `answer_result`
 * arrived, or the run has advanced past that level). While the local card is
 * still live on that level, the panel receives `null` and the correct answer
 * is never rendered anywhere.
 */
export interface RivalReveal {
  level: number;
  chosenIndex: number;
  correctIndex: number;
}

export interface OpponentPanelProps {
  /** Rival's name (room_state public view / player_joined). */
  name: string;
  /** Rival's run status — active until their `run_ended` (or reveal) lands. */
  status: PlayerStatus;
  /** Amount the rival secured (run_ended / room_state snapshot). */
  amount: number;
  /** Highest level the rival has answered/secured — lights their rungs. */
  levelReached: number;
  /** Level the rival is currently on (the shared question) — glows while active. */
  currentLevel: number;
  /** Gated reveal payload (see RivalReveal) — null while gated off. */
  reveal: RivalReveal | null;
}

/** Status chip: "in play" while active, "ended · <status>" afterwards
 *  (survivor-continues UX — the fallen rival's run is over, ours goes on). */
const CHIP: Record<PlayerStatus, { label: string; cls: string }> = {
  active: {
    label: "In play",
    cls: "border-emerald-700/60 bg-emerald-950/60 text-emerald-300",
  },
  fallen: {
    label: "Ended · fell",
    cls: "border-rose-900/60 bg-rose-950/50 text-rose-300",
  },
  walked: {
    label: "Ended · walked",
    cls: "border-sky-900/60 bg-sky-950/50 text-sky-300",
  },
  won: {
    label: "Ended · won",
    cls: "border-gold-600/60 bg-gold-700/30 text-gold-300",
  },
};

/** Defensive default: neutral chip for any off-SPEC status string. */
const CHIP_FALLBACK = {
  label: "—",
  cls: "border-slate-800 bg-stage-950 text-slate-400",
} as const;

/** Duel right column (M4): the rival's ladder position, amount and status —
 *  a compact mirrored MoneyLadder + text line + the gated reveal strip.
 *  M5 restage + round-3 advisory: a synthetic-rival fallback with
 *  levelReached 0 renders just the amount — never a "Level 0 reached"
 *  fragment. */
export const OpponentPanel: React.FC<OpponentPanelProps> = ({
  name,
  status,
  amount,
  levelReached,
  currentLevel,
  reveal,
}) => {
  const chip = CHIP[status] ?? CHIP_FALLBACK;
  const ended = status !== "active";

  return (
    <div
      className="rounded-2xl border border-gold-500/20 bg-stage-950/70 p-3 shadow-[0_0_20px_rgba(212,175,55,0.07)]"
      aria-label="Opponent panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-black uppercase tracking-widest text-gold-400/90">
          {name}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-black uppercase tracking-widest ${chip.cls}`}
        >
          {chip.label}
        </span>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-400">
        {ended
          ? levelReached > 0
            ? `Level ${levelReached} reached · ${GBP(amount)}`
            : GBP(amount) // no "Level 0 reached" fragment for synthetic rivals
          : `Playing level ${currentLevel}`}
      </p>

      <MoneyLadder
        currentLevel={currentLevel}
        levelReached={levelReached}
        status={status}
        compact
        mirror
      />

      {reveal && (
        <div
          className="mt-2 rounded-xl border border-slate-700/60 bg-stage-900/50 px-3 py-2 anim-fade-in"
          role="status"
          aria-label="Opponent reveal"
        >
          {reveal.chosenIndex >= 0 ? (
            <p className="text-xs leading-snug text-slate-300">
              Rival fell at level {reveal.level} — picked{" "}
              <span className="font-black text-rose-400">
                {label(reveal.chosenIndex)}
              </span>
              {" · correct was "}
              <span className="font-black text-emerald-400">
                {label(reveal.correctIndex)}
              </span>
            </p>
          ) : (
            <p className="text-xs leading-snug text-slate-300">
              Rival ran out of time at level {reveal.level} · correct was{" "}
              <span className="font-black text-emerald-400">
                {label(reveal.correctIndex)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
