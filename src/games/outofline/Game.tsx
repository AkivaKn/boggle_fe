import { useState } from "react";
import QRCode from "react-qr-code";
import { navigate } from "../../router";
import {
  forceAdvance,
  nextRound,
  pickWinner,
  submitCards,
  type Card,
  type RoomState,
  type SubmissionView,
} from "./api";
import type { RunCommand } from "./types";
import {
  AnswerCard,
  ErrorBanner,
  PromptCard,
  Scoreboard,
} from "./ui";

export default function Game({
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
  const prompt = state.prompt;
  const judge = state.players.find((player) => player.seat === state.judge_seat);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const shareLink = `${window.location.origin}/out-of-line/room/${state.code}`;

  const copyShare = async (kind: "code" | "link", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  if (!prompt) {
    return (
      <div className="ool-shell ool-room-shell">
        <div className="ool-bg" aria-hidden />
        <main className="ool-main safe-area">
          <ErrorBanner message={actionError} onDismiss={clearActionError} />
          <p className="ool-empty">The prompt is being dealt…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="ool-shell ool-room-shell">
      <div className="ool-bg" aria-hidden />
      <main className="ool-main safe-area is-game">
        <nav className="ool-topnav is-game">
          <button
            type="button"
            className="ool-back-link"
            onClick={() => navigate("/out-of-line")}
          >
            ← Leave table
          </button>
          <button
            type="button"
            className="ool-room-code-small is-button"
            onClick={() => setShareOpen((open) => !open)}
            aria-expanded={shareOpen}
            aria-label={`Room code ${state.code}. Open share options.`}
          >
            {state.code}
          </button>
          <span className="ool-round-pill">Round {state.round_no}</span>
        </nav>

        {shareOpen ? (
          <div className="ool-game-share">
            <div className="ool-qr-wrap is-small">
              <QRCode
                value={shareLink}
                size={112}
                bgColor="#F8F1DF"
                fgColor="#132925"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <div className="ool-game-share-copy">
              <p className="ool-kicker">Room code</p>
              <p className="ool-game-share-code">{state.code}</p>
              <p className="ool-share-hint">Scan or share to join late</p>
              <div className="ool-share-actions">
                <button
                  type="button"
                  className="ool-button is-secondary is-small"
                  onClick={() => copyShare("code", state.code)}
                >
                  {copied === "code" ? "Code copied" : "Copy code"}
                </button>
                <button
                  type="button"
                  className="ool-button is-ghost is-small"
                  onClick={() => copyShare("link", shareLink)}
                >
                  {copied === "link" ? "Link copied" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <header className="ool-game-head">
          <div>
            <p className="ool-kicker">
              First to {state.target_score} · {state.round_no} round
              {state.round_no === 1 ? "" : "s"} in
            </p>
            <h1 className="ool-game-title">
              {judge ? `${judge.name} is judging` : "The judge is thinking"}
            </h1>
          </div>
          <Scoreboard state={state} />
        </header>

        <ErrorBanner message={actionError} onDismiss={clearActionError} />

        <PromptCard
          prompt={prompt}
          judgeName={judge ? judge.name : "The judge"}
        />

        <GameRound
          key={`${state.round_no}-${state.phase}-${prompt.id}-${state.self.submitted ? 1 : 0}`}
          code={code}
          state={state}
          prompt={prompt}
          run={run}
          pending={pending}
        />

        {state.self.is_host && state.can_force ? (
          <details className="ool-host-controls">
            <summary>Host controls</summary>
            <p>
              No turn timers. Force the current phase if the table stalls.
              Missing cards are chosen at random; a forced pick is random too.
            </p>
            <button
              type="button"
              className="ool-button is-danger is-small"
              onClick={async () => {
                if (!window.confirm(forceCopy(state))) return;
                await run("force", () => forceAdvance(code, state.self.token));
              }}
              disabled={pending !== null}
            >
              {pending === "force" ? "Forcing…" : forceLabel(state)}
            </button>
          </details>
        ) : null}
      </main>
    </div>
  );
}

function GameRound({
  code,
  state,
  prompt,
  run,
  pending,
}: {
  code: string;
  state: RoomState;
  prompt: NonNullable<RoomState["prompt"]>;
  run: RunCommand;
  pending: string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pickedSubmission, setPickedSubmission] = useState<string | null>(null);
  const busy = pending !== null;

  const toggleCard = (id: string) => {
    if (state.self.submitted || busy) return;
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((cardID) => cardID !== id);
      }
      if (current.length >= prompt.pick) {
        return [...current.slice(current.length - prompt.pick + 1), id];
      }
      return [...current, id];
    });
  };

  const play = async () => {
    if (selected.length !== prompt.pick) return;
    const ok = await run("submit", () =>
      submitCards(code, state.self.token, selected),
    );
    if (ok) setSelected([]);
  };

  const crown = async () => {
    if (!pickedSubmission) return;
    await run("pick", () =>
      pickWinner(code, state.self.token, pickedSubmission),
    );
  };

  const advance = async () => {
    await run("next", () => nextRound(code, state.self.token));
  };

  return (
    <section className="ool-table">
      {state.phase === "submitting" ? (
        state.self.is_judge ? (
          <WaitingPanel
            title="You’re judging this round"
            body="Cards are coming in. You’ll see them anonymously once everyone has played."
            submitted={state.submitted_count}
            needed={state.needed}
          />
        ) : state.self.submitted ? (
          <div className="ool-waiting-wrap">
            <WaitingPanel
              title="Your card is in"
              body="Your hand has been refilled. Sit tight while the rest of the table plays."
              submitted={state.submitted_count}
              needed={state.needed}
            />
            <HandPreview hand={state.self.hand} />
          </div>
        ) : (
          <HandBoard
            hand={state.self.hand}
            selected={selected}
            pick={prompt.pick}
            busy={busy}
            pending={pending === "submit"}
            onToggle={toggleCard}
            onPlay={play}
          />
        )
      ) : null}

      {state.phase === "judging" ? (
        state.self.is_judge ? (
          <JudgingBoard
            submissions={state.submissions || []}
            picked={pickedSubmission}
            busy={busy}
            pending={pending === "pick"}
            onPick={setPickedSubmission}
            onCrown={crown}
          />
        ) : (
          <WaitingPanel
            title="The judge is choosing"
            body="Submissions are anonymous until the pick. No hints, no campaigning."
            submitted={state.submitted_count}
            needed={state.needed}
          />
        )
      ) : null}

      {state.phase === "reveal" ? (
        <RevealBoard
          state={state}
          busy={busy}
          pending={pending === "next"}
          onNext={advance}
        />
      ) : null}
    </section>
  );
}

function HandBoard({
  hand,
  selected,
  pick,
  busy,
  pending,
  onToggle,
  onPlay,
}: {
  hand: Card[];
  selected: string[];
  pick: number;
  busy: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  onPlay: () => void;
}) {
  return (
    <div className="ool-hand-board">
      <div className="ool-hand-heading">
        <div>
          <p className="ool-kicker">Your hand</p>
          <h2>
            Pick {pick} card{pick === 1 ? "" : "s"}
          </h2>
        </div>
        <span className="ool-selected-count">
          {selected.length}/{pick} selected
        </span>
      </div>

      <div className="ool-hand-scroll">
        {hand.map((card) => {
          const order = selected.indexOf(card.id) + 1;
          return (
            <AnswerCard
              key={card.id}
              card={card}
              selected={order > 0}
              order={order || undefined}
              onClick={() => onToggle(card.id)}
              disabled={busy}
            />
          );
        })}
      </div>

      <div className="ool-play-bar">
        <p>
          {selected.length === pick
            ? "Ready to play."
            : pick === 2
              ? "Choose two cards. Tap one again to undo."
              : "Choose one card. Tap it again to undo."}
        </p>
        <button
          type="button"
          className="ool-button is-primary"
          onClick={onPlay}
          disabled={selected.length !== pick || busy}
        >
          {pending ? "Playing…" : `Play ${pick === 2 ? "cards" : "card"}`}
        </button>
      </div>
    </div>
  );
}

function HandPreview({ hand }: { hand: Card[] }) {
  return (
    <div className="ool-hand-preview">
      <p className="ool-kicker">Refilled hand</p>
      <div className="ool-hand-scroll is-preview">
        {hand.map((card) => (
          <div key={card.id} className="ool-answer-card is-preview">
            <span className="ool-answer-text">{card.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaitingPanel({
  title,
  body,
  submitted,
  needed,
}: {
  title: string;
  body: string;
  submitted: number;
  needed: number;
}) {
  const percent = needed > 0 ? Math.min(100, (submitted / needed) * 100) : 0;
  return (
    <div className="ool-waiting-panel">
      <span className="ool-pulse-dot" aria-hidden />
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="ool-progress" aria-hidden>
        <span style={{ width: `${percent}%` }} />
      </div>
      <span className="ool-progress-label">
        {submitted} of {needed} cards in
      </span>
    </div>
  );
}

function JudgingBoard({
  submissions,
  picked,
  busy,
  pending,
  onPick,
  onCrown,
}: {
  submissions: SubmissionView[];
  picked: string | null;
  busy: boolean;
  pending: boolean;
  onPick: (id: string) => void;
  onCrown: () => void;
}) {
  return (
    <div className="ool-judging-board">
      <div className="ool-hand-heading">
        <div>
          <p className="ool-kicker">Anonymous entries</p>
          <h2>Which one lands?</h2>
        </div>
        <span className="ool-selected-count">
          {submissions.length} card{submissions.length === 1 ? "" : "s"} in
        </span>
      </div>
      <div className="ool-judge-grid">
        {submissions.map((submission) => (
          <button
            key={submission.id}
            type="button"
            className={`ool-submission${picked === submission.id ? " is-selected" : ""}`}
            onClick={() => onPick(submission.id)}
            disabled={busy}
            aria-pressed={picked === submission.id}
          >
            <span className="ool-submission-cards">
              {submission.cards.map((card) => (
                <span key={card.id} className="ool-submission-card">
                  {card.text}
                </span>
              ))}
            </span>
            <span className="ool-submission-label">
              {picked === submission.id ? "Selected" : "Tap to select"}
            </span>
          </button>
        ))}
      </div>
      <div className="ool-play-bar">
        <p>Only you can pick. Choose the card that gets the biggest reaction.</p>
        <button
          type="button"
          className="ool-button is-primary"
          onClick={onCrown}
          disabled={!picked || busy}
        >
          {pending ? "Crowning…" : "Crown this one"}
        </button>
      </div>
    </div>
  );
}

function RevealBoard({
  state,
  busy,
  pending,
  onNext,
}: {
  state: RoomState;
  busy: boolean;
  pending: boolean;
  onNext: () => void;
}) {
  const winner = state.winner;
  const isFinalNext =
    Math.max(...state.players.map((player) => player.score)) >=
    state.target_score;
  return (
    <div className="ool-reveal-board">
      <div className="ool-reveal-head">
        <p className="ool-kicker">The pick</p>
        <h2>{winner ? `${winner.name} wins the round` : "Round reveal"}</h2>
      </div>

      {winner ? (
        <div className="ool-winner-cards">
          {winner.cards.map((card) => (
            <AnswerCard key={card.id} card={card} tone="winner" />
          ))}
        </div>
      ) : null}

      {state.submissions && state.submissions.length > 0 ? (
        <div className="ool-all-entries">
          <p className="ool-kicker">All entries</p>
          <div className="ool-entry-list">
            {state.submissions.map((submission) => (
              <div
                key={submission.id}
                className={`ool-entry${submission.winner ? " is-winner" : ""}`}
              >
                <span className="ool-entry-author">
                  {submission.name}
                  {submission.winner ? (
                    <span className="ool-mini-tag is-win">+1</span>
                  ) : null}
                </span>
                <span className="ool-entry-cards">
                  {submission.cards.map((card) => (
                    <span key={card.id}>{card.text}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ool-play-bar">
        <p>
          {state.self.is_judge
            ? "You judged this one. Move the table on when it’s time."
            : "Next judge rotates one seat."}
        </p>
        {state.can_next ? (
          <button
            type="button"
            className="ool-button is-primary"
            onClick={onNext}
            disabled={busy}
          >
            {pending
              ? "Dealing…"
              : isFinalNext
                ? "See final scores"
                : "Next round"}
          </button>
        ) : (
          <span className="ool-waiting-note">
            Waiting for the host or judge to continue.
          </span>
        )}
      </div>
    </div>
  );
}

function forceLabel(state: RoomState): string {
  if (state.phase === "submitting") return "Force missing cards";
  if (state.phase === "judging") return "Pick a random winner";
  return "Force next round";
}

function forceCopy(state: RoomState): string {
  if (state.phase === "submitting") {
    return "Fill every missing submission with random cards from that player’s hand?";
  }
  if (state.phase === "judging") {
    return "Pick a random winning submission? This awards the point immediately.";
  }
  return "Advance to the next round now?";
}
