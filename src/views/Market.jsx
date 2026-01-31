import React, { useState, useEffect } from 'react';
import { Search, Star, Loader2, Flame, AlertTriangle, RefreshCw } from 'lucide-react';
import { useGlobal } from '../context/GlobalState';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';

export default function Market({ onSelect }) {
  const { fundList, liveData, watchlist, setWatchlist, searchAndAddFunds, marketStatus } = useGlobal();
  const [term, setTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // 防抖搜索
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (term.length >= 2) {
        setIsSearching(true);
        setSearchError(null);
        try {
          const results = await searchAndAddFunds(term);
          setSearchResults(results);
          if (results.length === 0) setSearchError("未找到匹配基金，请检查代码");
        } catch (e) {
          setSearchError("搜索服务连接超时，请重试");
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setSearchError(null);
      }
    }, 800); // 增加延迟，减少请求

    return () => clearTimeout(delayDebounceFn);
  }, [term]);

  const displayList = term.length >= 2 ? searchResults : fundList;
  const toggleWatch = (code) => {
    setWatchlist(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18}/>
        <input 
          value={term} 
          onChange={e => setTerm(e.target.value)}
          placeholder="搜索基金代码 (例: 012349)"
          className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-3 pl-11 pr-4 shadow-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-sm transition-all"
        />
        {isSearching && <Loader2 className="absolute right-4 top-3.5 animate-spin text-blue-500" size={18} />}
      </div>

      {/* 标题栏 */}
      {!term && (
        <div className="flex items-center justify-between px-2 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Flame size={16} className="text-rose-500"/>
            实时热门排行榜
          </div>
          {marketStatus === 'loading' && <span className="text-[10px] text-slate-400">加载中...</span>}
          {marketStatus === 'error' && <span className="text-[10px] text-rose-500 flex items-center gap-1"><AlertTriangle size={10}/> 数据源连接失败</span>}
        </div>
      )}

      {/* 列表内容 */}
      <div className="space-y-3">
        {/* 错误提示 */}
        {searchError && (
          <div className="text-center py-8 text-rose-400 text-xs">
            {searchError}
          </div>
        )}

        {/* 榜单为空提示 */}
        {!term && fundList.length === 0 && marketStatus !== 'loading' && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <RefreshCw size={24} className="mx-auto text-slate-300 mb-2"/>
            <p className="text-slate-400 text-xs">暂无法获取热门榜单</p>
            <p className="text-slate-300 text-[10px] mt-1">请尝试使用搜索功能查找特定基金</p>
          </div>
        )}

        {/* 正常列表 */}
        {displayList.map(fund => {
          const live = liveData[fund.code]; 
          const isWatched = watchlist.includes(fund.code);
          
          return (
            <GlassCard key={fund.code} onClick={() => onSelect(fund.code)} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleWatch(fund.code); }}
                  className={`p-2 shrink-0 rounded-full transition-colors ${isWatched ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}
                >
                  <Star size={16} fill={isWatched ? "currentColor" : "none"}/>
                </button>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate pr-2">{fund.name}</div>
                  <div className="flex gap-2 mt-1">
                    <Badge color={fund.type === '热门榜' ? 'red' : 'blue'}>{fund.type || '基金'}</Badge>
                    <span className="text-[10px] text-slate-400 font-mono self-center">{fund.code}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                {live ? (
                  <>
                    <div className="font-bold font-mono text-sm">{live.estNav.toFixed(4)}</div>
                    <div className={`text-xs font-bold ${live.changePct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {live.changePct > 0 ? '+' : ''}{live.changePct.toFixed(2)}%
                    </div>
                    <div className="text-[9px] text-slate-300 scale-90 origin-right mt-0.5">实时</div>
                  </>
                ) : (
                  <div className="text-right">
                     <div className="font-mono text-sm text-slate-500">{fund.netWorth ? fund.netWorth.toFixed(4) : '--'}</div>
                     <div className="text-[10px] text-slate-400">最新净值</div>
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}