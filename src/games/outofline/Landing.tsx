import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  apiErrorMessage,
  createRoom,
  getDecks,
  type DeckInfo,
} from "./api";
import { navigate } from "../../router";
import {
  clearSession,
  loadName,
  loadSession,
  saveName,
  saveSession,
  type Session,
} from "./storage";
import { ErrorBanner, Spinner } from "./ui";

const TARGETS = [3, 5, 7];

export default function Landing() {
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [name, setName] = useState(() => loadName());
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(5);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const loadDecks = () => {
    let active = true;
    setLoadingDecks(true);
    setDecksError(null);
    getDecks()
      .then((next) => {
        if (active) setDecks(next);
      })
      .catch((error: unknown) => {
        if (active) setDecksError(apiErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingDecks(false);
      });
    return () => {
      active = false;
    };
  };

  useEffect(loadDecks, []);

  const selectedIDs = ["base", ...Array.from(extras)];
  const selectedDecks = decks.filter((deck) => selectedIDs.includes(deck.id));
  const anyAdult = selectedDecks.some((deck) => deck.adult);
  const canCreate =
    !creating &&
    !!name.trim() &&
    decks.length > 0 &&
    (!anyAdult || adultConfirmed);

  const toggleExtra = (id: string) => {
    setExtras((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createRoom({
        name: name.trim(),
        decks: selectedIDs,
        target_score: target,
        adult_confirmed: adultConfirmed,
      });
      saveName(name);
      saveSession({
        code: result.code,
        token: result.token,
        name: result.name,
      });
      navigate(`/out-of-line/room/${result.code}`);
    } catch (error) {
      setCreateError(apiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z]+-[A-Z]+-\d{2}$/.test(code)) {
      setJoinError("Enter the room code, like BLUE-TIGER-73.");
      return;
    }
    setJoinError(null);
    navigate(`/out-of-line/room/${code}`);
  };

  const forgetSession = () => {
    clearSession();
    setSession(null);
  };

  return (
    <div className="ool-shell ool-landing">
      <div className="ool-bg" aria-hidden />
      <main className="ool-main safe-area">
        <nav className="ool-topnav">
          <button
            type="button"
            className="ool-back-link"
            onClick={() => navigate("/")}
          >
            ← All games
          </button>
          <button
            type="button"
            className="ool-text-link"
            onClick={() => navigate("/out-of-line/how-to-play")}
          >
            How to play
          </button>
        </nav>

        <header className="ool-hero">
          <div className="ool-hero-copy">
            <p className="ool-kicker">3–12 players · one device each</p>
            <h1 className="ool-title">Out of Line</h1>
            <p className="ool-tagline">
              A fill-in-the-blank party game where the judge picks the funniest
              card, and nobody has to behave.
            </p>
            <div className="ool-hero-notes">
              <span>7-card hands</span>
              <span>Judge rotates every round</span>
              <span>First to {target} wins</span>
            </div>
          </div>
          <div className="ool-hero-stack" aria-hidden>
            <div className="ool-hero-card is-back">A deeply questionable group costume</div>
            <div className="ool-hero-card is-middle">An emergency cheese board</div>
            <div className="ool-hero-card is-front">
              The worst thing to find in a hotel room is ___
            </div>
          </div>
        </header>

        <ErrorBanner message={decksError} />

        {session ? (
          <section className="ool-rejoin-card">
            <div>
              <p className="ool-kicker">Seat saved on this device</p>
              <h2>Back to room {session.code}</h2>
              <p>Your hand and score are waiting.</p>
            </div>
            <div className="ool-button-row">
              <button
                type="button"
                className="ool-button is-primary"
                onClick={() =>
                  navigate(`/out-of-line/room/${session.code}`)
                }
              >
                Rejoin
              </button>
              <button
                type="button"
                className="ool-button is-ghost"
                onClick={forgetSession}
              >
                Forget seat
              </button>
            </div>
          </section>
        ) : null}

        <div className="ool-landing-grid">
          <section className="ool-panel">
            <div className="ool-panel-heading">
              <p className="ool-kicker">Start a table</p>
              <h2>Create a room</h2>
              <p>Choose the decks now. They lock when the room is made.</p>
            </div>

            <form onSubmit={handleCreate} className="ool-form">
              <label className="ool-field">
                <span>Your name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="Host"
                  autoComplete="nickname"
                />
              </label>

              <fieldset className="ool-fieldset">
                <legend>Decks</legend>
                {loadingDecks ? (
                  <Spinner label="Loading decks…" />
                ) : (
                  <div className="ool-deck-list">
                    {decks.map((deck) => {
                      const isBase = deck.id === "base";
                      const checked = isBase || extras.has(deck.id);
                      return (
                        <label
                          key={deck.id}
                          className={`ool-deck-option${
                            checked ? " is-checked" : ""
                          }${isBase ? " is-locked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isBase}
                            onChange={() => toggleExtra(deck.id)}
                          />
                          <span className="ool-deck-info">
                            <span className="ool-deck-title">
                              {deck.name}
                              {deck.adult ? (
                                <span className="ool-adult-tag">18+</span>
                              ) : null}
                              {isBase ? (
                                <span className="ool-deck-locked">Always on</span>
                              ) : null}
                            </span>
                            <span className="ool-deck-description">
                              {deck.description}
                            </span>
                            <span className="ool-deck-count">
                              {deck.prompt_count} prompts · {deck.answer_count}{" "}
                              cards
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <fieldset className="ool-fieldset is-inline">
                <legend>First to</legend>
                <div className="ool-segmented">
                  {TARGETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={target === value ? "is-active" : ""}
                      onClick={() => setTarget(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>

              {anyAdult ? (
                <label className="ool-age-check">
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(event) =>
                      setAdultConfirmed(event.target.checked)
                    }
                  />
                  <span>
                    <strong>I’m 18 or older.</strong> After Hours is suggestive,
                    not explicit. Everyone in this room needs to be 18+.
                  </span>
                </label>
              ) : null}

              <ErrorBanner
                message={createError}
                onDismiss={() => setCreateError(null)}
              />

              <button
                type="submit"
                className="ool-button is-primary is-wide"
                disabled={!canCreate}
              >
                {creating ? "Making the room…" : "Create room"}
              </button>
              {!name.trim() ? (
                <p className="ool-hint">Add a name so the table knows you.</p>
              ) : null}
              {anyAdult && !adultConfirmed ? (
                <p className="ool-hint">Confirm the 18+ note to continue.</p>
              ) : null}
            </form>
          </section>

          <section className="ool-panel is-join">
            <div className="ool-panel-heading">
              <p className="ool-kicker">Have a code?</p>
              <h2>Join a room</h2>
              <p>One phone each. The room code is on the host’s screen.</p>
            </div>
            <form onSubmit={handleJoin} className="ool-form">
              <label className="ool-field">
                <span>Room code</span>
                <input
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.toUpperCase())
                  }
                  placeholder="BLUE-TIGER-73"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={24}
                />
              </label>
              {joinError ? (
                <ErrorBanner
                  message={joinError}
                  onDismiss={() => setJoinError(null)}
                />
              ) : null}
              <button
                type="submit"
                className="ool-button is-secondary is-wide"
              >
                Join room
              </button>
            </form>
            <div className="ool-join-note">
              <span className="ool-note-dot" aria-hidden />
              <p>
                No accounts, no chat, no spectators. Just cards and questionable
                judgement.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
