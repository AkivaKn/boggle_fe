import { currentPlayer, rankPlayers } from "../game";
import type { ActiveGame } from "../types";

const medal = (rank: number): string => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
};

export function TurnSummary({
  game,
  onNext,
  onManagePlayers,
  onSettings,
  onHome,
}: {
  game: ActiveGame;
  onNext: () => void;
  onManagePlayers: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  const player = currentPlayer(game);
  const tally = game.scores[player.id] ?? game.turn;
  const next = game.players[game.turnIndex + 1];
  const ranking = rankPlayers(game);

  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col justify-center py-6">
      <div className="fc-plate p-6 text-center">
        <p className="fc-eyebrow">Turn over</p>
        <h1 className="fc-masthead fc-display mt-2 text-4xl">
          {player.name}
        </h1>
        <p className="fc-score-big">{tally.correct}</p>
        <p className="fc-muted text-sm">
          correct · {tally.passed} pass{tally.passed === 1 ? "" : "es"}
        </p>
      </div>

      <section className="mt-6">
        <h2 className="fc-display text-2xl">Leaderboard</h2>
        <div className="mt-3 space-y-2">
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
              <span className="fc-rank-score">{row.score.correct}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-3">
        <button type="button" className="fc-btn fc-btn-primary" onClick={onNext}>
          Pass to {next?.name ?? "the results"}
        </button>
        <div className="fc-action-links">
          <button type="button" className="fc-link" onClick={onManagePlayers}>
            Edit players
          </button>
          <button type="button" className="fc-link" onClick={onSettings}>
            Back to settings
          </button>
          <button type="button" className="fc-link fc-muted" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
