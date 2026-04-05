import React, { useState, useEffect } from "react";
import type { Die } from "../api";

const ambiguousLetters = new Set(["M", "W", "Z", "N", "C"]);

export const BoggleBoard: React.FC<{ board: Die[] }> = ({ board }) => {
  const dice = board.slice(0, 16);

  // Use state for board rotation
  const [boardRotation, setBoardRotation] = useState(0);

  useEffect(() => {
    // When the board changes, pick a new random rotation
    const angles = [0, 90, 180, 270];
    setBoardRotation(angles[Math.floor(Math.random() * angles.length)]);
  }, [board]);

  return (
    <div
      style={{ transform: `rotate(${boardRotation}deg)` }}
      className="w-full h-full inline-grid grid-cols-4 gap-1 sm:gap-2 p-2 sm:p-4 bg-slate-300 rounded-[2rem] shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-transform"
    >
      {dice.map((die, index) => (
        <div
          key={index}
          style={{ transform: `rotate(${die.orientation}deg)` }}
          className="relative aspect-square 
                     bg-white rounded-xl 
                     flex items-center justify-center border-t border-slate-50 transition-transform"
        >
          <span className="text-3xl sm:text-5xl font-black text-slate-800 select-none uppercase tracking-tighter relative flex flex-col items-center">
            {die.letter === "Q" ? (
              <span className="flex items-baseline">
                Q<span className="text-base sm:text-xl">u</span>
              </span>
            ) : (
              die.letter
            )}
            {ambiguousLetters.has(die.letter) && (
              <span
                className="block w-4 h-0.5 bg-indigo-400 rounded-full mt-1"
                style={{ marginTop: "0.15em" }}
              ></span>
            )}
          </span>
          <div className="absolute top-1 left-1 right-1 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl pointer-events-none"></div>
        </div>
      ))}
    </div>
  );
};
