import React, { useState, useEffect } from 'react';

interface TimerProps {
  endsAt: string; // ISO timestamp from the server
}

export const Timer: React.FC<TimerProps> = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!endsAt) return;

    const calculateTimeLeft = () => {
      // Calculate milliseconds difference between the target time and right now
      const diff = new Date(endsAt).getTime() - Date.now();
      return diff > 0 ? Math.floor(diff / 1000) : 0;
    };

    // Set immediately so it doesn't wait 1 second to update
    setTimeLeft(calculateTimeLeft());

    // Tick every second
    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [endsAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isEnding = timeLeft <= 10 && timeLeft > 0;

  return (
    <div className={`text-5xl font-mono font-bold tracking-wider text-center my-4 transition-colors duration-300 ${isEnding ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      {timeLeft === 0 && endsAt && (
        <div className="text-xl text-red-600 mt-2 uppercase tracking-widest animate-bounce">
          Time's Up!
        </div>
      )}
    </div>
  );
};