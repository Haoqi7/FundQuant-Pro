import React from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useGlobal } from '../context/GlobalState';

export default function Layout({ children }) {
  const { systemOnline, setSystemOnline } = useGlobal();

  return (
    <div className="flex flex-col h-screen bg-[#f1f5f9] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-white/20 dark:border-slate-800/50 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-800 dark:text-white">FundQuant Pro</h1>
            <div className="flex items-center gap-1.5">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${systemOnline ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {systemOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">
                {systemOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setSystemOnline(!systemOnline)}
          className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
        >
          {systemOnline ? <Wifi size={20}/> : <WifiOff size={20}/>}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto pb-28 pt-4 px-4 md:px-6 max-w-4xl mx-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
}