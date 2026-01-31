import React from 'react';

export function Badge({ children, color = "blue" }) {
  const styles = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    red: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${styles[color] || styles.blue}`}>
      {children}
    </span>
  );
}