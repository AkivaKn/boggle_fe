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
// ── The beat sheet (M-B replan) ───────────────────────────────────────────
// Short, sharp, and front-loaded. The snap is the shortest leg on purpose:
// speed is what makes a modest distance read as a decisive move.
/** Dip (anticipation) starts — after the mount frame is committed. */
const DIP_AT_MS = 110;
/** The snap: the actual climb, on a fast ease-out. */
const SNAP_AT_MS = 280;
/** The settle: a 5px recoil that gives the move its weight. */
const SETTLE_AT_MS = 450;
/** The rung banks + the next one lights, at the top of the beat. */
const LAND_AT_MS = 620;
/** The fall's jolt, then its recoil, then home. */
const FALL_DROP_AT_MS = 130;
const FALL_RECOIL_AT_MS = 370;
const FALL_HOME_AT_MS = 620;
/** t=1s — the fall overlay's "see results" affordance fades in (solo hold). */
const FALL_RESULTS_AT_MS = 1000;

// ── The distances ─────────────────────────────────────────────────────────
/** The anticipation dip (px, downward). Small by design. */
const DIP_PX = 6;
/** The snap: how far the ladder shoots UP. Clamped to the free band above. */
const SLIDE_PX = 56;
/** The settle recoil (px, downward) — the overshoot that sells it. */
const SETTLE_PX = 5;
/** The fall's jolt and recoil (px). */
const FALL_JOLT_PX = 18;
const FALL_RECOIL_PX = 6;

// ── The easings ───────────────────────────────────────────────────────────
// The snap is a hard ease-out: it covers most of its distance in the first
// third, which is what the eye reads as "snap". A single gentle ease (what
// every previous version used) reads as drift at these distances.
const DIP_EASE = "transform 110ms cubic-bezier(0.4, 0, 0.6, 1)";
const SNAP_EASE = "transform 170ms cubic-bezier(0.16, 1, 0.3, 1)";
const SETTLE_EASE = "transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1)";
const FALL_EASE = "transform 240ms cubic-bezier(0.36, 0.9, 0.4, 1.2)";

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

  // ── THE MOTION MACHINE (M-B replan, built fresh) ─────────────────────────
  //
  // Four previous versions all used a MONOTONE motion — one continuous
  // translate (invisible at a rung of travel) or a scale pulse (not a slide).
  // The lesson is that distance is not what makes motion readable; TIMING is.
  // A card snapping shut travels ~40px and reads as decisive; this ladder
  // travelled 88px and read as dead. So the climb is built from anticipation
  // and snap, which the eye is far more sensitive to:
  //
  //   dip (110ms)  → the ladder drops 6px. Anticipation: the eye loads and
  //                   expects movement.
  //   snap (170ms) → it shoots UP SLIDE_PX on a fast ease-out. This is the
  //                   climb, and the speed is what makes it read.
  //   settle(180ms)→ it recoils 5px and holds. The overshoot is what makes it
  //                   feel physical rather than mechanical.
  //
  // All fifteen rungs stay visible throughout (the requirement, twice). The
  // travel budget is the empty band ABOVE the ladder: the stage is taller than
  // the ladder, and `slide` is clamped to that band so the ladder can never
  // leave the frame. Each answer gets the SAME decisive move and returns home
  // as the overlay closes, rather than ratcheting — ratcheting was tried and
  // it dilutes every move to a few pixels.
  const [y, setY] = useState(0);
  /** "dip" | "snap" | "settle" — which leg of the climb we are on. */
  const [leg, setLeg] = useState<"hold" | "dip" | "snap" | "settle">("hold");
  const [landed, setLanded] = useState(false);
  /** Fall: the jolt trigger, then the recoil (its own, uglier shape). */
  const [fallGo, setFallGo] = useState(false);
  const [, setFallRecoil] = useState(false);
  /** Fall (solo hold): the "see results" affordance fades in at ~1s. */
  const [fallResults, setFallResults] = useState(false);
  const winRef = useRef<HTMLDivElement | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);

  /** The travel budget: the empty band above the ladder. Measured, never
   *  guessed — a fixed SLIDE_PX would push the ladder out of frame on short
   *  viewports, which is exactly the class of bug the wave-3c audit found. */
  const [slide, setSlide] = useState(SLIDE_PX);

  useLayoutEffect(() => {
    const win = winRef.current;
    const track = treeRef.current;
    if (!win || !track) return;
    const band = Math.max(0, win.clientHeight - track.offsetHeight);
    setSlide(Math.min(SLIDE_PX, band));
  }, []);

  // RISE: the three-leg climb. Gated on a double rAF so the mount frame is
  // committed before anything moves — the animation must start from a pose the
  // player actually saw.
  useEffect(() => {
    if (!rise) return;
    let raf1 = 0;
    let raf2 = 0;
    const timers: number[] = [];
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        timers.push(window.setTimeout(() => { setLeg("dip"); setY(DIP_PX); }, DIP_AT_MS));
        timers.push(window.setTimeout(() => { setLeg("snap"); setY(-slide); }, SNAP_AT_MS));
        timers.push(window.setTimeout(() => { setLeg("settle"); setY(-slide + SETTLE_PX); }, SETTLE_AT_MS));
        timers.push(window.setTimeout(() => setLanded(true), LAND_AT_MS));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
    };
  }, [rise, slide]);

  // FALL: the ladder jolts down and recoils — a different shape from the
  // climb, because a fall should not feel like a climb.
  useEffect(() => {
    if (rise) return;
    let raf1 = 0;
    let raf2 = 0;
    const timers: number[] = [];
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        timers.push(window.setTimeout(() => { setFallGo(true); setY(FALL_JOLT_PX); }, FALL_DROP_AT_MS));
        timers.push(window.setTimeout(() => { setFallRecoil(true); setY(-FALL_RECOIL_PX); }, FALL_RECOIL_AT_MS));
        timers.push(window.setTimeout(() => setY(0), FALL_HOME_AT_MS));
      });
    });
    timers.push(window.setTimeout(() => setFallResults(true), FALL_RESULTS_AT_MS));
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
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
              rise && leg === "hold" && !landed ? "tree-climbing" : ""
            }`}
            style={{
              // The whole motion is ONE transform driven by the beat sheet —
              // a real translate, so it can be measured and felt. No keyframes,
              // no scale, no opacity trick standing in for a slide.
              transform: `translateY(${y}px)`,
              transition:
                rise
                  ? leg === "dip"
                    ? DIP_EASE
                    : leg === "snap"
                      ? SNAP_EASE
                      : leg === "settle"
                        ? SETTLE_EASE
                        : undefined
                  : fallGo
                    ? FALL_EASE
                    : undefined,
            }}
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
