import { useEffect, useState } from "react";

export const Timer: React.FC<{ endsAt: string }> = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalDuration = 180;

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

  return (
    <div className="w-full mb-4"> 
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Clock</span>
        <span className={`text-3xl font-mono font-black ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-linear ${timeLeft < 30 ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};