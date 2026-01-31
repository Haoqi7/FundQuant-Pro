import React, { useState, useEffect } from 'react';
import { Zap, GitMerge, RefreshCw, BrainCircuit, HardDrive, Download, Database, Globe, CheckCircle, XCircle, Save, Disc } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useGlobal } from '../context/GlobalState';
import { dataManager } from '../data/DataManager';
import { marketService } from '../services/MarketService';

export default function Settings() {
  const { aiConfig, setAiConfig, valuationMode, setValuationMode, engine, allFunds } = useGlobal();
  const [iterating, setIterating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [storageMode, setStorageMode] = useState(dataManager.getStorageMode());
  const [diagStatus, setDiagStatus] = useState({ search: 'idle', pool: 'idle', quote: 'idle' });
  const [tempAiConfig, setTempAiConfig] = useState(aiConfig);

  useEffect(() => { setTempAiConfig(aiConfig); }, [aiConfig]);

  const saveAiConfiguration = () => {
    setAiConfig(tempAiConfig);
    alert("AI 配置已保存");
  };

  const handleStorageSwitch = (mode) => {
    setStorageMode(mode);
    dataManager.setStorageMode(mode);
    alert(`存储模式已切换为: ${mode === 'data' ? 'Data Folder' : 'Browser Cache'}`);
  };

  const runNetworkTest = async () => {
    setDiagStatus({ search: 'loading', pool: 'loading', quote: 'loading' });
    
    // 1. 搜索 (EastMoney)
    try {
      const s = await marketService.searchFund('000001');
      setDiagStatus(prev => ({ ...prev, search: s.length > 0 ? 'success' : 'error' }));
    } catch { setDiagStatus(prev => ({ ...prev, search: 'error' })); }

    // 2. 热门池 (Tencent)
    try {
      const r = await marketService.getHotFunds();
      setDiagStatus(prev => ({ ...prev, pool: r.length > 0 ? 'success' : 'error' }));
    } catch { setDiagStatus(prev => ({ ...prev, pool: 'error' })); }

    // 3. 实时 (Tencent)
    try {
      const q = await marketService.getFundRealtime('005827');
      setDiagStatus(prev => ({ ...prev, quote: q ? 'success' : 'error' }));
    } catch { setDiagStatus(prev => ({ ...prev, quote: 'error' })); }
  };

  const triggerAiIteration = async () => { /* 保持不变 */ 
    if (!aiConfig.apiKey) return alert("请先配置 API Key");
    setIterating(true);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] 连接 AI...`, ...prev]);
    try {
      const count = await engine.aiIterate(aiConfig, allFunds);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] 成功优化 ${count} 个因子`, ...prev]);
    } catch (e) {
      setLogs(prev => [`[ERROR] ${e.message}`, ...prev]);
    } finally {
      setIterating(false);
    }
  };

  const StatusItem = ({ label, status }) => (
    <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/10">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      {status === 'loading' && <RefreshCw className="animate-spin text-blue-500" size={14}/>}
      {status === 'success' && <CheckCircle className="text-emerald-500" size={14}/>}
      {status === 'error' && <XCircle className="text-rose-500" size={14}/>}
      {status === 'idle' && <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"/>}
    </div>
  );

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      
      {/* 1. API 诊断 */}
      <GlassCard className="p-4">
        <h3 className="font-bold flex items-center gap-2 mb-3 text-slate-800 dark:text-white text-sm">
          <Globe size={16} className="text-blue-500"/> API 连接诊断 (Tencent/EM)
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <StatusItem label="Search (EM)" status={diagStatus.search}/>
          <StatusItem label="Hot Pool (TX)" status={diagStatus.pool}/>
          <StatusItem label="Quote (TX)" status={diagStatus.quote}/>
        </div>
        <button onClick={runNetworkTest} className="w-full mt-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">开始检测</button>
      </GlassCard>

      {/* 2. AI 配置 */}
      <GlassCard className="p-4">
        <div className="flex justify-between items-center mb-4">
           <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white text-sm">
             <Zap size={16} className="text-amber-500"/> AI 核心配置
           </h3>
           <button onClick={saveAiConfiguration} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors">
             <Save size={12}/> 保存
           </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Base URL</label>
            <input value={tempAiConfig.baseUrl} onChange={e => setTempAiConfig({...tempAiConfig, baseUrl: e.target.value})} className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">API Key</label>
            <input type="password" value={tempAiConfig.apiKey} onChange={e => setTempAiConfig({...tempAiConfig, apiKey: e.target.value})} placeholder="sk-..." className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Model Name</label>
            <input value={tempAiConfig.modelName} onChange={e => setTempAiConfig({...tempAiConfig, modelName: e.target.value})} className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">System Prompt</label>
            <textarea 
              rows={3}
              value={tempAiConfig.systemPrompt || "你是一个金融量化专家。"} 
              onChange={e => setTempAiConfig({...tempAiConfig, systemPrompt: e.target.value})} 
              className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono resize-none"
            />
          </div>
        </div>
      </GlassCard>

      {/* 3. 算法模式 & 存储 (保持不变) */}
      <GlassCard className="p-4">
        <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-white text-sm"><GitMerge size={16} className="text-purple-500"/> 估值模式</h3>
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg mb-4">
           <button onClick={() => setValuationMode('source')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${valuationMode === 'source' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500'}`}>腾讯源直连</button>
           <button onClick={() => setValuationMode('algo')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${valuationMode === 'algo' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-slate-500'}`}>AI 自研算法</button>
        </div>
        {valuationMode === 'algo' && (
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-xl p-4">
            <button onClick={triggerAiIteration} disabled={iterating} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {iterating ? <RefreshCw className="animate-spin" size={14}/> : <BrainCircuit size={14}/>}
              {iterating ? "迭代优化中..." : "触发 AI 算法自我迭代"}
            </button>
            <div className="mt-3 bg-black/5 dark:bg-black/30 rounded-lg p-2 h-20 overflow-y-auto font-mono text-[9px] text-slate-500">
              {logs.length === 0 ? "系统就绪" : logs.map((l,i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white text-sm"><HardDrive size={16} className="text-emerald-500"/> 数据存储</h3>
           <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg">
             <button onClick={() => handleStorageSwitch('data')} className={`px-2 py-1 rounded text-[10px] ${storageMode === 'data' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-400'}`}>Data</button>
             <button onClick={() => handleStorageSwitch('browser')} className={`px-2 py-1 rounded text-[10px] ${storageMode === 'browser' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-400'}`}>Browser</button>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
           <button onClick={() => dataManager.exportFile('algo')} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-colors">
              <Database size={20} className="text-purple-500 mb-1"/><span className="text-[10px] font-bold text-slate-500">算法数据</span>
           </button>
           <button onClick={() => dataManager.exportFile('user')} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors">
              <Download size={20} className="text-blue-500 mb-1"/><span className="text-[10px] font-bold text-slate-500">用户数据</span>
           </button>
        </div>
      </GlassCard>
    </div>
  );
}