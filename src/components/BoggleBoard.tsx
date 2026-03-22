import React from 'react';

interface BoggleBoardProps {
  board: string;
}

export const BoggleBoard: React.FC<BoggleBoardProps> = ({ board }) => {
  if (!board || board.length !== 16) return <div className="text-red-500">Waiting for board...</div>;

  const dice = board.split('');

  return (
    <div className="grid grid-cols-4 gap-2 w-72 h-72 mx-auto bg-orange-500 p-3 rounded-xl shadow-inner">
      {dice.map((letter, index) => (
        <div 
          key={index} 
          className="flex items-center justify-center bg-gray-50 rounded-lg shadow-md text-4xl font-bold text-gray-800 uppercase"
        >
          {letter === 'Q' ? 'Qu' : letter}
        </div>
      ))}
    </div>
  );
};