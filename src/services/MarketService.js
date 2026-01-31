/**
 * MarketService V9.1 (Search Fixed)
 * 修复 JSONP 参数拼接 Bug，新增新浪搜索作为三重灾备
 */

const jsonp = (url, callbackName) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // 如果没有提供名字，生成随机名；提供了则使用提供的名字
    const name = callbackName || `jsonp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // [关键修复] 无论 callbackName 是否存在，都要确保 URL 里包含 callback=xxx
    if (url.indexOf('callback=') === -1) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + `callback=${name}`;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout: ${url}`));
    }, 5000);

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      // 只有自动生成的随机回调才清理，固定回调(如FundSearchCallback)保留以防复用
      if (!callbackName) window[name] = undefined; 
      clearTimeout(timeout);
    };

    // 如果是固定回调名，可能已经被定义过，需要防冲突处理或复用
    // 这里简单处理：重新挂载/覆盖 promise resolver
    window[name] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error(`Network Error: ${url}`));
    };
    
    document.head.appendChild(script);
  });
};

export class MarketService {
  
  // --- 1. 实时估值 (腾讯 HTTPS) ---
  getFundRealtime(code) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://qt.gtimg.cn/q=jj${code}`;
      
      script.onload = () => {
        const varName = `v_jj${code}`;
        const dataStr = window[varName];
        document.head.removeChild(script);
        window[varName] = undefined; // 清理
        
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
        if(script.parentNode) document.head.removeChild(script);
        resolve(null);
      };
      
      document.head.appendChild(script);
    });
  }

  // --- 2. 搜索 (三重灾备策略) ---
  async searchFund(keyword) {
    if (!keyword) return [];

    // Plan A: 腾讯 Smartbox
    try {
      const res = await this._searchTencent(keyword);
      if (res.length > 0) return res;
    } catch (e) { /* continue */ }

    // Plan B: 东方财富 FundSuggest (之前失效是因为 jsonp 函数 bug)
    try {
      const res = await this._searchEastMoney(keyword);
      if (res.length > 0) return res;
    } catch (e) { /* continue */ }

    // Plan C: 新浪财经 Suggest (新增)
    try {
      return await this._searchSina(keyword);
    } catch (e) {
      console.error("All search sources failed");
      return [];
    }
  }

  _searchTencent(keyword) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://smartbox.gtimg.cn/s3/?t=fund&q=${encodeURIComponent(keyword)}`;
      
      script.onload = () => {
        const dataStr = window.v_hint;
        document.head.removeChild(script);
        window.v_hint = undefined; // 清理

        if (dataStr) {
          const list = dataStr.split('^').map(item => {
            const parts = item.split('~');
            if (parts.length < 2) return null;
            return { code: parts[0], name: parts[1], type: '基金', sector: '综合' };
          }).filter(Boolean);
          resolve(list);
        } else {
          resolve([]); 
        }
      };
      script.onerror = () => { 
        if(script.parentNode) document.head.removeChild(script); 
        reject(); 
      };
      document.head.appendChild(script);
    });
  }

  _searchEastMoney(keyword) {
    // 关键：URL 里不要自己带 callback，让 jsonp 函数去加
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;
    // 指定回调名 FundSearchCallback，因为该接口不支持随机回调名
    return jsonp(url, 'FundSearchCallback').then(data => {
      if (data?.Datas) {
        return data.Datas.map(i => ({ code: i.CODE, name: i.NAME, type: '基金', sector: '综合' }));
      }
      return [];
    });
  }

  _searchSina(keyword) {
    return new Promise((resolve, reject) => {
      const varName = `sug_fund_${Date.now()}`;
      const script = document.createElement('script');
      // type=11 代表基金
      script.src = `https://suggest3.sinajs.cn/suggest/type=11&key=${encodeURIComponent(keyword)}&name=${varName}`;
      script.charset = 'gb2312'; // 新浪必需

      script.onload = () => {
        const str = window[varName];
        document.head.removeChild(script);
        window[varName] = undefined;

        if (str) {
          // 格式: "代码1,名称1,拼音1...;代码2,名称2,..."
          const items = str.split(';');
          const list = items.map(item => {
            const parts = item.split(',');
            if (parts.length < 4) return null;
            return { code: parts[2], name: parts[4], type: '基金', sector: '综合' };
          }).filter(Boolean);
          resolve(list);
        } else {
          resolve([]);
        }
      };
      script.onerror = () => {
        if(script.parentNode) document.head.removeChild(script); 
        reject();
      };
      document.head.appendChild(script);
    });
  }

  // --- 3. 热门排行榜 (Tencent Pool) ---
  async getHotFunds() {
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
            if(script.parentNode) document.head.removeChild(script);
            resolve([]); 
        };
        document.head.appendChild(script);
    });
  }

  // --- 4. 持仓 (Tencent) ---
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
        if(script.parentNode) document.head.removeChild(script);
        resolve([]);
      };
      document.head.appendChild(script);
    });
  }
}

export const marketService = new MarketService();
