import React from 'react';

interface BoggleBoardProps {
  board: string;
}

export const BoggleBoard: React.FC<BoggleBoardProps> = ({ board }) => {
  // Ensure we have exactly 16 characters
  const dice = board.padEnd(16, ' ').split('').slice(0, 16);

  return (
    <div className="flex justify-center w-full">
      {/* The Tray: Inset shadow makes it look like a hole in the table */}
      <div className="inline-grid grid-cols-4 gap-3 md:gap-4 p-4 md:p-6 bg-slate-300 rounded-[2.5rem] shadow-[inset_0_4px_12px_rgba(0,0,0,0.2)] border-2 border-slate-400/20">
        
        {/* The Dice */}
        {dice.map((letter, index) => (
          <div
            key={index}
            className="relative group aspect-square w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 
                       bg-white rounded-xl md:rounded-2xl 
                       flex items-center justify-center 
                       transition-all duration-200
                       /* This shadow creates the 3D 'side' of the die */
                       shadow-[0_8px_0_0_#cbd5e1,0_15px_20px_-5px_rgba(0,0,0,0.3)]
                       border-t border-slate-50"
          >
            {/* The Letter */}
            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 select-none uppercase tracking-tighter">
              {letter === 'Q' ? (
                <span className="flex items-baseline">
                  Q<span className="text-xl text-red-500 sm:text-2xl md:text-3xl lowercase">u</span>
                </span>
              ) : (
                letter
              )}
            </span>

            {/* Subtle top-light glare effect */}
            <div className="absolute top-1 left-1 right-1 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl pointer-events-none"></div>
          </div>
        ))}
      </div>
    </div>
  );
};