import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { navigate } from "../../router";
import {
  removePlayer,
  startGame,
  type RoomState,
} from "./api";
import type { RunCommand } from "./types";
import { DeckChips, ErrorBanner } from "./ui";

export default function Lobby({
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
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link = `${window.location.origin}/out-of-line/room/${state.code}`;
  const moreNeeded = Math.max(0, state.min_players - state.players.length);
  const isHost = state.self.is_host;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyText = async (kind: "code" | "link", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  };

  const handleRemove = async (seat: number, name: string) => {
    if (!window.confirm(`Remove ${name} from the room?`)) return;
    await run(`remove-${seat}`, () =>
      removePlayer(code, state.self.token, seat),
    );
  };

  const handleStart = async () => {
    await run("start", () => startGame(code, state.self.token));
  };

  return (
    <div className="ool-shell ool-room-shell">
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

        <header className="ool-lobby-head">
          <div className="ool-lobby-code-block">
            <p className="ool-kicker">Room code</p>
            <h1 className="ool-lobby-code" aria-label={`Room code ${state.code}`}>
              {state.code}
            </h1>
            <p className="ool-lobby-sub">
              {state.players.length} of {state.max_players} players · first to{" "}
              {state.target_score}
            </p>
            <div className="ool-share-actions">
              <button
                type="button"
                className="ool-button is-secondary is-small"
                onClick={() => copyText("code", state.code)}
              >
                {copied === "code" ? "Code copied" : "Copy code"}
              </button>
              <button
                type="button"
                className="ool-button is-ghost is-small"
                onClick={() => copyText("link", link)}
              >
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
            </div>
          </div>
          <div className="ool-lobby-share-card">
            <div className="ool-qr-wrap">
              <QRCode
                value={link}
                size={132}
                bgColor="#F8F1DF"
                fgColor="#132925"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <p className="ool-share-hint">Scan to join on your phone</p>
            <p className="ool-share-url">{link.replace(/^https?:\/\//, "")}</p>
          </div>
        </header>

        <ErrorBanner message={actionError} onDismiss={clearActionError} />

        <div className="ool-lobby-grid">
          <section className="ool-panel">
            <div className="ool-panel-heading is-row">
              <div>
                <p className="ool-kicker">At the table</p>
                <h2>Players</h2>
              </div>
              {moreNeeded > 0 ? (
                <span className="ool-wait-tag">
                  {moreNeeded} more to start
                </span>
              ) : (
                <span className="ool-ready-tag">Ready</span>
              )}
            </div>

            <ul className="ool-player-list">
              {state.players.map((player) => (
                <li
                  key={player.seat}
                  className={`ool-player-row${
                    player.seat === state.self.seat ? " is-self" : ""
                  }`}
                >
                  <span className="ool-seat-number">{player.seat}</span>
                  <span className="ool-player-name">
                    {player.name}
                    {player.seat === state.host_seat ? (
                      <span className="ool-mini-tag">Host</span>
                    ) : null}
                    {player.seat === state.self.seat ? (
                      <span className="ool-mini-tag is-you">You</span>
                    ) : null}
                  </span>
                  {isHost &&
                  state.can_remove &&
                  player.seat !== state.host_seat ? (
                    <button
                      type="button"
                      className="ool-remove-button"
                      onClick={() => handleRemove(player.seat, player.name)}
                      disabled={pending !== null}
                      aria-label={`Remove ${player.name}`}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="ool-lobby-decks">
              <p className="ool-kicker">Decks in play</p>
              <DeckChips decks={state.decks} />
            </div>

            <div className="ool-lobby-actions">
              {isHost ? (
                <>
                  <button
                    type="button"
                    className="ool-button is-primary is-wide"
                    onClick={handleStart}
                    disabled={!state.can_start || pending !== null}
                  >
                    {pending === "start"
                      ? "Dealing…"
                      : state.can_start
                        ? "Start the game"
                        : `Need ${moreNeeded} more player${moreNeeded === 1 ? "" : "s"}`}
                  </button>
                  <p className="ool-hint">
                    You judge the first round. You’ll get seven cards, just not
                    this round.
                  </p>
                </>
              ) : (
                <div className="ool-waiting-box">
                  <span className="ool-pulse-dot" aria-hidden />
                  Waiting for the host to start.
                </div>
              )}
            </div>
          </section>

          <aside className="ool-panel is-side">
            <p className="ool-kicker">House rules</p>
            <h2>Keep it moving</h2>
            <ul className="ool-bullets">
              <li>Everyone plays on their own phone.</li>
              <li>The judge rotates one seat every round.</li>
              <li>Submissions stay anonymous until the reveal.</li>
              <li>
                No turn timers. If someone stalls, the host can force the round.
              </li>
              <li>The host can remove players only while in the lobby.</li>
            </ul>
            {state.adult ? (
              <p className="ool-age-note">
                <span className="ool-adult-tag">18+</span> After Hours is in this
                room. Keep it to players who are 18 or older.
              </p>
            ) : null}
            <button
              type="button"
              className="ool-text-link is-left"
              onClick={() => navigate("/out-of-line/how-to-play")}
            >
              Full rules
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
