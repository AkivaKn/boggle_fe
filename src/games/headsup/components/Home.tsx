export function Home({
  onPlay,
  onHowTo,
  onDecks,
  onAllGames,
}: {
  onPlay: () => void;
  onHowTo: () => void;
  onDecks: () => void;
  onAllGames: () => void;
}) {
  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col justify-center py-8">
      <button
        type="button"
        className="fc-link self-start"
        onClick={onAllGames}
      >
        ← All games
      </button>

      <header className="mt-6 text-center">
        <span className="fc-emoji-badge" aria-hidden>
          🙈
        </span>
        <h1 className="fc-masthead fc-display mt-4 text-5xl leading-[0.95]">
          FOREHEAD
          <br />
          CHARADES
        </h1>
        <p className="fc-muted mx-auto mt-4 max-w-xs text-sm">
          Hold the phone up. Your team clues. You guess. Beat the clock.
        </p>
      </header>

      <ol className="fc-plate mt-8 space-y-4 p-5 text-sm">
        <li className="flex items-start gap-3">
          <span className="fc-step" aria-hidden>
            1
          </span>
          <span>
            Everyone gets one turn as the guesser. Hold the phone on your
            forehead, screen facing your team.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="fc-step fc-step-teal" aria-hidden>
            2
          </span>
          <span>
            Your team describes each word without saying it. Guess as many as
            you can before the timer runs out.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="fc-step fc-step-plum" aria-hidden>
            3
          </span>
          <span>
            Tilt the phone down for a correct guess, up to pass — or use the big
            tap zones. Highest score wins.
          </span>
        </li>
      </ol>

      <div className="mt-8 grid gap-3">
        <button type="button" className="fc-btn fc-btn-primary" onClick={onPlay}>
          Play
        </button>
        <button type="button" className="fc-btn fc-btn-ghost" onClick={onHowTo}>
          How to play
        </button>
        <button type="button" className="fc-btn fc-btn-ghost" onClick={onDecks}>
          Manage decks
        </button>
      </div>
    </div>
  );
}
