import { Fragment } from "react";
import type { Card, DeckInfo, Prompt, RoomState } from "./api";

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="ool-alert" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="ool-alert-close">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="ool-loading" role="status">
      <span className="ool-spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function DeckChips({
  decks,
  showCounts = false,
}: {
  decks: DeckInfo[];
  showCounts?: boolean;
}) {
  return (
    <div className="ool-deck-chips">
      {decks.map((deck) => (
        <span
          key={deck.id}
          className={`ool-deck-chip${deck.adult ? " is-adult" : ""}`}
        >
          {deck.name}
          {deck.adult ? <span className="ool-adult-tag">18+</span> : null}
          {showCounts ? (
            <span className="ool-deck-count">
              {deck.prompt_count} prompts · {deck.answer_count} cards
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function PromptCard({
  prompt,
  judgeName,
}: {
  prompt: Prompt;
  judgeName: string;
}) {
  const parts = prompt.text.split("___");
  return (
    <section className="ool-prompt-card">
      <div className="ool-prompt-meta">
        <span>{judgeName} is judging</span>
        {prompt.pick === 2 ? (
          <span className="ool-pick-badge">Pick 2</span>
        ) : null}
      </div>
      <p className="ool-prompt-text">
        {parts.map((part, index) => (
          <Fragment key={`${index}-${part}`}>
            {part}
            {index < parts.length - 1 ? (
              <span className="ool-blank" aria-hidden>
                {" "}
              </span>
            ) : null}
          </Fragment>
        ))}
      </p>
    </section>
  );
}

export function Scoreboard({ state }: { state: RoomState }) {
  return (
    <div className="ool-scoreboard" aria-label="Scores">
      {state.players.map((player) => {
        const isSelf = player.seat === state.self.seat;
        const isHost = player.seat === state.host_seat;
        return (
          <div
            key={player.seat}
            className={`ool-score-chip${isSelf ? " is-self" : ""}${
              player.is_judge ? " is-judge" : ""
            }`}
          >
            <span className="ool-score-name">
              {player.name}
              {isHost ? <span className="ool-mini-tag">Host</span> : null}
              {player.is_judge ? (
                <span className="ool-mini-tag is-judge">Judge</span>
              ) : null}
            </span>
            <span className="ool-score-value">{player.score}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AnswerCard({
  card,
  selected = false,
  order,
  onClick,
  disabled = false,
  tone = "answer",
}: {
  card: Card;
  selected?: boolean;
  order?: number;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "answer" | "winner";
}) {
  const className = `ool-answer-card${selected ? " is-selected" : ""}${
    tone === "winner" ? " is-winner" : ""
  }${onClick ? " is-clickable" : ""}`;

  if (!onClick) {
    return (
      <div className={className}>
        {tone === "winner" ? <span className="ool-card-kicker">Winner</span> : null}
        <span className="ool-answer-text">{card.text}</span>
        {order ? <span className="ool-order-badge">{order}</span> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="ool-answer-text">{card.text}</span>
      {order ? <span className="ool-order-badge">{order}</span> : null}
    </button>
  );
}

export function ConnectionBanner({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => void;
}) {
  if (status === "open") return null;
  if (status === "reconnecting" || status === "connecting") {
    return (
      <div className="ool-connection-banner is-working">
        <span className="ool-spinner is-small" aria-hidden />
        {status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
      </div>
    );
  }
  if (status === "closed") {
    return (
      <div className="ool-connection-banner is-closed">
        <span>Connection closed.</span>
        <button type="button" onClick={onRetry} className="ool-inline-button">
          Retry
        </button>
      </div>
    );
  }
  return null;
}
