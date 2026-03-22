import React, { useState, useEffect } from 'react';

export const Timer: React.FC<{ endsAt: string }> = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalDuration = 180; // 3 minutes in seconds

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      return diff > 0 ? Math.floor(diff / 1000) : 0;
    };
    setTimeLeft(calc());
    const id = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const percentage = (timeLeft / totalDuration) * 100;
  const isUrgent = timeLeft < 30;

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time Remaining</span>
        <span className={`text-4xl font-mono font-black ${isUrgent ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${isUrgent ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};