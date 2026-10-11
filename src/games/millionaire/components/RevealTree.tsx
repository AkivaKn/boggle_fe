import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GBP } from "../api";
import { MoneyLadder } from "./MoneyLadder";

/**
 * UX v3 wave 3b — the money-tree reveal overlay (docs/plan/v3-ux-plan.md,
 * "Wave 3b": the climb must be VISIBLE). Wave-3's single setTimeout could
 * start the climb before the browser ever PAINTED the mount frame (the
 * paint race the user described: "it just appears on the screen"), so the
 * choreography is now strictly TWO-PHASE on BOTH kinds:
 *
 *   PHASE 1 — the mount render paints and holds the "before" state with
 *   NO transform at all: the overlay panel rises in from the bottom edge
 *   (400ms) while the tree sits at its natural offset with the OLD rung
 *   picture — the in-play rung N glowing amber-current, everything below
 *   earned — or, on a fall, the target rung painted static RED.
 *
 *   PHASE 2 — only after a DOUBLE requestAnimationFrame (the callback
 *   chain fires after the browser has committed the mount frame, so the
 *   "before" state is guaranteed on screen) does the trigger land:
 *   rise → the CAMERA slides UP one rung (a 400ms CSS transition between two
 *   genuinely painted framings — the ladder flows DOWN past you, the rung you
 *   were standing on slides out below the focal line and the rung above takes
 *   its place), the amber glow fades as it goes (.tree-climbing) and at the
 *   LANDING the rung you banked turns SECURED gold with a tick (it never just
 *   loses its highlight) while the NEXT rung lights as your new perch — the
 *   "+£X SECURED" chip lands with it;
 *   fall → the framing HOLDS on the rung you failed (it shatters where you
 *   stood) while the tree jolts down and settles back — a visible stumble.
 *
 *   WHY A CAMERA (wave 3c): waves 2/3/3b all translated the tree by exactly
 *   ONE RUNG PITCH. Measured on a 390×844 phone that pitch is ~44px inside a
 *   652px window that showed ALL FIFTEEN rungs at once — so the "climb" was a
 *   6%-of-the-tree nudge with nowhere to go, and the landing simply deleted
 *   the `glow-current` class. Live audit: transform 0 → −44px over 400ms,
 *   then the current-rung glow REMOVED at t≈1.07s — precisely the user's
 *   report, "it just removes the line highlight after a second". The fix is
 *   structural, not another timing tweak: the overlay now frames ~6 BIG rungs
 *   in a fixed-height camera window and the ladder is a long track running
 *   through it, so the camera genuinely travels up the ladder (clamped at its
 *   two ends) and the climb accumulates over a run instead of nudging.
 *
 *   CONTINUE (solo, rise): wave-3 semantics kept — no ring, no skip; the
 *   affordance fades in at ~1s (App arms the hold-until-continue beat at
 *   1000ms) and the click still POSTs the M7 continue endpoint in App
 *   (handleContinue unchanged, incl. failed-POST re-arm). Duels NEVER
 *   show it (solo=false → the overlay auto-closes on `question_next`).
 *
 * PURE PRESENTATION: everything is derived in App from the existing event
 * machine (reveal/ladder/runEnd facts) — no new event handling, so the
 * approved guards stay verbatim. The timers below are this overlay's own
 * animation state machine only.
 */
/** t≈420ms — the climb starts (entrance 400ms + a painted hold before it). */
const CLIMB_AT_MS = 420;
/** t≈980ms — the camera lands; the secured rung banks + the next one lights. */
const LAND_AT_MS = 980;
/** t≈200ms — the fall's painted red-rung hold ends → the stumble fires. */
const FALL_DROP_AT_MS = 200;
/** t≈620ms — the stumble settles back to the framing (the failed rung holds). */
const FALL_SETTLE_AT_MS = 620;
/** t=1s — the fall overlay's "see results" affordance fades in (solo hold). */
const FALL_RESULTS_AT_MS = 1000;
/** Where the rung you are on sits in the window (fraction of window height).
 *  0.62 keeps THREE things readable at once: the ladder still to win above
 *  you, your rung lit at the focal line, and the rung you just banked fully in
 *  frame BELOW it (the frame shows ~5.5 big rungs, so a lower focal line would
 *  let the mask fade eat the banked rung — the wave-3c audit caught exactly
 *  that milky half-rung). */
const FOCAL = 0.62;
/** The fall's stumble depth (px) — a visible jolt, settled back at FALL_SETTLE. */
const FALL_JOLT_PX = 20;
/** The camera slides are the 400ms rise-family easing (a hair of overshoot on
 *  the climb so the landing has weight). */
const SLIDE_TRANSITION =
  "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)";
const FALL_TRANSITION = "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)";

export interface RevealTreeProps {
  /** "rise" = correct reveal; "fall" = wrong answer / timeout. */
  kind: "rise" | "fall";
  /** Rung the answer was AT (secured on a rise, shattered on a fall). */
  level: number;
  /** Highest level secured so far — lights the earned rungs (App ladder). */
  levelReached: number;
  /** rise: the just-secured rung amount; fall: the leaving amount. */
  amount: number;
  /** fall caption fact: the highest SAFE rung banked (0 = none). */
  safeLevel: number;
  /** rise only: the secured rung IS a safe haven (5/10) → gold flare. */
  isSafeRung: boolean;
  /** SOLO only — this run's CONTINUE affordance rides the overlay. Duels
   *  pass false: the run advances server-side (no button, no slot). */
  solo: boolean;
  /** Solo rise: true once the ~1s hold-until-continue beat passed — the
   *  CONTINUE fade-in (the click POSTs the M7 continue endpoint in App). */
  showContinue: boolean;
  /** Solo fall: true while the results transition is held behind this
   *  overlay — "Continue · see results" fades in at ~1s. */
  showFallContinue: boolean;
  /** CONTINUE click (solo rise) — POSTs the M7 continue endpoint in App. */
  onContinue: () => void;
  /** Solo fall: close the overlay — the run-end interim transitions in. */
  onFallContinue: () => void;
}

export const RevealTree: React.FC<RevealTreeProps> = ({
  kind,
  level,
  levelReached,
  amount,
  safeLevel,
  isSafeRung,
  solo,
  showContinue,
  showFallContinue,
  onContinue,
  onFallContinue,
}) => {
  const rise = kind === "rise";

  // --- The wave-3b two-phase animation state machine (this overlay's own) --
  // PHASE 1 is the mount render: `go`/`landed` are false, so no transition is
  // ever running. The layout effect below measures the ladder's real geometry
  // and lays the CAMERA at `from` BEFORE the first paint, so the painted frame
  // is "where you were": your rung N sitting at the focal line. PHASE 2 (the
  // double rAF — after the mount frame is committed) slides the camera to
  // `to`: up one rung on a correct answer (the ladder flows DOWN past you and
  // the rung you banked lights gold while the NEXT rung lights as your new
  // perch), or a stumble on a fall (the failed rung shatters in place).
  const [cam, setCam] = useState<{ from: number; to: number } | null>(null);
  const [go, setGo] = useState(false);
  const [landed, setLanded] = useState(false);
  /** Fall: the stumble trigger (false = the painted static-red hold). */
  const [fallGo, setFallGo] = useState(false);
  /** Fall: the settle-back (the stumble is one jolt, then home). */
  const [fallSettled, setFallSettled] = useState(false);
  /** Fall (solo hold): the "see results" affordance fades in at ~1s. */
  const [fallResults, setFallResults] = useState(false);
  const winRef = useRef<HTMLDivElement | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);

  // Measure the ladder's real geometry, then solve the camera. Runs in a LAYOUT
  // effect → it flushes before the browser's first paint (a measurement, not a
  // transition), so phase 1 already paints the "where you were" framing and the
  // slide always starts from a real painted state. The camera is clamped to the
  // track's ends, so level 1 (the ladder's floor) and level 15 (its top) frame
  // honestly instead of sliding into empty space.
  useLayoutEffect(() => {
    const win = winRef.current;
    const track = treeRef.current;
    if (!win || !track) return;
    const tops = new Map<number, number>();
    track.querySelectorAll<HTMLElement>("[data-rung]").forEach((el) => {
      tops.set(Number(el.dataset.rung), el.offsetTop);
    });
    const H = win.clientHeight;
    const trackH = track.offsetHeight;
    if (H < 40 || trackH <= H) return; // nothing to travel — leave unframed
    const focal = H * FOCAL;
    const rungH =
      track.querySelector<HTMLElement>("[data-rung]")?.offsetHeight ?? 0;
    const lastLevel = tops.size ? Math.max(...tops.keys()) : 0;
    const camFor = (lvl: number): number | null => {
      const top = tops.get(lvl);
      if (top === undefined) return null;
      // The BOTTOM rung sits lower in the frame than the standard focal line
      // (it IS the ladder's floor — holding it at 0.62 left ~230px of dead
      // space beneath it, which read as broken layout). It still keeps a
      // floor's worth of travel into level 2.
      const line =
        lvl === lastLevel
          ? Math.min(focal, H - rungH - 10)
          : focal;
      // Only the TOP of the ladder clamps (never show sky above rung 15 — as
      // you near the top the framing settles and the rung rises within the
      // frame instead). The BOTTOM deliberately does NOT clamp: clamping to
      // the track's end squashed levels 1→2 into 15px of travel (the audit
      // that caught it).
      return Math.min(0, line - top);
    };
    const here = camFor(level);
    if (here === null) return;
    // Rise: camera up one rung (the tree flows down past you). Level 15 is the
    // top of the ladder — there is nowhere higher, so it lands in place.
    // Fall: the framing HOLDS on the failed rung (it shatters where you stood)
    // and the stumble jolt is added as a transient offset.
    const nextUp = rise && level < 15 ? camFor(level + 1) : null;
    setCam({ from: here, to: nextUp ?? here });
  }, [rise, level]);

  // RISE phase 2: after the double rAF proves the phase-1 frame painted, slide
  // the camera up one rung; the landing beat banks the rung + lights the next.
  useEffect(() => {
    if (!rise) return;
    let raf1 = 0;
    let raf2 = 0;
    let climbTimer = 0;
    let landTimer = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        climbTimer = window.setTimeout(() => setGo(true), CLIMB_AT_MS);
        landTimer = window.setTimeout(() => setLanded(true), LAND_AT_MS);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(climbTimer);
      clearTimeout(landTimer);
    };
  }, [rise]);

  // FALL phase 2: the same double rAF — the static red rung must be on screen
  // first — then the stumble jolts the camera down and settles it back, with
  // the shatter mid-jolt; the solo hold's "see results" fades at 1s.
  useEffect(() => {
    if (rise) return;
    let raf1 = 0;
    let raf2 = 0;
    let dropTimer = 0;
    let settleTimer = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        dropTimer = window.setTimeout(() => setFallGo(true), FALL_DROP_AT_MS);
        settleTimer = window.setTimeout(
          () => setFallSettled(true),
          FALL_SETTLE_AT_MS,
        );
      });
    });
    const resultsTimer = window.setTimeout(
      () => setFallResults(true),
      FALL_RESULTS_AT_MS,
    );
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(dropTimer);
      clearTimeout(settleTimer);
      clearTimeout(resultsTimer);
    };
  }, [rise]);

  

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-stage-void/80 p-4 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
      aria-label={
        rise
          ? `Correct — ${GBP(amount)} secured at level ${level}`
          : `Fallen — you leave with ${GBP(amount)}`
      }
    >
      <div
        className={`flex w-[clamp(230px,82vw,320px)] flex-col items-center ${
          rise ? "anim-overlay-rise" : "anim-overlay-fall"
        }`}
      >
        {/* Counter — updates to the level just played (the money context the
            stake line carried during the question). */}
        <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-400">
          Level {level} of 15
        </p>
        {!rise && (
          <p
            className="anim-fade-in mt-2 font-display text-xl font-black text-rose-400"
            style={{ animationDelay: "700ms" }}
          >
            Fallen.
          </p>
        )}

        {/* The tree — DECOR: pointer-events-none so the dimmed plate stays
            readable beneath. `.tree-window` is the CAMERA FRAME: a fixed-height
            window onto the ladder (not the whole ladder crammed in — the frame
            crops ~6 big rungs and the ladder is a long track running through
            it), with the rungs softly masked at the edges. The track inside is
            positioned by the camera solve above:
              PHASE 1 (mount/layout)  — transform laid at `from`, no transition:
                                       the painted frame is WHERE YOU WERE.
              PHASE 2 (double rAF)    — the camera slides to `to` (up one rung
                                       on a rise: the ladder flows down past
                                       you; the fall instead jolts down and
                                       settles, holding the failed rung). */}
        <div ref={winRef} className="tree-window pointer-events-none mt-2">
          <div
            ref={treeRef}
            className={`tree-track w-full ${
              rise && go && !landed ? "tree-climbing" : ""
            }`}
            style={
              !cam
                ? undefined
                : rise
                  ? {
                      transform: `translateY(${go ? cam.to : cam.from}px)`,
                      transition: go ? SLIDE_TRANSITION : undefined,
                    }
                  : {
                      // Fall: jolt down at the trigger, settle home after.
                      transform: `translateY(${
                        cam.from + (fallGo && !fallSettled ? FALL_JOLT_PX : 0)
                      }px)`,
                      transition: fallGo ? FALL_TRANSITION : undefined,
                    }
            }
          >
          <div className="tree-ladder">
            <MoneyLadder
              // PHASE 1 (pre-landing): you are ON rung N — lit, everything below
              // earned. PHASE 2 (landing): rung N BANKS (gold, ✓ — the rung
              // never just loses its highlight) and rung N+1 lights as your new
              // perch, so the eye follows the ladder upward.
              currentLevel={
                rise
                  ? landed
                    ? Math.min(level + 1, 15)
                    : level
                  : 0
              }
              levelReached={
                rise ? (landed ? level : Math.max(0, level - 1)) : levelReached
              }
              // The rung you just banked — persistent gold + a tick (the fix
              // for "the highlight just disappears": it becomes SECURED).
              securedLevel={rise && landed ? level : null}
              // "active" keeps the approved rung-color math (earned lit,
              // current glowing); the fall rung is painted by wrongLevel.
              status="active"
              // The SAFE-HAVEN flare rides the landing (t≈980ms) — and ONLY on
              // a safe haven: wave 2/3 fired this pulse on EVERY secured rung,
              // which washed the banked rung white for 2.4s. Ordinary rungs
              // bank quietly (securedLevel's gold + tick).
              flareLevel={rise && landed && isSafeRung ? level : null}
              wrongLevel={rise ? null : level}
              // The shatter fires on the stumble trigger only — the mount
              // phase paints the target rung static RED first.
              shatterLevel={rise || !fallGo ? null : level}
            />
          </div>
          </div>
        </div>

        {rise ? (
          <>
            {/* "+£X SECURED" chip — lands as the tree does (600ms float
                from the 960ms landing beat; hidden by its BOTH fill until
                then). */}
            <div className="anim-chip-float pointer-events-none mt-3">
              <span className="inline-flex items-center rounded-full border border-gold-500/70 bg-gold-500/15 px-4 py-1.5 text-sm font-black uppercase tracking-widest text-gold-300 shadow-[0_0_18px_rgba(212,175,55,0.35)]">
                +{GBP(amount)} secured
              </span>
            </div>
            {isSafeRung && (
              <p
                className="anim-fade-in mt-2 text-xs font-black uppercase tracking-[0.3em] text-safe"
                style={{ animationDelay: "960ms" }}
              >
                Safe haven reached
              </p>
            )}
          </>
        ) : (
          /* Fall caption (the run_ended amounts, surfaced by App). */
          <p
            className="anim-fade-in mt-3 text-center text-sm text-slate-300"
            style={{ animationDelay: "900ms" }}
          >
            Fallen — you leave with{" "}
            <span className="font-black text-gold-300">{GBP(amount)}</span>{" "}
            {safeLevel > 0 ? (
              <span className="font-black text-safe">(SAFE {safeLevel})</span>
            ) : (
              <span className="text-muted">(no SAFE banked)</span>
            )}
          </p>
        )}

        {/* Wave-3 CONTINUE — a plain affordance fading in at ~1s (300ms
            opacity-only; NO ring, NO skip button, no translate). The slot
            reserve keeps the landed stack from reflowing when it appears.
            RISE (solo): the click POSTs the M7 continue endpoint (App's
            handleContinue). FALL (solo hold): hands off to the run-end
            interim ("see results"). Duels render neither. */}
        {(rise ? solo : showFallContinue) && (
          <div className="mt-4 flex h-[62px] w-full items-start justify-center">
            {rise
              ? showContinue && (
                  <button
                    type="button"
                    onClick={onContinue}
                    aria-label="Continue"
                    className="anim-continue-fade w-full rounded-xl border border-gold-500/60 bg-gradient-to-b from-gold-400/15 to-stage-950 py-3 text-xs font-black uppercase tracking-[0.35em] text-gold-300 shadow-[0_0_18px_rgba(212,175,55,0.25)] transition-colors hover:from-gold-400/30 hover:text-gold-200 active:scale-[0.98]"
                  >
                    Continue ▸
                  </button>
                )
              : fallResults && (
                  <button
                    type="button"
                    onClick={onFallContinue}
                    aria-label="See results"
                    className="anim-continue-fade w-full rounded-xl border border-slate-500/50 bg-gradient-to-b from-slate-400/10 to-stage-950 py-3 text-xs font-black uppercase tracking-[0.35em] text-slate-200 transition-colors hover:border-gold-500/60 hover:text-gold-200 active:scale-[0.98]"
                  >
                    Continue · see results
                  </button>
                )}
          </div>
        )}
      </div>
    </div>
  );
};
