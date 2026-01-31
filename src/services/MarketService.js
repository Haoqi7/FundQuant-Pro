/**
 * MarketService V9.0 (Search Fix)
 * 修复搜索问题：引入腾讯 Smartbox 接口作为主搜索源
 */

const jsonp = (url, callbackName) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const name = callbackName || `jsonp_${Date.now()}`;
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
   * 1. 实时估值 (腾讯)
   */
  getFundRealtime(code) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://qt.gtimg.cn/q=jj${code}`;
      script.onload = () => {
        const varName = `v_jj${code}`;
        const dataStr = window[varName];
        document.head.removeChild(script);
        if (dataStr) {
          const p = dataStr.split('~');
          const name = p[1];
          const nav = parseFloat(p[2]); 
          const yesterday = parseFloat(p[4]);
          let pct = 0;
          if (yesterday > 0 && nav > 0) {
             pct = ((nav - yesterday) / yesterday) * 100;
          }
          resolve({
            source: '腾讯证券',
            estNav: nav,
            changePct: pct,
            time: p[13],
            name: name
          });
        } else {
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
   * 2. 搜索 (双源灾备：腾讯优先 -> 东财兜底)
   */
  async searchFund(keyword) {
    if (!keyword) return [];

    // 策略 A: 腾讯 Smartbox (极速、HTTPS、稳定)
    try {
      const results = await this._searchTencent(keyword);
      if (results && results.length > 0) return results;
    } catch (e) {
      // console.warn("Tencent search failed, fallback to EM", e);
    }

    // 策略 B: 东方财富 (原接口，作为备用)
    try {
      return await this._searchEastMoney(keyword);
    } catch (e) {
      console.error("All search sources failed");
      return [];
    }
  }

  _searchTencent(keyword) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // t=fund 指定搜索基金
      script.src = `https://smartbox.gtimg.cn/s3/?t=fund&q=${encodeURIComponent(keyword)}`;
      
      script.onload = () => {
        // 腾讯返回全局变量 v_hint
        const dataStr = window.v_hint;
        // 清理
        document.head.removeChild(script);
        window.v_hint = undefined;

        if (dataStr) {
          // 格式: "code~name~type~...^code~name~..."
          // 例: "000001~华夏成长混合~HQ~...^..."
          const list = dataStr.split('^').map(item => {
            const parts = item.split('~');
            if (parts.length < 2) return null;
            return {
              code: parts[0],
              name: parts[1],
              type: '基金', // 腾讯简版不带详细类型
              sector: '综合'
            };
          }).filter(Boolean); // 过滤空值
          resolve(list);
        } else {
          resolve([]); // 没搜到
        }
      };

      script.onerror = () => {
        document.head.removeChild(script);
        reject(new Error("Tencent Search Error"));
      };
      
      document.head.appendChild(script);
    });
  }

  _searchEastMoney(keyword) {
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;
    return jsonp(url, 'FundSearchCallback').then(data => {
      if (data?.Datas) {
        return data.Datas.map(i => ({ 
          code: i.CODE, 
          name: i.NAME, 
          type: '基金', 
          sector: '综合' 
        }));
      }
      return [];
    });
  }

  /**
   * 3. 热门排行榜 (实时池)
   */
  async getHotFunds() {
    // 核心热门池
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
                    nav = parseFloat(p[2]) || 1.0;
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
            results.sort((a,b) => b.changePct - a.changePct);
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

  /**
   * 4. 持仓 (腾讯)
   */
  async getFundHoldings(code) {
    try {
      const codes = await this.fetchPingZhongData(code);
      if (!codes || codes.length === 0) return [];

      const tencentCodes = codes.slice(0, 10).map(c => {
        if (c.length === 5) return `hk${c}`;
        if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`;
        return `sz${c}`;
      }).join(',');

      return await this.fetchTencentStocks(tencentCodes);
    } catch (e) {
      return [];
    }
  }

  fetchPingZhongData(code) {
    return new Promise((resolve) => {
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
            let name = p[1];
            let pct = parseFloat(p[32]);
            results.push({ code: c, name, changePct: pct || 0, weight: 0 });
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