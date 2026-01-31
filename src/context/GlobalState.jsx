import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { marketService } from '../services/MarketService';
import { dataManager } from '../data/DataManager';
import { ValuationEngine } from '../services/ValuationEngine';

const AppContext = createContext();
const engine = new ValuationEngine();

export const GlobalProvider = ({ children }) => {
  const [fundList, setFundList] = useState([]); // 初始为空
  const [liveData, setLiveData] = useState({});
  const [holdingsCache, setHoldingsCache] = useState({});
  const [marketStatus, setMarketStatus] = useState('idle');

  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [systemOnline, setSystemOnline] = useState(true);
  const [valuationMode, setValuationMode] = useState('source');
  const [aiConfig, setAiConfig] = useState({
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    modelName: "deepseek-ai/deepseek-vl-chat",
    systemPrompt: "你是一个金融量化专家。"
  });

  const timerRef = useRef(null);

  useEffect(() => {
    // 1. 加载用户数据
    const userData = dataManager.getUserData();
    if (userData) {
      setPortfolio(userData.portfolio || []);
      setWatchlist(userData.watchlist || []);
      setTransactions(userData.transactions || []);
      if(userData.aiConfig) setAiConfig(prev => ({...prev, ...userData.aiConfig}));
    }

    // 2. 加载热门基金 (Tencent Pool)
    const initHotFunds = async () => {
      setMarketStatus('loading');
      try {
        const hot = await marketService.getHotFunds();
        setFundList(hot);
        setMarketStatus(hot.length ? 'success' : 'error');
      } catch (e) {
        setMarketStatus('error');
      }
    };
    initHotFunds();
  }, []);

  // ... (其他逻辑如 useEffect 保存数据, searchAndAddFunds, handleTrade 等保持不变) ...
  useEffect(() => {
    dataManager.saveUserData({ portfolio, watchlist, transactions, aiConfig });
  }, [portfolio, watchlist, transactions, aiConfig]);

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
    const activeCodes = [...new Set([...portfolio.map(p=>p.code), ...watchlist, ...fundList.map(f=>f.code)])];
    if (activeCodes.length === 0) return;

    const updates = {};
    // 批量处理
    const batchSize = 10;
    for (let i = 0; i < activeCodes.length; i += batchSize) {
      const batch = activeCodes.slice(i, i + batchSize);
      await Promise.all(batch.map(async (code) => {
        let realData = null;
        if (valuationMode === 'source') {
          realData = await marketService.getFundRealtime(code);
        }
        if (realData) updates[code] = realData;
      }));
    }
    if(Object.keys(updates).length > 0) setLiveData(prev => ({...prev, ...updates}));
  };

  useEffect(() => {
    fetchMarketData();
    const scheduleNext = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const interval = 60000; // 统一1分钟
      timerRef.current = setTimeout(() => { fetchMarketData().then(scheduleNext); }, interval);
    };
    scheduleNext();
    return () => clearTimeout(timerRef.current);
  }, [systemOnline, portfolio, watchlist, fundList, valuationMode]);

  const handleTrade = (code, type, amount, price) => { /* ...保持原样... */ 
    const val = parseFloat(amount);
    const nav = parseFloat(price);
    if (!val || !nav) return;
    setPortfolio(prev => {
      const exist = prev.find(p => p.code === code);
      const shares = val / nav;
      if (type === 'buy') {
        if (exist) {
          const newShares = exist.totalShares + shares;
          const newCost = exist.totalCost + val;
          return prev.map(p => p.code === code ? { ...p, totalShares: newShares, totalCost: newCost, avgCost: newCost/newShares } : p);
        }
        return [...prev, { code, totalShares: shares, totalCost: val, avgCost: nav }];
      } else {
        if (!exist) return prev;
        const totalShares = exist.totalShares - shares;
        const costPart = exist.avgCost * shares;
        if (totalShares < 0.01) return prev.filter(p => p.code !== code);
        return prev.map(p => p.code === code ? { ...p, totalShares, totalCost: exist.totalCost - costPart } : p);
      }
    });
    setTransactions(prev => [...prev, { id: Date.now(), date: new Date().toISOString(), code, type, amount: val, price: nav, shares: val/nav }]);
  };

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