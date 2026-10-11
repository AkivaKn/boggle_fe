import { GBP, type RoomTotal } from "../api";

export interface SessionTotalsProps {
  /**
   * Wave-4B `room_state.totals[]` — the room's per-seat SESSION census, kept
   * verbatim from the last snapshot. `null` when the room_state OMITTED the
   * key (a history-less room) — the component then renders NOTHING at all.
   */
  totals: RoomTotal[] | null;
  /**
   * Optional display names keyed by seat (the duel standings / the lobby's
   * known players). A seat with no name falls back to "Seat N" so a row is
   * never silently dropped.
   */
  names?: Record<number, string>;
  /** Tailwind class for the block (spacing on the host card). */
  className?: string;
}

/**
 * One compact "Session: N played · M won · £X · best rung K" line per seat
 * that HAS a `room_totals` row (SPEC §2 wave-4B).
 *
 * Three states the host cards must all handle, and which this component owns
 * so no screen re-implements them:
 *   - history-less room → `totals === null` → renders NOTHING (no "0 played"
 *     placeholder: the server simply had no row to send, and inventing a
 *     zero would be a fabricated fact);
 *   - solo → exactly one row (seat 1) → one line;
 *   - a duel where one seat has not finished a run yet → that seat has NO
 *     row, so only the other seat's line renders. Rows are iterated as sent;
 *     nothing is indexed by seat number.
 *
 * The numbers are the server's, rendered verbatim — nothing is derived from
 * the current run, and `best_level` is the server's own "highest level ever
 * reached" (0 = never left level 1), so it renders as-is rather than being
 * second-guessed.
 */
export const SessionTotals: React.FC<SessionTotalsProps> = ({
  totals,
  names,
  className = "",
}) => {
  if (!totals || totals.length === 0) return null;
  // Server order is seat-ascending (SPEC §2); sorting keeps the card stable
  // even if a future backend changes that, and never drops a row.
  const rows = [...totals]
    .filter((t) => t !== null && typeof t === "object")
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  if (rows.length === 0) return null;
  return (
    <div className={className} data-testid="session-totals">
      {rows.map((t) => {
        const played = Number.isFinite(t.games_played) ? t.games_played : 0;
        const won = Number.isFinite(t.games_won) ? t.games_won : 0;
        const money = Number.isFinite(t.total_money) ? t.total_money : 0;
        const best = Number.isFinite(t.best_level) ? t.best_level : 0;
        return (
          <p
            key={t.seat}
            className="mt-1 text-xs text-muted"
            data-testid="session-total-row"
            data-seat={t.seat}
          >
            <span className="font-bold text-slate-300">
              {names?.[t.seat] ?? `Seat ${t.seat}`}
            </span>
            {" · "}Session: {played} played · {won} won ·{" "}
            <span className="font-mono font-bold text-gold-300">
              {GBP(money)}
            </span>
            {" · best rung "}
            <span className="font-mono font-bold text-slate-300">{best}</span>
          </p>
        );
      })}
    </div>
  );
};