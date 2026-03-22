export const BoggleBoard: React.FC<{ board: string }> = ({ board }) => {
  const dice = board.padEnd(16, ' ').split('').slice(0, 16);

  return (
    <div className="inline-grid grid-cols-4 gap-1.5 sm:gap-3 p-2 sm:p-4 bg-slate-300 rounded-[2rem] shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]">
      {dice.map((letter, index) => (
        <div
          key={index}
          className="relative aspect-square w-12 h-12 sm:w-16 sm:h-16 
                     bg-white rounded-xl shadow-[0_5px_0_0_#cbd5e1,0_10px_15px_-3px_rgba(0,0,0,0.2)]
                     flex items-center justify-center border-t border-slate-50"
        >
          <span className="text-2xl sm:text-4xl font-black text-slate-800 select-none uppercase tracking-tighter">
            {letter === 'Q' ? (
              <span className="flex items-baseline">
                Q<span className="text-base sm:text-xl">u</span>
              </span>
            ) : letter}
          </span>
          <div className="absolute top-1 left-1 right-1 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl pointer-events-none"></div>
        </div>
      ))}
    </div>
  );
};