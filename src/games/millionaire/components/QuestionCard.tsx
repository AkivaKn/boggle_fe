const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

/** Reveal state pushed up from `answer_result` (SPEC §2). `null` while the
 *  answer hasn't been resolved yet. */
export interface QuestionReveal {
  correct: boolean;
  correctIndex: number;
}

export interface QuestionCardProps {
  level: number;
  question: string;
  options: string[];
  /** Indices struck out by 50:50 (M3) — server-broadcast, rendered inert. */
  removedOptions: number[];
  /** Index the player clicked (locks the card until `answer_result`). */
  chosenIndex: number | null;
  /** `answer_result` payload once it arrives — drives correct/wrong coloring. */
  reveal: QuestionReveal | null;
  /** Overall interlock (M2 review finding 3): false while the local run is
   *  not `active` (fallen/walked/won) — the card renders inert, no clicks. */
  disabled?: boolean;
  /** POST via api.answer() happens in App (owns room/token). */
  onSelect: (index: number) => void;
}

/**
 * UX v3 options layout: MOBILE = ONE stacked column of full-width hexagons
 * in natural A/B/C/D order (letter chip left, 64px targets). Desktop (`md:`)
 * keeps the classic 2×2 DIAMOND arrangement — A top-left, B bottom-left,
 * C top-right, D bottom-right, exactly mirroring the show — recreated purely
 * with order utilities so the DOM stays in reading order on both layouts.
 */
/** Row-major grid placement that reads A,C / B,D (the show's diamond). */
const MD_DIAMOND_ORDER = ["md:order-1", "md:order-3", "md:order-2", "md:order-4"];

export const QuestionCard: React.FC<QuestionCardProps> = ({
  level,
  question,
  options,
  removedOptions,
  chosenIndex,
  reveal,
  disabled = false,
  onSelect,
}) => {
  // Locked from click until the server's answer_result arrives (or, after
  // reveal, permanently for this question) — or while the run isn't active.
  const locked = disabled || chosenIndex !== null || reveal !== null;
  const awaitingResult = chosenIndex !== null && reveal === null;
  // Reveal coloring rides the 400ms rise family; plain state changes 250ms.
  const durationCls = reveal !== null ? "duration-[400ms]" : "duration-[250ms]";

  return (
    <div className="w-full">
      {/* Central dark-blue plate with a subtle gold border glow. The
          "QUESTION N OF 15" label lives in App's top stake line (UX v3).
          UX v3 wave 2: the plate DIMS while the answer is locked (the
          chosen hexagon's glow-locked pulse is the reused lock state). */}
      <div
        className={`plate px-5 py-4 text-center text-base font-semibold leading-snug text-slate-100 shadow-[0_0_28px_rgba(212,175,55,0.12)] transition-opacity duration-[250ms] ${
          awaitingResult ? "opacity-50" : ""
        }`}
      >
        {question}
      </div>

      {/* Mobile: stacked full-width column. Desktop: diamond podium grid. */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-3">
        {[0, 1, 2, 3].map((i) => {
          const option = options[i] ?? "";
          const removed = removedOptions.includes(i);
          const isChosen = chosenIndex === i;
          const isCorrect = reveal !== null && reveal.correctIndex === i;
          const isWrongPick = reveal !== null && isChosen && !reveal.correct;

          // Default podium: amber/gold fill with dark stage text; hover
          // raises the podium. Reveal colors kept emerald/rose (M2).
          let inner =
            "bg-gradient-to-b from-gold-400 to-gold-600 text-stage-950 hover:from-gold-300 hover:to-gold-500 hover:-translate-y-0.5";
          let wrapper = "";
          if (locked && !isCorrect && !isWrongPick && !isChosen)
            inner = "bg-stage-900/70 text-slate-400"; // dimmed non-answers
          if (isWrongPick) {
            inner = "bg-gradient-to-b from-rose-500 to-rose-700 text-rose-50";
            wrapper = "glow-wrong";
          }
          if (isCorrect) {
            inner =
              "bg-gradient-to-b from-emerald-400 to-emerald-600 text-emerald-950";
            wrapper = "glow-correct";
          }
          if (removed)
            inner =
              "bg-stage-950/60 text-slate-600 line-through scale-[0.92]"; // folded hexagon
          if (isChosen && awaitingResult) wrapper = "glow-locked";

          return (
            <div
              key={`${level}:${i}`}
              className={`${wrapper} ${MD_DIAMOND_ORDER[i]} transition-transform ${durationCls} ${
                removed || (locked && !isCorrect && !isWrongPick && !isChosen)
                  ? ""
                  : "hover:-translate-y-0.5"
              }`}
            >
              <button
                type="button"
                disabled={locked || removed}
                aria-label={`Option ${CHOICE_LABELS[i] ?? i}`}
                onClick={() => {
                  if (!locked && !removed) onSelect(i);
                }}
                className={`hex-shape flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold transition-colors md:min-h-0 md:gap-2 md:px-6 md:py-2.5 ${
                  locked || removed ? "cursor-not-allowed" : "cursor-pointer"
                } ${inner}`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center border text-xs font-black not-italic md:h-5 md:w-5 md:text-xs ${
                    removed
                      ? "border-slate-700 text-slate-600"
                      : "border-current opacity-80"
                  }`}
                >
                  {CHOICE_LABELS[i] ?? i}
                </span>
                <span className={removed ? "opacity-70" : ""}>{option}</span>
              </button>
            </div>
          );
        })}
      </div>

      <p
        className="mt-3 min-h-5 text-center text-xs font-black uppercase tracking-widest"
        role="status"
      >
        {awaitingResult ? (
          <span className="text-amber-300 animate-pulse">
            Answer locked — awaiting result…
          </span>
        ) : reveal ? (
          reveal.correct ? (
            <span className="text-safe anim-fade-in">Correct!</span>
          ) : (
            <span className="text-danger anim-fade-in">Wrong answer.</span>
          )
        ) : (
          ""
        )}
      </p>
    </div>
  );
};
