/**
 * MarketService V8.0 (Tencent First)
 * 策略：由于新浪接口在某些网络下失效，全面切换至腾讯接口 (qt.gtimg.cn)。
 * 腾讯接口稳定、支持 HTTPS、无防盗链限制。
 */

const jsonp = (url, callbackName) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const name = callbackName || `jsonp_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    if (url.indexOf('callback=') === -1 && !callbackName) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + `callback=${name}`;
    }
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout"));
    }, 5000);
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (!callbackName) window[name] = undefined; 
      clearTimeout(timeout);
    };
    if (!window[name]) {
        window[name] = (data) => { cleanup(); resolve(data); };
    }
    script.src = url;
    script.onerror = () => { cleanup(); reject(new Error("Network Error")); };
    document.head.appendChild(script);
  });
};

export class MarketService {
  
  /**
   * 1. 实时估值 (主源：腾讯 HTTPS)
   */
  getFundRealtime(code) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // 腾讯基金接口
      script.src = `https://qt.gtimg.cn/q=jj${code}`;
      
      script.onload = () => {
        const varName = `v_jj${code}`;
        const dataStr = window[varName];
        document.head.removeChild(script);
        
        if (dataStr) {
          const p = dataStr.split('~');
          // 腾讯基金数据位:
          // 0: 代码, 1: 名称, 2: 最新净值, 3: 累计净值, 4: 昨日净值, ..., 13: 更新日期
          const name = p[1];
          const nav = parseFloat(p[2]); 
          const yesterday = parseFloat(p[4]);
          
          // 腾讯不直接提供实时估值(GSZ)，我们用实时净值代替
          // 并计算日涨幅
          let pct = 0;
          if (yesterday > 0 && nav > 0) {
             pct = ((nav - yesterday) / yesterday) * 100;
          }

          resolve({
            source: '腾讯证券',
            estNav: nav,
            changePct: pct,
            time: p[13], // 2023-10-27
            name: name
          });
        } else {
          // 如果腾讯没数据，静默失败，不报错以免刷屏
          resolve(null);
        }
      };
      
      script.onerror = () => {
        document.head.removeChild(script);
        resolve(null);
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * 2. 搜索 (东方财富 HTTPS) - 已验证可用
   */
  async searchFund(keyword) {
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;
    try {
      const data = await jsonp(url, 'FundSearchCallback');
      if (data?.Datas) {
        return data.Datas.map(i => ({ 
          code: i.CODE, 
          name: i.NAME, 
          type: '基金', 
          sector: '综合' 
        }));
      }
      return [];
    } catch (e) { return []; }
  }

  /**
   * 3. 热门排行榜 (实时池策略)
   * 既然 Search 和 Rank 接口不稳定，我们用 "核心资产池 + 实时行情" 构造排行榜
   * 这种方式最稳定，只要腾讯接口活着，排行榜就能显示。
   */
  async getHotFunds() {
    // 内置 20 只市场关注度最高的基金
    const HOT_POOL = [
      { c: "012349", n: "天弘恒生科技" }, { c: "005827", n: "易方达蓝筹" },
      { c: "161725", n: "招商中证白酒" }, { c: "001156", n: "申万新能源" },
      { c: "003096", n: "中欧医疗健康" }, { c: "000001", n: "华夏成长" },
      { c: "001618", n: "天弘中证电子" }, { c: "000248", n: "汇添富消费" },
      { c: "007963", n: "易方达黄金" },   { c: "005918", n: "天弘沪深300" },
      { c: "002190", n: "农银新能源" },   { c: "001632", n: "天弘中证食品" },
      { c: "001594", n: "天弘中证银行" }, { c: "003984", n: "嘉实新能源" },
      { c: "001595", n: "天弘中证证券" }, { c: "004854", n: "广发中证传媒" }
    ];

    // 批量拉取它们的实时数据
    const codes = HOT_POOL.map(f => 'jj' + f.c).join(',');
    const url = `https://qt.gtimg.cn/q=${codes}`;

    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            const results = HOT_POOL.map(fund => {
                const varName = `v_jj${fund.c}`;
                const str = window[varName];
                let pct = 0;
                let nav = 1.0;
                if (str) {
                    const p = str.split('~');
                    nav = parseFloat(p[2]);
                    const yes = parseFloat(p[4]);
                    if (yes > 0) pct = ((nav - yes) / yes) * 100;
                }
                return {
                    code: fund.c,
                    name: fund.n,
                    type: '热门榜',
                    netWorth: nav,
                    changePct: pct
                };
            });
            // 按涨幅排序
            results.sort((a,b) => b.changePct - a.changePct);
            document.head.removeChild(script);
            resolve(results);
        };
        script.onerror = () => {
            document.head.removeChild(script);
            resolve([]); // 失败返回空
        };
        document.head.appendChild(script);
    });
  }

  /**
   * 4. 获取持仓 (腾讯版)
   * 流程: 平种数据(代码) -> 腾讯行情(实时)
   */
  async getFundHoldings(code) {
    try {
      // 1. 获取代码 (pingzhongdata 只有 HTTP，我们尝试一下，如果被拦截则无法获取持仓)
      // 在严格 HTTPS 环境下，这步可能会由于 Mixed Content 失败。
      // 唯一解法是使用后端代理，但为了纯前端，我们尝试用 script tag (部分浏览器允许 script 混合内容)
      const codes = await this.fetchPingZhongData(code);
      if (!codes || codes.length === 0) return [];

      // 2. 转换代码格式适配腾讯
      // 腾讯格式: sh600519, sz000858, hk00700
      const tencentCodes = codes.slice(0, 10).map(c => {
        if (c.length === 5) return `hk${c}`;
        if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`;
        return `sz${c}`;
      }).join(',');

      // 3. 批量获取行情
      return await this.fetchTencentStocks(tencentCodes);
    } catch (e) {
      return [];
    }
  }

  fetchPingZhongData(code) {
    return new Promise((resolve) => {
      // 尝试 HTTPS，如果失败（404），则此功能在纯前端 HTTPS 下不可用
      const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`; 
      const script = document.createElement('script');
      script.onload = () => {
        const s = window.stockCodes;
        window.stockCodes = undefined; window.ishb = undefined;
        document.head.removeChild(script);
        resolve(s || []);
      };
      script.onerror = () => {
        if(script.parentNode) document.head.removeChild(script);
        resolve([]);
      };
      document.head.appendChild(script);
    });
  }

  // 使用腾讯接口批量获取股票行情
  fetchTencentStocks(listStr) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://qt.gtimg.cn/q=${listStr}`;
      
      script.onload = () => {
        const results = [];
        const codes = listStr.split(',');
        
        codes.forEach(c => {
          const varName = `v_${c}`;
          const dataStr = window[varName];
          if (dataStr) {
            const p = dataStr.split('~');
            // 腾讯股票数据位: 1:名字, 3:当前价, 31:涨跌, 32:涨跌幅(%)
            // 港股可能略有不同，但前几位通常一致
            let name = p[1];
            let pct = parseFloat(p[32]);
            
            results.push({
              code: c,
              name: name,
              changePct: pct || 0,
              weight: 0 
            });
          }
        });
        document.head.removeChild(script);
        resolve(results);
      };
      
      script.onerror = () => {
        document.head.removeChild(script);
        resolve([]);
      };
      document.head.appendChild(script);
    });
  }
}

export const marketService = new MarketService();