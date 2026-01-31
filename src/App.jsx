import React, { useState } from 'react';
import Layout from './components/Layout';
import Portfolio from './views/Portfolio';
import Market from './views/Market';
import Settings from './views/Settings';
import FundDetail from './views/FundDetail';
import AiChat from './views/AiChat'; // 新增导入
import { Wallet, Search, Settings as SettingsIcon, Zap } from 'lucide-react';
import { TabBtn } from './components/ui/TabBtn';

export default function App() {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [selectedFundId, setSelectedFundId] = useState(null);

  const renderContent = () => {
    // 详情页路由拦截
    if (selectedFundId) {
      return <FundDetail fundId={selectedFundId} onBack={() => setSelectedFundId(null)} />;
    }
    // 主标签页路由
    switch (activeTab) {
      case 'portfolio': return <Portfolio onSelect={setSelectedFundId} />;
      case 'market': return <Market onSelect={setSelectedFundId} />;
      case 'ai': return <AiChat />;
      case 'settings': return <Settings />;
      default: return <Portfolio onSelect={setSelectedFundId} />;
    }
  };

  return (
    <Layout>
      {/* 动态内容区域 */}
      {renderContent()}
      
      {/* 底部导航栏 (仅在非详情页显示) */}
      {!selectedFundId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl shadow-slate-300/50 dark:shadow-black/50 rounded-2xl flex justify-around p-2 z-30 animate-slide-up">
          <TabBtn 
            active={activeTab === 'portfolio'} 
            onClick={() => setActiveTab('portfolio')} 
            icon={Wallet} 
            label="持仓" 
          />
          <TabBtn 
            active={activeTab === 'market'} 
            onClick={() => setActiveTab('market')} 
            icon={Search} 
            label="市场" 
          />
          <TabBtn 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')} 
            icon={Zap} 
            label="AI投顾" 
          />
          <TabBtn 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={SettingsIcon} 
            label="系统" 
          />
        </div>
      )}
    </Layout>
  );
}