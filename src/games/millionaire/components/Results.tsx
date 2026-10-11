import type { Mode, PlayerStatus, RoomTotal, StandingsEntry } from "../api";
import { GBP, levelFromAmount } from "../api";
import { JourneyRecap, type JourneyFinal, type JourneyStep } from "./JourneyRecap";
import { SessionTotals } from "./SessionTotals";

export interface ResultsProps {
  /** SPEC §2 `game_over` standings (solo: exactly one entry) — the strict
   *  backend M4 shape `{seat, name, status, amount}` (StandingsEntry). */
  standings: StandingsEntry[];
  /** This client's seat — highlights the own row. */
  mySeat: number | null;
  /** UX v3: PLAY AGAIN restarts the SAME mode (App owns the create flow). */
  mode: Mode;
  /** Own-seat lifelines used (0–3) — stats chip. */
  lifelinesUsed: number;
  /** UX v3 wave 5a: the run's JOURNEY (per-level rung chips) — replaces the
   *  deleted "Show recap" log line on EVERY results variant (fall/walk/win/
   *  draw share it). */
  journey: JourneyStep[];
  /** UX v3 wave 5b: PLAY AGAIN is an in-room rematch POST (same room, same
   *  code) — while it is in flight the button disables to "Restarting…"
   *  until the room moves (rematch_ready → lobby / game_started → Q1). */
  playAgainPending?: boolean;
  /** WAVE 6 / wave-4B (SPEC §2 `room_state`): the room's per-seat SESSION
   *  census, as last sent on a `room_state` snapshot. `null` when the key was
   *  OMITTED (a room with no completed-run history) — nothing renders then.
   *  Deliberately NOT folded with the run that just finished: the block is
   *  the server's, verbatim. */
  sessionTotals?: RoomTotal[] | null;
  /** PLAY AGAIN (gold primary): the in-room rematch (same room + code). */
  onPlayAgain: () => void;
  /** HOME (ghost): back to the title screen. */
  onHome: () => void;
}

const OUTCOME: Record<PlayerStatus, { label: string; cls: string }> = {
  won: { label: "WON", cls: "text-gold-300" },
  walked: { label: "WALKED", cls: "text-sky-300" },
  fallen: { label: "FALLEN", cls: "text-rose-400" },
  active: { label: "ACTIVE", cls: "text-slate-400" },
};

/** Defensive default (M2 review finding 6): neutral styling + copy for any
 *  off-SPEC status string in the standings. */
const OUTCOME_FALLBACK = { label: "—", cls: "text-slate-400" } as const;

/**
 * UX v3 results screen: big headline + hero amount per outcome, the gold
 * PLAY AGAIN + ghost HOME pair, stats chips, and the wave-5a JOURNEY recap
 * (per-level rung chips — the "Show recap" log line is deleted; the journey
 * replaces it properly). Every amount renders through the shared `GBP`
 * formatter.
 */
export const Results: React.FC<ResultsProps> = ({
  standings,
  mySeat,
  mode,
  lifelinesUsed,
  journey,
  sessionTotals = null,
  playAgainPending = false,
  onPlayAgain,
  onHome,
}) => {
  const sorted = [...standings].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  // M4 (SPEC §1: "Tie = draw"): equal top amounts, checked client-side.
  const draw = sorted.length > 1 && (sorted[0].amount ?? 0) === (sorted[1].amount ?? 0);
  const mine =
    mySeat !== null ? standings.find((p) => p.seat === mySeat) : undefined;
  const myAmount = mine ? (Number.isFinite(mine.amount) ? mine.amount : 0) : 0;
  // Approved guard (M5 round-3 hardening, kept verbatim): the reached level
  // derives ONLY for walked|won — a FALLEN amount is a safe-haven value
  // shared by a span of levels, so it is ALWAYS ambiguous → no level chip,
  // never a wrong one. Callers render nothing (not "Reached level 0").
  const myLevel =
    mine && (mine.status === "walked" || mine.status === "won")
      ? levelFromAmount(myAmount)
      : null;
  const isSoloWin = standings.length === 1 && standings[0].status === "won";
  const isSoloFallen = mine?.status === "fallen";
  /** Wave 5a: the journey's FINAL line (walk/won only — a fallen run's last
   *  ✗ chip is its final line; JourneyRecap renders nothing for fallen). */
  const journeyFinal: JourneyFinal | null =
    mine && (mine.status === "walked" || mine.status === "won")
      ? { status: mine.status, amount: myAmount }
      : null;

  // Big headline per outcome (UX v3: FALL red "Fallen." / WALK "You walk
  // away with £X." / WIN trophy + hero / DRAW: tie block first below).
  let headline: { title: string; cls: string; sub?: string } = {
    title: mode === "duel" ? "Duel over." : "Run ended.",
    cls: "text-gold-200",
  };
  if (mine) {
    if (mine.status === "fallen")
      headline = { title: "Fallen.", cls: "text-rose-400" };
    else if (mine.status === "walked")
      headline = {
        title: "Walked away.",
        cls: "text-sky-300",
        sub: `You walk away with ${GBP(myAmount)}.`,
      };
    else if (mine.status === "won")
      headline = { title: "MILLIONAIRE!", cls: "text-gold-300" };
  }

  // Stats chips: reached level (only when unambiguous — the guard above)
  // + lifelines used. UX v3 wave 2: a WALK keeps the confirm → results flow
  // (no tree overlay) and gets the small cash-out hand-off chip.
  const chips = [
    ...(myLevel !== null ? [`Reached level ${myLevel}`] : []),
    ...(mine?.status === "walked" ? ["Cash-out hand-off"] : []),
    `Lifelines used ${lifelinesUsed}/3`,
  ];

  return (
    <div className="w-full anim-fade-in">
      {/* DRAW: the tie block comes first (UX v3). */}
      {draw && (
        <div
          className="mb-4 rounded-2xl border border-sky-700/60 bg-sky-950/50 px-4 py-3 text-center"
          role="status"
        >
          <p className="text-sm font-black uppercase tracking-widest text-sky-300">
            Draw
          </p>
          <p className="mt-1 text-xs text-sky-400/80">
            Equal amounts at the top — the duel ends tied.
          </p>
        </div>
      )}

      {/* Hero card: headline + amount (red vignette on a solo fall). */}
      <div
        className={`plate relative w-full overflow-hidden p-6 text-center ${
          isSoloFallen ? "border-rose-900/60" : ""
        }`}
      >
        {isSoloFallen && (
          <div
            className="fall-vignette pointer-events-none absolute inset-0"
            aria-hidden
          />
        )}
        <div className={`relative ${isSoloFallen ? "opacity-80" : ""}`}>
          {isSoloWin && (
            <div className="anim-trophy mb-2 text-4xl" aria-hidden>
              🏆
            </div>
          )}
          <p
            className={`font-display text-2xl font-black tracking-wide ${headline.cls}`}
          >
            {headline.title}
          </p>
          <p className="mt-3 text-4xl font-black font-mono text-gold-300">
            {GBP(myAmount)}
          </p>
          {headline.sub && (
            <p className="mt-2 text-sm text-slate-300">{headline.sub}</p>
          )}
          {isSoloWin && (
            <p className="mt-2 text-xs text-gold-500/80">
              All 15 questions conquered.
            </p>
          )}
        </div>
      </div>

      {/* Duel standings rows (solo renders none — the hero card is it). */}
      {sorted.length > 1 && (
        <div className="mt-4">
          <div className="flex flex-col gap-2">
            {sorted.map((p, i) => {
              const outcome = OUTCOME[p.status] ?? OUTCOME_FALLBACK;
              const amount = Number.isFinite(p.amount) ? p.amount : 0;
              return (
                <div
                  key={p.seat}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    p.seat === mySeat
                      ? "border-gold-500/60 bg-gold-500/10"
                      : "border-slate-800 bg-stage-void/60"
                  }`}
                >
                  <span className="font-mono text-base font-black text-slate-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate text-sm font-bold text-slate-100">
                    {p.name}
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-widest ${outcome.cls}`}
                  >
                    {outcome.label}
                  </span>
                  <span className="ml-auto font-mono text-sm font-bold text-gold-300">
                    {GBP(amount)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {draw ? "Tie — it's a draw." : "Compared by amount reached."}
          </p>
        </div>
      )}

      {/* Stats chips. */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <span key={chip} className="chip">
            {chip}
          </span>
        ))}
      </div>

      {/* Wave 5a: the journey recap (per-level rung chips + the walk/win
          final line) — shared by the fall/walk/win/draw variants. This is
          the proper replacement for the deleted "Show recap" log line. */}
      <JourneyRecap steps={journey} final={journeyFinal} className="mt-4" />

      {/* WAVE 6 / wave-4B — the room's SESSION totals above the rematch
          action, so a player can see what this room session has cost them
          (duel AND solo) BEFORE they press PLAY AGAIN. Renders nothing when
          the room has no history (the `totals` key is omitted) and renders
          only the seats that actually have a row. */}
      <SessionTotals
        totals={sessionTotals}
        names={Object.fromEntries(
          standings.map((p) => [p.seat, p.seat === mySeat ? "You" : p.name]),
        )}
        className="mt-5 rounded-xl border border-gold-500/20 bg-stage-void/40 px-4 py-3 text-center"
      />

      {/* PLAY AGAIN (gold primary) + HOME (ghost). Wave 5b: PLAY AGAIN is
          the in-room rematch POST — disabled + "Restarting…" while it is in
          flight (the guard clears when the room moves / on failure). */}
      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          disabled={playAgainPending}
          className="btn btn-primary text-xl"
        >
          {playAgainPending ? "Restarting…" : "Play again"}
        </button>
        <button type="button" onClick={onHome} className="btn btn-ghost text-sm">
          Home
        </button>
      </div>
    </div>
  );
};
