import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function GlassCard({ children, className, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={twMerge(clsx(
        "backdrop-blur-md bg-white/70 dark:bg-slate-900/60",
        "border border-white/30 dark:border-slate-700/50",
        "shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50",
        "rounded-2xl p-5 transition-all duration-300",
        onClick && "cursor-pointer hover:bg-white/90 dark:hover:bg-slate-800/80 hover:scale-[1.01] hover:shadow-2xl",
        className
      ))}
    >
      {children}
    </div>
  );
}