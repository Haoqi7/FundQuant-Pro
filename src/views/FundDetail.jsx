import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Star, TrendingUp, TrendingDown, Activity, PieChart, Layers } from 'lucide-react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { GlassCard } from '../components/ui/GlassCard';
import { useGlobal } from '../context/GlobalState';
import { generateHistory } from '../data/mockDb'; // 图表仍用模拟历史，因为获取真实分钟级数据太难

export default function FundDetail({ fundId, onBack }) {
  const { fundList, liveData, holdingsCache, loadFundDetail, portfolio, watchlist, setWatchlist, handleTrade } = useGlobal();
  
  // 从列表中查找，或者如果是新搜索的，可能在列表中
  const fund = fundList.find(f => f.code === fundId) || { code: fundId, name: '加载中...', netWorth: 1.0 };
  const live = liveData[fundId];
  const holdings = holdingsCache[fundId] || []; // 获取持仓数据
  
  const holdingItem = portfolio.find(p => p.code === fundId);
  const isWatched = watchlist.includes(fundId);

  const [tradeMode, setTradeMode] = useState(null);
  const [amount, setAmount] = useState("");

  // 加载持仓详情
  useEffect(() => {
    loadFundDetail(fundId);
  }, [fundId]);

  // 计算显示用的净值
  const currentNav = live ? live.estNav : (fund.netWorth || 1.0);
  const currentPct = live ? live.changePct : 0;

  // 模拟图表 (暂保持模拟，因真实分钟线接口需 Token)
  const chartData = useMemo(() => generateHistory(currentNav, 30), [currentNav]);
  const { max, min } = useMemo(() => {
    const vals = chartData.map(d => d.value);
    return { max: Math.max(...vals), min: Math.min(...vals) };
  }, [chartData]);

  const executeTrade = () => {
    handleTrade(fund.code, tradeMode, amount, currentNav);
    setTradeMode(null);
    setAmount("");
  };

  return (
    <div className="space-y-6 pb-28 animate-slide-up">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500"><ArrowLeft size={20}/></button>
        <div className="text-center">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 max-w-[200px] truncate">{fund.name}</h2>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{fund.code}</span>
        </div>
        <button onClick={() => setWatchlist(prev => prev.includes(fund.code) ? prev.filter(c=>c!==fund.code) : [...prev, fund.code])} className={`p-2.5 rounded-xl shadow-sm transition-colors ${isWatched ? 'bg-amber-50 text-amber-500' : 'bg-white text-slate-300 dark:bg-slate-800'}`}>
          <Star size={20} fill={isWatched ? "currentColor" : "none"}/>
        </button>
      </div>

      {/* Realtime Stats */}
      <div className="text-center py-4">
        {live ? (
          <>
            <div className={`text-5xl font-bold tracking-tighter mb-2 font-mono ${currentPct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {currentNav.toFixed(4)}
            </div>
            <div className={`flex items-center justify-center gap-2 font-bold ${currentPct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {currentPct >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
              <span className="text-xl">{currentPct > 0 ? '+' : ''}{currentPct.toFixed(2)}%</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              <Activity size={12}/> 数据源: {live.source} ({live.time})
            </div>
          </>
        ) : (
          <div className="py-8 text-slate-400 animate-pulse">正在连接交易所...</div>
        )}
      </div>

      {/* Chart Placeholder */}
      <GlassCard className="p-0 overflow-hidden !bg-white/50 dark:!bg-slate-900/50">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
           <span className="text-xs font-bold text-slate-500">净值走势 (30天)</span>
        </div>
        <div className="h-48 w-full mt-2">
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
              <ReferenceLine y={max} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'High', fontSize: 10, fill: '#ef4444' }} />
              <ReferenceLine y={min} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Low', fontSize: 10, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Holdings (真实持仓) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm px-1">
          <PieChart size={16}/> 核心持仓 (前十大)
        </div>
        
        {holdings.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {holdings.map((stock, i) => (
              <GlassCard key={i} className="flex items-center justify-between !py-3 !px-4">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded ${i < 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>{i+1}</span>
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{stock.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{stock.code}</div>
                  </div>
                </div>
                {stock.changePct !== 0 && (
                   <div className={`text-xs font-mono font-bold ${stock.changePct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                     {stock.changePct > 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                   </div>
                )}
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            正在获取持仓数据或暂无披露...
          </div>
        )}
      </div>

      {/* Trade Actions (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex gap-4 z-30 shadow-2xl">
        <button onClick={() => setTradeMode('sell')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">卖出</button>
        <button onClick={() => setTradeMode('buy')} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all">买入</button>
      </div>

      {/* Trade Modal */}
      {tradeMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h3 className="font-bold text-xl mb-6 text-center text-slate-800 dark:text-white">{tradeMode === 'buy' ? '买入' : '卖出'}</h3>
            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl mb-6 border border-slate-100 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-400 uppercase block mb-2">交易金额 (CNY)</label>
              <div className="flex items-center gap-2">
                <span className="text-3xl text-slate-400 font-light">¥</span>
                <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="bg-transparent text-4xl font-bold w-full outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-200" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setTradeMode(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">取消</button>
              <button onClick={executeTrade} className={`flex-1 py-4 rounded-2xl font-bold text-white shadow-xl ${tradeMode === 'buy' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}