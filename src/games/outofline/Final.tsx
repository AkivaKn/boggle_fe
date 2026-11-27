import { navigate } from "../../router";
import { rematch, type RoomState } from "./api";
import type { RunCommand } from "./types";
import { DeckChips, ErrorBanner } from "./ui";

export default function Final({
  code,
  state,
  run,
  pending,
  actionError,
  clearActionError,
}: {
  code: string;
  state: RoomState;
  run: RunCommand;
  pending: string | null;
  actionError: string | null;
  clearActionError: () => void;
}) {
  const standings =
    state.standings ||
    [...state.players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const winner = standings[0];
  const selfWon = winner?.seat === state.self.seat;

  const playAgain = async () => {
    await run("rematch", () => rematch(code, state.self.token));
  };

  return (
    <div className="ool-shell ool-final">
      <div className="ool-bg" aria-hidden />
      <main className="ool-main safe-area">
        <nav className="ool-topnav">
          <button
            type="button"
            className="ool-back-link"
            onClick={() => navigate("/out-of-line")}
          >
            ← Out of Line
          </button>
          <span className="ool-room-code-small">{state.code}</span>
        </nav>

        <header className="ool-final-head">
          <p className="ool-kicker">Game over · first to {state.target_score}</p>
          <h1 className="ool-title is-final">
            {selfWon ? "You win." : `${winner?.name || "Someone"} wins.`}
          </h1>
          <p className="ool-tagline">
            {selfWon
              ? "The table has spoken. Try to be gracious about it."
              : "One person’s questionable judgement is another person’s victory."}
          </p>
        </header>

        <ErrorBanner message={actionError} onDismiss={clearActionError} />

        <div className="ool-final-grid">
          <section className="ool-panel">
            <div className="ool-panel-heading is-row">
              <div>
                <p className="ool-kicker">Final table</p>
                <h2>Standings</h2>
              </div>
              <span className="ool-ready-tag">{state.round_no} rounds</span>
            </div>
            <ol className="ool-standings">
              {standings.map((player, index) => (
                <li
                  key={player.seat}
                  className={`ool-standing${index === 0 ? " is-first" : ""}${
                    player.seat === state.self.seat ? " is-self" : ""
                  }`}
                >
                  <span className="ool-rank">{index + 1}</span>
                  <span className="ool-standing-name">
                    {player.name}
                    {player.seat === state.self.seat ? (
                      <span className="ool-mini-tag is-you">You</span>
                    ) : null}
                  </span>
                  <span className="ool-standing-score">{player.score}</span>
                </li>
              ))}
            </ol>
            <div className="ool-final-decks">
              <p className="ool-kicker">Decks</p>
              <DeckChips decks={state.decks} />
            </div>
          </section>

          <aside className="ool-panel is-side ool-final-actions">
            <p className="ool-kicker">Same table?</p>
            <h2>Run it back</h2>
            <p>
              A rematch keeps everyone in their seats, clears the scores, and
              returns to the lobby. The host judges first again.
            </p>
            {state.self.is_host ? (
              <button
                type="button"
                className="ool-button is-primary is-wide"
                onClick={playAgain}
                disabled={pending !== null}
              >
                {pending === "rematch" ? "Resetting…" : "Play again"}
              </button>
            ) : (
              <div className="ool-waiting-box">
                <span className="ool-pulse-dot" aria-hidden />
                Waiting for the host to start a rematch.
              </div>
            )}
            <button
              type="button"
              className="ool-button is-ghost is-wide"
              onClick={() => navigate("/")}
            >
              Back to all games
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
