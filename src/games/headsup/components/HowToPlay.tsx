export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col py-6">
      <button type="button" className="fc-link self-start" onClick={onBack}>
        ← Home
      </button>

      <header className="mt-5 text-center">
        <p className="fc-eyebrow">The rules, quickly</p>
        <h1 className="fc-display mt-1 text-4xl">HOW TO PLAY</h1>
        <p className="fc-muted mt-2 text-sm">
          One phone. One guesser at a time. No saying the word.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        <section className="fc-plate p-5">
          <h2 className="fc-display text-xl">On your turn</h2>
          <ul className="fc-rules mt-3">
            <li>
              Hold the phone against your forehead with the screen facing your
              team. You will not be able to see the word.
            </li>
            <li>
              Your team describes the word with clues, impressions, or acting.
              They cannot say the word, spell it, or say part of it.
            </li>
            <li>Shout your guesses out loud. The team scores the word.</li>
          </ul>
        </section>

        <section className="fc-plate p-5">
          <h2 className="fc-display text-xl">Scoring</h2>
          <ul className="fc-rules mt-3">
            <li>Correct guess = 1 point. Pass = 0 points and is unlimited.</li>
            <li>
              Everyone gets one turn as guesser. Highest individual score wins;
              a tie is a shared win.
            </li>
            <li>The word list never repeats until the deck is used up.</li>
          </ul>
        </section>

        <section className="fc-plate p-5">
          <h2 className="fc-display text-xl">Tilt or tap</h2>
          <ul className="fc-rules mt-3">
            <li>
              <strong>Tilt down</strong> = correct. <strong>Tilt up</strong> =
              pass.
            </li>
            <li>
              Hold still for a moment at the start of each turn so the game can
              calibrate to how you are holding the phone.
            </li>
            <li>
              If motion controls are unavailable or blocked, the top and bottom
              tap zones do exactly the same job. On desktop, use the keyboard:
              Space/↓ = correct, ↑ = pass.
            </li>
          </ul>
        </section>

        <section className="fc-plate p-5">
          <h2 className="fc-display text-xl">Decks</h2>
          <p className="fc-muted mt-3 text-sm">
            Pick one or more built-in decks, or write your own list under
            Manage decks. Custom decks stay on this device.
          </p>
        </section>
      </div>

      <button type="button" className="fc-link mt-6 self-center" onClick={onBack}>
        Back to home
      </button>
    </div>
  );
}
