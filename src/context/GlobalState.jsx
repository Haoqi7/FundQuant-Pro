import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { marketService } from '../services/MarketService';
import { dataManager } from '../data/DataManager';
import { ValuationEngine } from '../services/ValuationEngine';

const AppContext = createContext();
const engine = new ValuationEngine();

// ... isTradingTime 函数保持不变 ...
const isTradingTime = () => { return true; }; // 简化测试

export const GlobalProvider = ({ children }) => {
  // ... state 定义保持不变 ...
  const [fundList, setFundList] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [holdingsCache, setHoldingsCache] = useState({});
  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [systemOnline, setSystemOnline] = useState(true);
  const [valuationMode, setValuationMode] = useState('source');
  const [marketStatus, setMarketStatus] = useState('idle');
  
  // AI Config State
  const [aiConfig, setAiConfig] = useState({
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    modelName: "deepseek-ai/deepseek-vl-chat",
    systemPrompt: "你是一个金融量化专家。" // 默认 Prompt
  });

  const timerRef = useRef(null);

  // 1. 初始化加载
  useEffect(() => {
    const userData = dataManager.getUserData();
    if (userData) {
      setPortfolio(userData.portfolio || []);
      setWatchlist(userData.watchlist || []);
      setTransactions(userData.transactions || []);
      // 加载保存的 AI 配置
      if (userData.aiConfig) {
        setAiConfig(prev => ({ ...prev, ...userData.aiConfig }));
      }
    }

    const initHotFunds = async () => {
      setMarketStatus('loading');
      try {
        const hot = await marketService.getHotFunds();
        setFundList(hot.length ? hot : []);
        setMarketStatus(hot.length ? 'success' : 'error');
      } catch (e) { setMarketStatus('error'); }
    };
    initHotFunds();
  }, []);

  // 2. 数据持久化 (包含 aiConfig)
  useEffect(() => {
    dataManager.saveUserData({ portfolio, watchlist, transactions, aiConfig });
  }, [portfolio, watchlist, transactions, aiConfig]);

  // ... 其余逻辑 (useEffect, handleTrade) 保持不变 ...
  useEffect(() => { engine.setMode(valuationMode); }, [valuationMode]);

  const searchAndAddFunds = async (keyword) => {
    return await marketService.searchFund(keyword);
  };

  const loadFundDetail = async (code) => {
    if (holdingsCache[code] && Date.now() - holdingsCache[code].timestamp < 60000) return;
    const stocks = await marketService.getFundHoldings(code);
    setHoldingsCache(prev => ({ ...prev, [code]: { data: stocks, timestamp: Date.now() } }));
  };

  const fetchMarketData = async () => {
    if (!systemOnline) return;
    const activeCodes = [...new Set([...portfolio.map(p=>p.code), ...watchlist, ...fundList.slice(0,10).map(f=>f.code)])];
    if (activeCodes.length === 0) return;

    const updates = {};
    const batchSize = 5;
    for (let i = 0; i < activeCodes.length; i += batchSize) {
      const batch = activeCodes.slice(i, i + batchSize);
      await Promise.all(batch.map(async (code) => {
        let realData = null;
        if (valuationMode === 'source') {
          realData = await marketService.getFundRealtime(code);
        }
        // 如果是 algo 模式，或者 source 模式失败，尝试用引擎
        if (!realData && valuationMode === 'source') {
           // 这里可以增加逻辑：如果 source 失败，自动切换 algo 逻辑进行估算
           // 但目前为了简单，只在 algo 模式下启用引擎
        }
        // 如果是 Algo 模式，这里调用 engine.calculate ... (略，复用之前逻辑)
        
        if (realData) updates[code] = realData;
      }));
    }
    if(Object.keys(updates).length) setLiveData(prev => ({...prev, ...updates}));
  };

  // 定时器
  useEffect(() => {
    fetchMarketData();
    const scheduleNext = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const interval = (isTradingTime() && systemOnline) ? 60000 : 3600000;
      timerRef.current = setTimeout(() => { fetchMarketData().then(scheduleNext); }, interval);
    };
    scheduleNext();
    return () => clearTimeout(timerRef.current);
  }, [systemOnline, portfolio, watchlist, fundList, valuationMode]);

  const handleTrade = (code, type, amount, price) => { /* ... Keep trade logic ... */ };

  return (
    <AppContext.Provider value={{
      fundList, liveData, holdingsCache, portfolio, watchlist, setWatchlist,
      transactions, searchAndAddFunds, loadFundDetail, handleTrade,
      aiConfig, setAiConfig, systemOnline, setSystemOnline,
      valuationMode, setValuationMode, marketStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useGlobal = () => useContext(AppContext);