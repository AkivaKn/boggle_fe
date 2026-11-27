import { navigate } from "../../router";
import { loadSession } from "./storage";

export default function HowToPlay() {
  const session = loadSession();
  return (
    <div className="ool-shell ool-rules">
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
          <button
            type="button"
            className="ool-text-link"
            onClick={() => navigate("/")}
          >
            All games
          </button>
        </nav>

        <header className="ool-rules-head">
          <p className="ool-kicker">The short version</p>
          <h1>How to play</h1>
          <p>
            Out of Line is a judge-and-submit party game for 3–12 people. Every
            round, one player judges a prompt while everyone else plays the
            answer card they think will win.
          </p>
        </header>

        <div className="ool-rules-grid">
          <section className="ool-panel">
            <h2>Set up</h2>
            <ol className="ool-numbered">
              <li>One person creates a room and shares the code.</li>
              <li>Everyone else joins on their own phone.</li>
              <li>
                The host picks the decks and the winning score: first to 3, 5,
                or 7.
              </li>
              <li>
                The host starts when there are at least 3 players. The host
                judges the first round.
              </li>
            </ol>
          </section>

          <section className="ool-panel">
            <h2>Each round</h2>
            <ol className="ool-numbered">
              <li>Everyone gets seven answer cards.</li>
              <li>The judge reads the prompt out loud.</li>
              <li>
                The other players choose one card, or two if the prompt says
                “Pick 2”.
              </li>
              <li>
                Submissions stay anonymous until the judge picks a favourite.
              </li>
              <li>The winner gets one point. The judge job moves to the next seat.</li>
            </ol>
          </section>

          <section className="ool-panel">
            <h2>Good to know</h2>
            <ul className="ool-bullets">
              <li>
                The judge never submits a card in the round they are judging.
              </li>
              <li>
                The judge rotates clockwise around the table every round, even
                if the host force-advances.
              </li>
              <li>
                There are no turn timers. If someone stalls, the host can force
                the round: missing cards are dealt at random, then a winner is
                picked at random.
              </li>
              <li>
                The game ends when someone reaches the target score. The host
                can reset the same room to the lobby for a rematch.
              </li>
            </ul>
          </section>

          <section className="ool-panel is-accent">
            <h2>Decks and ages</h2>
            <p>
              The House Deck is always on. You can mix in Group Chat, Work
              Mode, Bad Decisions, Deadpan Doom, and Family Gathering. After
              Hours is the optional 18+ deck: suggestive, not graphic.
            </p>
            <p>
              Decks are locked when the room is created. If After Hours is in
              play, everyone in the room should be 18 or older.
            </p>
            <p className="ool-small">
              No chat, no spectators, no accounts. The room code and your saved
              seat are all you need.
            </p>
          </section>
        </div>

        <div className="ool-rules-actions">
          <button
            type="button"
            className="ool-button is-primary"
            onClick={() =>
              session
                ? navigate(`/out-of-line/room/${session.code}`)
                : navigate("/out-of-line")
            }
          >
            {session ? "Back to my room" : "Find a room"}
          </button>
          <button
            type="button"
            className="ool-button is-ghost"
            onClick={() => navigate("/")}
          >
            All games
          </button>
        </div>
      </main>
    </div>
  );
}
