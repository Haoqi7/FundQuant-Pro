import React, { useMemo } from 'react';
import { Activity, Wallet } from 'lucide-react';
import { useGlobal } from '../context/GlobalState';
import { GlassCard } from '../components/ui/GlassCard';

export default function Portfolio({ onSelect }) {
  const { portfolio, liveData, allFunds } = useGlobal();

  const summary = useMemo(() => {
    let asset = 0, profit = 0;
    portfolio.forEach(p => {
      const fund = allFunds.find(f => f.code === p.code);
      const est = liveData[p.code]?.estNav || parseFloat(fund.netWorth);
      asset += p.totalShares * est;
      profit += (p.totalShares * est - p.totalCost);
    });
    return { asset, profit };
  }, [portfolio, liveData, allFunds]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 资产卡片 */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1e293b] to-[#0f172a] dark:from-blue-900 dark:to-indigo-950 p-8 text-white shadow-2xl shadow-blue-900/20">
        <div className="absolute top-0 right-0 p-6 opacity-5"><Activity size={120} /></div>
        <div className="relative z-10">
          <div className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-1">Total Assets</div>
          <div className="text-4xl font-bold tracking-tight mb-6 flex items-baseline gap-1">
            <span className="text-2xl text-slate-400">¥</span>
            {summary.asset.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex gap-4">
             <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/5">
                <div className="text-[10px] text-slate-300 uppercase tracking-wider mb-0.5">Profit/Loss</div>
                <div className={`font-bold text-lg ${summary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {summary.profit > 0 ? '+' : ''}{summary.profit.toFixed(2)}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Wallet size={18}/> 持仓明细
          </h3>
          <span className="text-xs font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            {portfolio.length} ITEMS
          </span>
        </div>
        <div className="space-y-3">
          {portfolio.map(p => {
            const fund = allFunds.find(f => f.code === p.code);
            const live = liveData[p.code] || { estNav: fund.netWorth, changePct: 0 };
            return (
              <GlassCard key={p.code} onClick={() => onSelect(p.code)} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    {fund.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{fund.name}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono flex gap-2">
                      <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{p.code}</span>
                      <span>{p.totalShares.toFixed(0)} 份</span>
                    </div>
                  </div>
                </div>
                <div className={`text-right ${live.changePct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  <div className="font-bold font-mono text-base">{live.changePct > 0 ? '+' : ''}{live.changePct.toFixed(2)}%</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">¥{live.estNav.toFixed(4)}</div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}