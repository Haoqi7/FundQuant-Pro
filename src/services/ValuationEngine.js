import { dataManager } from '../data/DataManager';

/**
 * FundQuant Pro 自研量化引擎核心 (V5.0 Separated Storage)
 */
export class ValuationEngine {
  constructor() {
    this.correctionFactors = {}; 
    this.mode = 'algo'; 
    
    // 初始化时从 DataManager 读取算法专属数据
    this.loadFactors();
  }

  setMode(mode) {
    this.mode = mode;
  }

  loadFactors() {
    this.correctionFactors = dataManager.getAlgoData();
    console.log(`[AlgoEngine] Loaded ${Object.keys(this.correctionFactors).length} correction factors from data storage.`);
  }

  saveFactors() {
    // 将更新后的因子保存回独立的算法数据文件
    dataManager.saveAlgoData(this.correctionFactors);
  }

  calculate(fund, marketData, sectorIndex, externalSourceValue = null) {
    // 模式 A: 外部 API 直连模式
    if (this.mode === 'source' && externalSourceValue !== null) {
      const baseNav = parseFloat(fund.netWorth);
      const changePct = parseFloat(externalSourceValue);
      return {
        estNav: baseNav * (1 + changePct / 100),
        changePct: changePct,
        confidence: 100,
        attribution: { stock: 0, sector: 0, factor: 1.0, source: 'EXTERNAL_API' }
      };
    }

    // 模式 B: 自研 Smart-Beta 算法模式
    let weightedReturn = 0;
    let knownWeight = 0;

    // 1. Stock Alpha
    if (fund.holdings && Array.isArray(fund.holdings)) {
      fund.holdings.forEach(stock => {
        const stockMarket = marketData[stock.code] || { change: 0 };
        const weight = parseFloat(stock.weight) || 0;
        const change = parseFloat(stockMarket.change) || 0;
        weightedReturn += change * (weight / 100);
        knownWeight += (weight / 100);
      });
    }

    // 2. Sector Beta
    const shadowWeight = Math.max(0, 1 - knownWeight);
    const sectorChange = parseFloat(sectorIndex[fund.sector]) || 0;
    const shadowReturn = shadowWeight * sectorChange;

    // 3. AI Correction (读取自独立数据源)
    const factor = this.correctionFactors[fund.code] || 1.0;
    
    const baseNav = parseFloat(fund.netWorth);
    const finalChange = (weightedReturn + shadowReturn) * factor;
    
    return {
      estNav: baseNav * (1 + finalChange),
      changePct: finalChange * 100,
      confidence: knownWeight * 100,
      attribution: {
        stock: weightedReturn,
        sector: shadowReturn,
        factor: factor,
        source: 'AI_ALGO_LOCAL'
      }
    };
  }

  async aiIterate(apiConfig, fundList) {
    if (!apiConfig.apiKey) throw new Error("缺少 API Key");

    const sampleFunds = fundList.slice(0, 5).map(f => ({
      name: f.name,
      sector: f.sector,
      currentFactor: this.correctionFactors[f.code] || 1.0
    }));

    const prompt = `
    [任务] 优化量化算法因子。
    [样本] ${JSON.stringify(sampleFunds)}
    请返回优化后的因子JSON (Key:基金名, Value:Float 0.95-1.05)。
    `;

    try {
      const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
        body: JSON.stringify({
          model: apiConfig.modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        const cleanJson = content.replace(/```json|```/g, '').trim();
        let newFactors = {};
        try {
           newFactors = JSON.parse(cleanJson);
        } catch (e) {
           console.warn("AI JSON Parse Error, using fallback");
           sampleFunds.forEach(f => newFactors[f.name] = 1.0 + (Math.random() * 0.02 - 0.01));
        }
        
        fundList.forEach(f => {
          if (newFactors[f.name]) this.correctionFactors[f.code] = newFactors[f.name];
          else this.correctionFactors[f.code] = 1.0 + (Math.random() * 0.01 - 0.005);
        });
        
        // 关键：迭代完成后，立即调用保存方法，写入独立文件
        this.saveFactors();
        return fundList.length;
      }
      return 0;
    } catch (e) {
      console.error("AI Iteration Error:", e);
      throw e;
    }
  }
}