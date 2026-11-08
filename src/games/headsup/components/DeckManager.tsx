import { useState } from "react";
import type { Deck } from "../types";
import { MAX_WORDS, MIN_WORDS, sanitizeWords, uid } from "../storage";

export function DeckManager({
  decks,
  customDecks,
  onChange,
  onBack,
}: {
  decks: Deck[];
  customDecks: Deck[];
  onChange: (decks: Deck[]) => void;
  onBack: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rawWords, setRawWords] = useState("");
  const [error, setError] = useState<string | null>(null);

  const words = sanitizeWords(rawWords);
  const builtins = decks.filter((deck) => deck.builtin);

  const startAdd = () => {
    setEditingId(null);
    setName("");
    setRawWords("");
    setError(null);
    setOpen(true);
  };

  const startEdit = (deck: Deck) => {
    setEditingId(deck.id);
    setName(deck.name);
    setRawWords(deck.words.join("\n"));
    setError(null);
    setOpen(true);
  };

  const closeEditor = () => {
    setOpen(false);
    setEditingId(null);
    setError(null);
  };

  const save = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Give the deck a name.");
      return;
    }
    if (words.length < MIN_WORDS) {
      setError(
        `Add at least ${MIN_WORDS} unique words — ${words.length} so far.`,
      );
      return;
    }
    const existing = customDecks.find((deck) => deck.id === editingId);
    const saved: Deck = {
      id: editingId ?? uid(),
      name: cleanName,
      emoji: existing?.emoji ?? "🎲",
      words,
      builtin: false,
    };
    onChange(
      editingId
        ? customDecks.map((deck) => (deck.id === editingId ? saved : deck))
        : [...customDecks, saved],
    );
    closeEditor();
  };

  const remove = (deck: Deck) => {
    if (!window.confirm(`Delete the "${deck.name}" deck?`)) return;
    onChange(customDecks.filter((candidate) => candidate.id !== deck.id));
    if (editingId === deck.id) closeEditor();
  };

  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col py-6">
      <button type="button" className="fc-link self-start" onClick={onBack}>
        ← Back
      </button>

      <header className="mt-5 text-center">
        <p className="fc-eyebrow">Your word library</p>
        <h1 className="fc-display mt-1 text-4xl">DECKS</h1>
        <p className="fc-muted mt-2 text-sm">
          Built-in decks plus your own lists, stored on this device.
        </p>
      </header>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="fc-display text-2xl">Built-in</h2>
        <span className="fc-chip">{builtins.length} decks</span>
      </div>
      <div className="mt-3 space-y-2">
        {builtins.map((deck) => (
          <details key={deck.id} className="fc-deck-detail">
            <summary className="fc-deck-detail-summary">
              <span className="text-xl" aria-hidden>
                {deck.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="fc-deck-name">{deck.name}</span>
                {deck.group && (
                  <span className="fc-deck-meta">{deck.group}</span>
                )}
              </span>
              <span className="fc-deck-count">{deck.words.length} words</span>
            </summary>
            <p className="fc-deck-preview">
              {deck.words.slice(0, 8).join(" · ")}…
            </p>
          </details>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="fc-display text-2xl">Your decks</h2>
        {!open && (
          <button type="button" className="fc-link" onClick={startAdd}>
            + New deck
          </button>
        )}
      </div>

      {open && (
        <form
          className="fc-plate mt-3 space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="fc-label block">
            Deck name
            <input
              className="fc-field mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Office inside jokes"
              maxLength={40}
            />
          </label>
          <label className="fc-label block">
            Words — one per line or comma-separated
            <textarea
              className="fc-field mt-2 min-h-40 resize-y font-mono text-xs"
              value={rawWords}
              onChange={(event) => setRawWords(event.target.value)}
              placeholder={"Pizza\nKaraoke\nMonday mornings"}
              spellCheck={false}
            />
          </label>
          <p className="fc-muted text-xs">
            {words.length} unique word{words.length === 1 ? "" : "s"} · minimum{" "}
            {MIN_WORDS} · maximum {MAX_WORDS}
          </p>
          {error && (
            <p className="fc-banner fc-banner-danger anim-shake" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-2">
            <button type="submit" className="fc-btn fc-btn-primary">
              {editingId ? "Save changes" : "Create deck"}
            </button>
            <button
              type="button"
              className="fc-btn fc-btn-ghost"
              onClick={closeEditor}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {customDecks.length === 0 ? (
          <p className="fc-empty">No custom decks yet. Make one for your group.</p>
        ) : (
          customDecks.map((deck) => (
            <div key={deck.id} className="fc-custom-deck">
              <span className="text-xl" aria-hidden>
                {deck.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="fc-deck-name truncate">{deck.name}</p>
                <p className="fc-deck-meta">{deck.words.length} words</p>
              </div>
              <button
                type="button"
                className="fc-link"
                onClick={() => startEdit(deck)}
              >
                Edit
              </button>
              <button
                type="button"
                className="fc-link fc-danger"
                onClick={() => remove(deck)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <button type="button" className="fc-link mt-6 self-center" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
