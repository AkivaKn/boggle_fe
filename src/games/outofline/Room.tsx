import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { navigate } from "../../router";
import {
  apiErrorMessage,
  previewRoom,
  type RoomPreview,
} from "./api";
import Final from "./Final";
import Game from "./Game";
import Lobby from "./Lobby";
import { loadName, saveName } from "./storage";
import type { RunCommand } from "./types";
import { useRoomSocket } from "./useRoomSocket";
import {
  ConnectionBanner,
  DeckChips,
  ErrorBanner,
  Spinner,
} from "./ui";

export default function Room({ code }: { code: string }) {
  const {
    state,
    session,
    status,
    error,
    join,
    retry,
    forget,
    clearError,
  } = useRoomSocket(code);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [name, setName] = useState(() => loadName());
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingPreview(true);
    setPreviewError(null);
    previewRoom(code)
      .then((next) => {
        if (active) setPreview(next);
      })
      .catch((requestError: unknown) => {
        if (active) setPreviewError(apiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    document.title = `Room ${code} · Out of Line`;
    return () => {
      document.title = "Games — Forehead Charades, Truth or Dare, Word Grid & The Money Ladder";
    };
  }, [code]);

  const run = useCallback<RunCommand>(async (label, action) => {
    setActionError(null);
    setPending(label);
    try {
      await action();
      return true;
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError));
      return false;
    } finally {
      setPending(null);
    }
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    saveName(trimmed);
    join(trimmed, adultConfirmed);
  };

  if (state) {
    return (
      <>
        {state.status === "lobby" ? (
          <Lobby
            code={code}
            state={state}
            run={run}
            pending={pending}
            actionError={actionError}
            clearActionError={clearActionError}
          />
        ) : state.status === "finished" ? (
          <Final
            code={code}
            state={state}
            run={run}
            pending={pending}
            actionError={actionError}
            clearActionError={clearActionError}
          />
        ) : (
          <Game
            code={code}
            state={state}
            run={run}
            pending={pending}
            actionError={actionError}
            clearActionError={clearActionError}
          />
        )}
        {status !== "open" || error ? (
          <div className="ool-conn-stack">
            <ConnectionBanner status={status} onRetry={retry} />
            <ErrorBanner message={error} onDismiss={clearError} />
          </div>
        ) : null}
      </>
    );
  }

  if (session && status === "closed") {
    return (
      <div className="ool-shell ool-join-shell">
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
            <span className="ool-room-code-small">{code.toUpperCase()}</span>
          </nav>
          <section className="ool-panel is-narrow ool-join-panel">
            <p className="ool-kicker">Saved seat</p>
            <h1>Can’t reach the room</h1>
            <p>
              You still have a saved seat as <strong>{session.name}</strong>. Try
              again, or forget the seat and join fresh.
            </p>
            <ErrorBanner message={error} onDismiss={clearError} />
            <div className="ool-button-row">
              <button
                type="button"
                className="ool-button is-primary"
                onClick={retry}
              >
                Reconnect
              </button>
              <button
                type="button"
                className="ool-button is-ghost"
                onClick={forget}
              >
                Forget seat
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (
    status === "connecting" ||
    status === "reconnecting" ||
    (status === "open" && !state)
  ) {
    return (
      <div className="ool-shell ool-join-shell">
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
            <span className="ool-room-code-small">{code.toUpperCase()}</span>
          </nav>
          <section className="ool-panel is-narrow ool-join-panel">
            <p className="ool-kicker">{status === "reconnecting" ? "Reconnecting" : "Joining"}</p>
            <Spinner
              label={
                status === "reconnecting"
                  ? "Finding your saved seat…"
                  : "Taking your seat…"
              }
            />
            <ErrorBanner message={error} onDismiss={clearError} />
          </section>
        </main>
      </div>
    );
  }

  return (
    <JoinScreen
      code={code}
      preview={preview}
      loading={loadingPreview}
      previewError={previewError}
      connectionError={error}
      name={name}
      adultConfirmed={adultConfirmed}
      onName={setName}
      onAdult={setAdultConfirmed}
      onJoin={handleJoin}
      onDismissError={clearError}
    />
  );
}

function JoinScreen({
  code,
  preview,
  loading,
  previewError,
  connectionError,
  name,
  adultConfirmed,
  onName,
  onAdult,
  onJoin,
  onDismissError,
}: {
  code: string;
  preview: RoomPreview | null;
  loading: boolean;
  previewError: string | null;
  connectionError: string | null;
  name: string;
  adultConfirmed: boolean;
  onName: (name: string) => void;
  onAdult: (confirmed: boolean) => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
  onDismissError: () => void;
}) {
  const full = !!preview && preview.player_count >= preview.max_players;
  const started = !!preview && preview.status !== "lobby";
  const needsAge = !!preview?.adult && !adultConfirmed;
  const canJoin =
    !!name.trim() && !!preview && !full && !started && !needsAge;

  return (
    <div className="ool-shell ool-join-shell">
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
            onClick={() => navigate("/out-of-line/how-to-play")}
          >
            How to play
          </button>
        </nav>

        <header className="ool-join-head">
          <p className="ool-kicker">Joining</p>
          <h1 className="ool-lobby-title">Room {code.toUpperCase()}</h1>
          <p className="ool-lobby-sub">One phone each. The host starts when ready.</p>
        </header>

        <ErrorBanner message={connectionError} onDismiss={onDismissError} />

        {loading ? (
          <section className="ool-panel is-narrow ool-join-panel">
            <Spinner label="Checking the room…" />
          </section>
        ) : previewError ? (
          <section className="ool-panel is-narrow ool-join-panel">
            <h2>Room not found</h2>
            <p>{previewError}</p>
            <button
              type="button"
              className="ool-button is-primary"
              onClick={() => navigate("/out-of-line")}
            >
              Back to Out of Line
            </button>
          </section>
        ) : preview ? (
          <div className="ool-join-grid">
            <section className="ool-panel">
              <div className="ool-panel-heading">
                <p className="ool-kicker">Take a seat</p>
                <h2>Your name</h2>
              </div>
              <form onSubmit={onJoin} className="ool-form">
                <label className="ool-field">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => onName(event.target.value)}
                    maxLength={24}
                    placeholder="How should the table know you?"
                    autoComplete="nickname"
                    autoFocus
                  />
                </label>
                {preview.adult ? (
                  <label className="ool-age-check">
                    <input
                      type="checkbox"
                      checked={adultConfirmed}
                      onChange={(event) => onAdult(event.target.checked)}
                    />
                    <span>
                      <strong>I’m 18 or older.</strong> This room includes After
                      Hours, the suggestive deck.
                    </span>
                  </label>
                ) : null}
                {started ? (
                  <p className="ool-hint is-warn">
                    This room is already in progress. New players can’t join
                    mid-game.
                  </p>
                ) : null}
                {full ? (
                  <p className="ool-hint is-warn">
                    This room is full at {preview.max_players} players.
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="ool-button is-primary is-wide"
                  disabled={!canJoin}
                >
                  Join room
                </button>
              </form>
            </section>

            <aside className="ool-panel is-side">
              <p className="ool-kicker">Room details</p>
              <h2>{preview.player_count} at the table</h2>
              <p>
                First to {preview.target_score}. {preview.min_players}–
                {preview.max_players} players.
              </p>
              <div className="ool-lobby-decks">
                <p className="ool-kicker">Decks</p>
                <DeckChips decks={preview.decks} />
              </div>
              <p className="ool-small">
                Your hand stays private. Submissions stay anonymous until the
                judge picks.
              </p>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
