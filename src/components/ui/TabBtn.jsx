import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={twMerge(clsx(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300",
        active 
          ? "text-blue-600 dark:text-blue-400 scale-110 bg-blue-50 dark:bg-slate-800/50" 
          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30"
      ))}
    >
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}