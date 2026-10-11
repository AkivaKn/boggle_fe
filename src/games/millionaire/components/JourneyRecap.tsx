import { useState } from "react";
import { GBP } from "../api";

/**
 * UX v3 wave 5a + 3b — the run's JOURNEY (docs/plan/v3-ux-plan.md): a
 * vertical list of the run's questions, replacing the deleted "Show recap"
 * log line on the results screen. One rung chip per level the seat
 * RESOLVED: rung number + amount, ✓, or ✗ with YOUR answer letter vs the
 * CORRECT answer letter — letters are allowed AFTER the fact only (the run
 * is over; SPEC invariant 1 still holds for live questions). A timeout
 * fall picked nothing (`pickedIndex` −1 → the ⏱ variant). The walk/win
 * FINAL line rides the run-end status; a FALLEN run's last chip IS its
 * final line.
 *
 * WAVE 3B — the rows are TAPPABLE ACCORDIONS (the user's ask: "the recap
 * shows levels, not the questions"). Collapsed: rung + amount + ✓/✗.
 * Expanded (tap): the QUESTION text + YOUR answer text + the CORRECT
 * answer text (the strings are captured at ANSWER time in App — post-own-
 * answer data, SPEC-legal — and ride the step as `question`/`pickedText`/
 * `correctText`). The FINAL fallen row (the last ✗ of a run with no final
 * line) is AUTO-expanded; walk 🚶 and win 🏆 lines stay static. Steps
 * without the captured facts (a lapsed seat's snapshot-era entries, etc.)
 * degrade to the letters-only chip with no detail panel.
 *
 * Pure presentation: App records the steps in the event machine
 * (`answer_result` / a timeout `run_ended`) and renders this on the
 * results screens (fall/walk/win/draw variants share it) and on the
 * spectate view.
 */
export interface JourneyStep {
  /** The level this entry resolves (1-based). */
  level: number;
  /** The option index this seat picked — −1 for a timeout (nothing picked). */
  pickedIndex: number;
  /** The correct option index for that level's question. */
  correctIndex: number;
  /** Whether the pick was correct (false = the ✗ letter pair renders). */
  correct: boolean;
  /** The amount this level yielded (secured on ✓; the leaving amount on ✗). */
  amount: number;
  /** Lifelines spent at this level (the wave-5a "lifelines used there" fact). */
  lifelines: number;
  /** Wave 3b: the question text, captured at ANSWER time. */
  question?: string;
  /** Wave 3b: the option string the seat locked, captured at answer time. */
  pickedText?: string;
  /** Wave 3b: the correct option string, captured at answer time. */
  correctText?: string;
}

/** The run's final line for walked/won runs (a fallen run needs none). */
export interface JourneyFinal {
  status: string;
  amount: number;
}

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
const letter = (index: number): string =>
  CHOICE_LABELS[index] ?? String(index);

export interface JourneyRecapProps {
  steps: JourneyStep[];
  final: JourneyFinal | null;
  className?: string;
}

export const JourneyRecap: React.FC<JourneyRecapProps> = ({
  steps,
  final,
  className,
}) => {
  const sorted = [...steps].sort((a, b) => a.level - b.level);
  // Wave 3b: a run with NO final line ends on a fall — that trailing ✗ row
  // IS the run's last line and auto-expands (walk 🚶 / win 🏆 runs never
  // do: their ends are the static final line).
  const last = sorted[sorted.length - 1];
  const autoExpandedLevel =
    final === null && last !== undefined && !last.correct ? last.level : null;
  // The user's taps override the auto state (XOR: tapping the auto-expanded
  // row collapses it, tapping a collapsed row expands it).
  const [toggled, setToggled] = useState<ReadonlySet<number>>(new Set());
  const isOpen = (level: number): boolean =>
    toggled.has(level) !== (level === autoExpandedLevel);
  const toggle = (level: number): void =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  if (sorted.length === 0 && !final) return null;

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-stage-void/60 p-4 ${
        className ?? ""
      }`}
      aria-label="Journey recap"
    >
      <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-500/80">
        Your journey
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((step) => {
          const open = isOpen(step.level);
          return (
            <li
              key={step.level}
              className={`rounded-xl border px-0 py-0 transition-colors duration-[250ms] ${
                open
                  ? "border-gold-500/40 bg-stage-950/80"
                  : "border-slate-800 bg-stage-950/60"
              }`}
            >
              {/* Collapsed row — TAPPABLE: rung + amount + ✓/✗ (+ chevron). */}
              <button
                type="button"
                onClick={() => toggle(step.level)}
                aria-expanded={open}
                aria-label={`Level ${
                  step.level
                }, ${GBP(step.amount)}, ${
                  step.correct ? "correct" : "wrong"
                } — ${open ? "collapse" : "expand"} details`}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                {/* Rung chip. */}
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-gold-500/40 bg-gold-500/10 font-mono text-xs font-black text-gold-300"
                  aria-hidden
                >
                  {step.level}
                </span>
                {/* The rung's amount (✓) / the leaving amount (✗). */}
                <span className="font-mono text-xs text-slate-300">
                  {GBP(step.amount)}
                </span>
                {step.correct ? (
                  <span
                    className="font-black text-emerald-400"
                    aria-label="Correct"
                  >
                    ✓
                  </span>
                ) : (
                  /* AFTER the fact: your letter vs the correct letter. A
                     timeout picked nothing ("—"); correctIndex −1 (backend
                     omitted `correct_index`) degrades to the bare ✗. */
                  <span className="text-xs font-black" aria-label="Wrong">
                    <span className="text-rose-400">
                      ✗ {step.pickedIndex >= 0 ? letter(step.pickedIndex) : "—"}
                    </span>
                    {step.correctIndex >= 0 && (
                      <>
                        <span className="text-slate-500"> → </span>
                        <span className="text-emerald-400">
                          {letter(step.correctIndex)}
                        </span>
                      </>
                    )}
                  </span>
                )}
                {/* Wave 3b: the timeout variant marks the row too. */}
                {step.pickedIndex < 0 && (
                  <span className="text-xs font-black text-slate-400" aria-hidden>
                    ⏱
                  </span>
                )}
                {/* Lifelines spent at this level (informational). */}
                {step.lifelines > 0 && (
                  <span className="rounded-full border border-slate-700/70 bg-stage-900/60 px-2 py-0.5 text-xs font-black text-slate-400">
                    🛟×{step.lifelines}
                  </span>
                )}
                <span
                  className="ml-auto text-xs text-slate-500"
                  aria-hidden
                >
                  {open ? "▾" : "▸"}
                </span>
              </button>
              {/* Expanded detail — question + your answer + the correct
                  answer (the wave-3b accordion body). Steps without the
                  captured facts degrade to the letters-only row above. */}
              {open && step.question && (
                <div className="anim-fade-in border-t border-slate-800 px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-100">
                    {step.question}
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    {step.pickedIndex < 0 ? (
                      <p className="text-slate-400">
                        <span aria-hidden>⏱</span> Timed out — no answer locked
                      </p>
                    ) : (
                      <p className="text-slate-300">
                        <span
                          className={`font-black ${
                            step.correct
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          Your answer — {letter(step.pickedIndex)}
                        </span>
                        {step.pickedText ? ` · ${step.pickedText}` : ""}
                      </p>
                    )}
                    {step.correctIndex >= 0 && (
                      <p className="text-slate-300">
                        <span className="font-black text-emerald-400">
                          Correct — {letter(step.correctIndex)}
                        </span>
                        {step.correctText ? ` · ${step.correctText}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {/* Final line (walk/won only — a fall's ✗ chip is its final line).
            Static, NOT tappable (the run has no question at its end). The
            rung amount for a walk is the banked winnings; for a win the
            full million. The JOURNEY amounts column is per-level, so the
            final line carries the run's TOTAL explicitly. */}
        {final?.status === "walked" && (
          <li className="flex items-center gap-3 rounded-xl border border-sky-800/60 bg-sky-950/40 px-3 py-2">
            <span aria-hidden>🚶</span>
            <span className="text-xs font-black uppercase tracking-widest text-sky-300">
              Walked away
            </span>
            <span className="ml-auto font-mono text-xs font-black text-gold-300">
              {GBP(final.amount)}
            </span>
          </li>
        )}
        {final?.status === "won" && (
          <li className="flex items-center gap-3 rounded-xl border border-gold-600/60 bg-gold-700/20 px-3 py-2">
            <span aria-hidden>🏆</span>
            <span className="text-xs font-black uppercase tracking-widest text-gold-300">
              Won
            </span>
            <span className="ml-auto font-mono text-xs font-black text-gold-300">
              {GBP(final.amount)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
};
