import { GBP, LADDER_AMOUNTS, type PlayerStatus } from "../api";

/** SPEC §1 — safe havens bank the last safe-haven amount on a fall. */
const SAFE_HAVENS = new Set([5, 10]);

export interface MoneyLadderProps {
  /** Level of the question currently in play (0 = none in play). */
  currentLevel: number;
  /** Highest level answered/secured so far (0 = nothing answered yet). */
  levelReached: number;
  /** Player run status — colors the ladder once the run has ended. */
  status: PlayerStatus;
  /** Compact variant (M4 opponent panel plumbing — just tighter styling). */
  compact?: boolean;
  /** Mirror variant (M4): render ascending so the opponent's ladder reads
   *  bottom-up next to the player's top-down one. */
  mirror?: boolean;
  /** UX v3 wave 2 (reveal overlay): the rung whose SAFE chip flares gold
   *  (the just-secured safe haven, 5/10). Null/undefined → no flare. */
  flareLevel?: number | null;
  /** UX v3 wave 2 (reveal overlay): the rung a fall happened AT — painted
   *  red with the shatter shake. Null/undefined → nothing painted. */
  wrongLevel?: number | null;
  /** UX v3 wave 3b (reveal overlay): the rung the SHATTER animation runs
   *  on. Wave-3b's two-phase fall paints the target rung static RED at
   *  mount (wrongLevel alone — no motion) and fires the shatter only on
   *  the slide-down trigger; null (every other consumer) → no shatter. */
  shatterLevel?: number | null;
  /** UX v3 wave 3c (reveal overlay): the rung just BANKED — the persistent
   *  "SECURED" gold + tick that replaces the old behaviour where the current
   *  rung's glow was simply deleted on landing (which read as "the highlight
   *  just disappeared"). null (every other consumer) → nothing painted. */
  securedLevel?: number | null;
}

/**
 * UX v3: the vertical hexagon-rung ladder (`.hex-shape` clip) — dark-blue
 * rungs with white italic amounts, GOLD safe havens (5/10), the current rung
 * pulsing an amber glow, and earned rungs lit. The mobile question screen no
 * longer renders any ladder (the stake line carries the money context; the
 * full ladder returns in the WAVE-2 reveal overlay) — this component is kept
 * for the desktop `md:` rail and the wave-2 overlay. The styling is a pure
 * restyle: the earned/current/safe/state math (and the compact/mirror API)
 * is the M2/M4-approved logic, untouched.
 */
export const MoneyLadder: React.FC<MoneyLadderProps> = ({
  currentLevel,
  levelReached,
  status,
  compact = false,
  mirror = false,
  flareLevel = null,
  wrongLevel = null,
  shatterLevel = null,
  securedLevel = null,
}) => {
  const rows = LADDER_AMOUNTS.map((amount, i) => ({
    level: i + 1,
    amount,
  }));
  // Top-down (highest first) by default; mirrored variant flips to ascending.
  if (!mirror) rows.reverse();

  return (
    <div className="flex w-full flex-col gap-[3px]" aria-label="Money ladder">
      {rows.map(({ level, amount }, rowIdx) => {
        const isSafe = SAFE_HAVENS.has(level);
        const isEarned = level <= levelReached;
        // Current rung only glows while the run is live (M4's ended opponent
        // ladder must not keep pulsing at their last position).
        const isCurrent = level === currentLevel && status === "active";
        // UX v3 wave 2 (reveal overlay): the fall's target rung and the
        // secured safe haven's flare.
        const isWrong = wrongLevel !== null && level === wrongLevel;
        const isFlare = flareLevel !== null && level === flareLevel;
        // Wave 3b: the shatter is a SEPARATE trigger from the red paint —
        // the painted first frame shows the rung static red.
        const isShatter = shatterLevel !== null && level === shatterLevel;
        // Wave 3c: the banked rung — it must read as SECURED, never as
        // "the glow was deleted".
        const isSecured = securedLevel !== null && level === securedLevel;

        // Stage palette: dark-blue hexagon, white italic amounts; gold fill
        // for safe havens; earned rungs lit brighter; the current rung wears
        // the amber pulse (glow on the wrapper — clip-path clips shadows).
        let inner = "bg-gradient-to-b from-stage-900 to-stage-950 text-slate-100/85";
        let wrapper = "";
        // M-B (final rung hierarchy) — the whole ladder is DARK except the one rung
        // you are standing on. This is the second attempt at "which rung am I
        // on?" (the first still failed: the banked rung sat in the same gold
        // family as the current rung and as the safe havens). The rule now:
        //
        //   unreached        dark blue   — base, nothing to see
        //   earned / done    dark blue   — base again, with a ✓ for "you took
        //                                  this"; it does NOT keep a fill
        //   safe haven       MUTED gold  — important, but never bright; it must
        //                                  not compete with the current rung
        //   YOU ARE HERE     white-hot   — the only bright rung on the ladder,
        //                                  plus a ring, a white pulse and ▶
        if (isSafe)
          inner =
            "bg-gradient-to-b from-gold-700 to-gold-900 text-gold-200";
        if (isEarned && !isCurrent)
          // The DONE rung reverts to the base colour (user decision) — the
          // ✓ is what says "banked", not a second gold fill competing with the
          // rung you are on.
          inner =
            "bg-gradient-to-b from-stage-800 to-stage-900 text-gold-300 border-y border-gold-500/25";
        if (isSafe && isEarned)
          inner = "bg-gradient-to-b from-gold-800 to-gold-900 text-gold-300";
        if (isCurrent) {
          // The ORIGINAL amber→gold rung, unchanged (user: "the old colour was
          // fine"). What changed is everything AROUND it: the safe havens are
          // now muted dark gold, so this is unmistakably brighter than them,
          // and the ▶ marker names it outright. Earlier passes tried white-hot
          // and bright-gold fills to solve the same problem and both read as
          // glaring — the fix was never to make this rung brighter.
          inner =
            "bg-gradient-to-b from-amber-400 to-gold-600 text-stage-950 font-black";
          wrapper = "glow-current";
        }
        // The rung you just banked: base colour like any other done rung. The
        // landing is already celebrated by the "+£X SECURED" chip and the
        // climb itself — the rung does not need to hold a colour for it.
        if (isSecured) {
          inner =
            "bg-gradient-to-b from-stage-800 to-stage-900 text-gold-300 border-y border-gold-500/25 font-black";
        }

        // UX v3 wave 2: the fall's target rung paints RED; the wave-3b
        // shatter (flash + fall shake) only fires on the slide-down
        // trigger (its animationDelay is the shatter choreography's —
        // see shatterLevel / the wave-3b two-phase notes).
        if (isWrong) {
          inner =
            "bg-gradient-to-b from-rose-500 to-rose-700 text-rose-50 font-black";
          if (isShatter) wrapper = "anim-shatter";
        } else if (isFlare) {
          // Gold flare on the SAFE rung (replaces the current-run pulse —
          // the flare IS the celebration; both animate the same filter).
          wrapper = "flare-safe";
        }

        return (
          <div
            key={level}
            // Wave 3 (reveal overlay climb): lets RevealTree measure the
            // REAL rung pitch for its old→new translate. Pure attribute —
            // no styling/logic change.
            data-rung={level}
            className={`${wrapper} ${compact ? "" : "anim-ladder-in"}`}
            style={
              compact || isWrong
                ? undefined
                : { animationDelay: `${rowIdx * 35}ms` }
            }
          >
            <div
              className={`hex-shape flex items-center gap-2 font-mono ${
                compact ? "px-3 py-[3px] text-xs" : "px-4 py-1 text-sm"
              } ${inner}`}
            >
              <span
                className={`${compact ? "w-4" : "w-5"} shrink-0 text-left font-black not-italic ${
                  isCurrent ? "text-stage-950" : isSafe || isSecured ? "text-stage-950/80" : "text-gold-400/80"
                }`}
              >
                {level}
              </span>
              {isSafe && (
                <span
                  className={`rounded-full border border-gold-300/30 bg-stage-950/30 font-sans font-black uppercase tracking-widest text-gold-200 ${
                    compact ? "px-1 text-xs" : "px-1.5 text-xs"
                  }`}
                >
                  Safe
                </span>
              )}
              <span className="ml-auto font-bold italic">{GBP(amount)}</span>
              {isSecured && (
                <span
                  aria-label="secured"
                  className="shrink-0 font-black text-stage-950/80"
                >
                  ✓
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
