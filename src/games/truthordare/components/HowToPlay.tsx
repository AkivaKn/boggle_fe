export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <section className="tod-screen tod-howto anim-fade-in">
      <button type="button" className="tod-back" onClick={onBack}>
        <span aria-hidden>←</span> Back
      </button>

      <header className="tod-page-head">
        <p className="tod-eyebrow">Rules</p>
        <h1 className="tod-title">How to play</h1>
        <p className="tod-tagline">
          2–12 players. No score, no timer. Just truths, dares, and a phone
          going round the group.
        </p>
      </header>

      <div className="tod-panel">
        <h2 className="tod-section-title">A turn</h2>
        <ol className="tod-rules">
          <li>The game shows whose turn it is.</li>
          <li>That player chooses Truth or Dare.</li>
          <li>Read the prompt aloud and answer or complete it.</li>
          <li>
            Tap Next to pass the phone along. Swap or skip any prompt.
          </li>
        </ol>
      </div>

      <div className="tod-panel">
        <h2 className="tod-section-title">Mixed packs</h2>
        <p className="tod-body-copy">
          Select one or more packs during setup. PG, Spicy and NSFW prompts are
          combined into one shuffled pool, and the pack is shown on each card
          so the group always knows what it is playing.
        </p>
      </div>

      <div className="tod-panel">
        <h2 className="tod-section-title">The packs</h2>
        <ul className="tod-rules">
          <li>
            <strong>PG</strong> — silly and family-friendly.
          </li>
          <li>
            <strong>Spicy</strong> — cheeky and flirty.
          </li>
          <li>
            <strong>NSFW</strong> — adult themes.
          </li>
        </ul>
      </div>
    </section>
  );
}
