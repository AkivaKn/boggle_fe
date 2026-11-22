export function Home({
  onPlay,
  onHowTo,
  onAllGames,
}: {
  onPlay: () => void;
  onHowTo: () => void;
  onAllGames: () => void;
}) {
  return (
    <section className="tod-screen tod-home anim-fade-in">
      <button type="button" className="tod-back" onClick={onAllGames}>
        <span aria-hidden>←</span> All games
      </button>

      <div className="tod-home-card">
        <p className="tod-eyebrow">Party game</p>
        <h1 className="tod-logo">
          Truth
          <span className="tod-logo-or">or</span>
          Dare
        </h1>
        <p className="tod-tagline">
          Pick a side, pass the phone, and keep the night moving.
        </p>

        <div className="tod-pack-strip" aria-label="Content packs">
          <span className="tod-pack-chip tod-pack-pg">PG</span>
          <span className="tod-pack-chip tod-pack-spicy">Spicy</span>
          <span className="tod-pack-chip tod-pack-nsfw">NSFW</span>
        </div>

        <div className="tod-home-actions">
          <button type="button" className="tod-btn tod-btn-primary" onClick={onPlay}>
            Play
          </button>
          <button type="button" className="tod-btn tod-btn-ghost" onClick={onHowTo}>
            How to play
          </button>
        </div>
      </div>

      <p className="tod-note">Mix and match packs. Swap or skip any prompt.</p>
    </section>
  );
}
