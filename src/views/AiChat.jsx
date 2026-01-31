import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Bot, User, RefreshCw } from 'lucide-react';
import { useGlobal } from '../context/GlobalState';
import { GlassCard } from '../components/ui/GlassCard';

export default function AiChat() {
  const { aiConfig, portfolio, liveData, allFunds } = useGlobal();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: 'system', content: '我是您的智能量化分析师。我可以基于实时算法数据为您诊断持仓风险。' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!aiConfig.apiKey) {
      setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'assistant', content: '请先在 [设置] 中配置 API Key (SiliconFlow/OpenAI)。' }]);
      setInput("");
      return;
    }

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");
    setLoading(true);

    // 1. 构建上下文 (Context Injection)
    // 提取用户持仓的前5只基金数据，注入 Prompt
    const portfolioContext = portfolio.slice(0, 5).map(p => {
      const fund = allFunds.find(f => f.code === p.code);
      const est = liveData[p.code] || { estNav: fund?.netWorth, changePct: 0 };
      return `- ${fund?.name} (${p.code}): 成本${p.avgCost.toFixed(3)}, 现价${est.estNav?.toFixed(3)}, 偏差${est.changePct}%`;
    }).join('\n');

    const systemPrompt = `
    [角色] 你是 FundQuant Pro 的 AI 投顾助手。
    [数据] 用户当前持仓(Top5):
    ${portfolioContext || "暂无持仓"}
    [任务] 根据用户问题进行简短、专业的金融分析。重点关注风险控制。
    `;

    try {
      const res = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.filter(m => m.role !== 'system').slice(-4), // 保留最近4轮对话
            { role: "user", content: userMsg }
          ],
          stream: false
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      const reply = data.choices?.[0]?.message?.content || "AI 未返回有效内容";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `[连接错误] ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      {/* 聊天记录区域 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>
                {m.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
              </div>
              <GlassCard className={`!p-3 text-sm leading-relaxed ${
                m.role === 'user' 
                  ? '!bg-blue-600 !text-white !border-blue-500' 
                  : '!bg-white dark:!bg-slate-800'
              }`}>
                {m.content}
              </GlassCard>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start gap-2">
             <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white"><Bot size={16}/></div>
             <GlassCard className="!p-3 flex items-center gap-2">
               <RefreshCw className="animate-spin text-slate-400" size={14}/>
               <span className="text-xs text-slate-400">AI 正在分析行情数据...</span>
             </GlassCard>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="mt-2 relative">
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="询问持仓建议或市场风险..."
          className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-4 pl-4 pr-12 shadow-lg focus:ring-2 focus:ring-purple-500/50 outline-none text-sm transition-all"
        />
        <button 
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="absolute right-2 top-2 p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          <Send size={18}/>
        </button>
      </div>
    </div>
  );
}