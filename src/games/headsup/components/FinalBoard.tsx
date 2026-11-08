import { rankPlayers, winners } from "../game";
import type { ActiveGame } from "../types";

const medal = (rank: number): string => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
};

export function FinalBoard({
  game,
  onPlayAgain,
  onChangeSetup,
  onManagePlayers,
  onHome,
  onAllGames,
}: {
  game: ActiveGame;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onManagePlayers: () => void;
  onHome: () => void;
  onAllGames: () => void;
}) {
  const ranking = rankPlayers(game);
  const champions = winners(game).map((player) => player.name);
  const headline =
    champions.length > 1
      ? `${champions.join(" & ")} tie!`
      : `${champions[0] ?? "Nobody"} wins!`;

  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col justify-center py-6">
      <header className="text-center">
        <span className="fc-trophy inline-block" aria-hidden>
          🏆
        </span>
        <h1 className="fc-masthead fc-display mt-3 text-4xl">{headline}</h1>
        <p className="fc-muted mt-2 text-sm">
          One turn each. Final scores below.
        </p>
      </header>

      <div className="mt-6 space-y-2">
        {ranking.map((row) => (
          <div
            key={row.player.id}
            className={`fc-rank-row ${
              row.rank === 1 ? "fc-rank-row-winner" : ""
            }`}
          >
            <span className="fc-rank-medal" aria-hidden>
              {medal(row.rank)}
            </span>
            <span className="fc-rank-name">{row.player.name}</span>
            <span className="fc-rank-passes">
              {row.score.passed} pass{row.score.passed === 1 ? "" : "es"}
            </span>
            <span className="fc-rank-score">{row.score.correct}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3">
        <button type="button" className="fc-btn fc-btn-primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="fc-btn fc-btn-ghost" onClick={onChangeSetup}>
          Change players &amp; decks
        </button>
        <button type="button" className="fc-btn fc-btn-ghost" onClick={onManagePlayers}>
          Edit players / add a late player
        </button>
        <div className="fc-action-links">
          <button type="button" className="fc-link" onClick={onHome}>
            Game home
          </button>
          <button type="button" className="fc-link" onClick={onAllGames}>
            All games
          </button>
        </div>
      </div>
    </div>
  );
}
