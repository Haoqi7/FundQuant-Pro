/**
 * MarketService - 真实金融数据网关 (V6.0 Multi-Source Fallback)
 * 核心特性：多源灾备、自动降级、拒绝硬编码
 */

// 通用 JSONP 请求工具
const jsonp = (url, callbackName, timeoutTime = 3000) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const name = callbackName || `jsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    
    const hasQuery = url.indexOf('?') !== -1;
    if (url.indexOf('callback=') === -1 && !callbackName) {
        url += (hasQuery ? '&' : '?') + `callback=${name}`;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout (${timeoutTime}ms): ${url}`));
    }, timeoutTime); 

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (!callbackName) window[name] = undefined; 
      clearTimeout(timeout);
    };

    if (!window[name]) {
        window[name] = (data) => {
          cleanup();
          resolve(data);
        };
    }

    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error(`Network Error: ${url}`));
    };
    
    document.head.appendChild(script);
  });
};

export class MarketService {
  
  /**
   * 通用灾备执行器
   * @param {Array} sources - 接口源列表 [{ name, fn }, ...]
   */
  async fetchWithFallback(sources) {
    let lastError = null;
    for (const source of sources) {
      try {
        // console.log(`[Market] Trying ${source.name}...`);
        const result = await source.fn();
        if (result) return result;
      } catch (e) {
        // console.warn(`[Market] Source ${source.name} failed:`, e.message);
        lastError = e;
      }
    }
    // 所有源都失败，返回 null，由上层处理错误展示
    throw lastError || new Error("All sources failed");
  }

  // --- 1. 实时估值接口 (Realtime Quote) ---

  async getFundRealtime(code) {
    if (!code || code.length < 6) return null;
    const timestamp = Date.now();

    const sources = [
      {
        name: 'Primary (EastMoney GSZ)',
        fn: () => this._fetchEastMoneyGSZ(code, timestamp)
      },
      {
        name: 'Backup (Sina HQ)',
        fn: () => this._fetchSinaHQ(code)
      },
      {
        name: 'Fallback (Tencent QT)',
        fn: () => this._fetchTencentQT(code)
      }
    ];

    try {
      return await this.fetchWithFallback(sources);
    } catch (e) {
      return null; // 返回空，触发 UI 显示 "数据源异常" 或切换 AI 模式
    }
  }

  _fetchEastMoneyGSZ(code, time) {
    return new Promise((resolve, reject) => {
      const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${time}`;
      const originalJsonpgz = window.jsonpgz;
      const script = document.createElement('script');
      
      window.jsonpgz = (data) => {
        window.jsonpgz = originalJsonpgz;
        if(script.parentNode) document.head.removeChild(script);
        if (data && data.fundcode === code) {
          resolve({
            source: '天天基金',
            estNav: parseFloat(data.gsz),
            changePct: parseFloat(data.gszzl),
            time: data.gztime,
            name: data.name
          });
        } else {
          reject(new Error("Invalid data"));
        }
      };
      script.src = url;
      script.onerror = () => {
        window.jsonpgz = originalJsonpgz;
        if(script.parentNode) document.head.removeChild(script);
        reject(new Error("Network"));
      };
      document.head.appendChild(script);
    });
  }

  _fetchSinaHQ(code) {
    return new Promise((resolve, reject) => {
      const varName = `hq_str_f_${code}`;
      const script = document.createElement('script');
      script.src = `https://hq.sinajs.cn/list=f_${code}`;
      script.onload = () => {
        const str = window[varName];
        document.head.removeChild(script);
        if (str) {
          const p = str.split(',');
          const nav = parseFloat(p[1]);
          const yes = parseFloat(p[3]);
          const pct = yes > 0 ? ((nav - yes)/yes)*100 : 0;
          resolve({ source: '新浪财经', estNav: nav, changePct: pct, time: p[4], name: p[0] });
        } else reject(new Error("Empty"));
      };
      script.onerror = () => { document.head.removeChild(script); reject(new Error("Net")); };
      document.head.appendChild(script);
    });
  }

  _fetchTencentQT(code) {
    return new Promise((resolve, reject) => {
      const varName = `v_jj${code}`;
      const script = document.createElement('script');
      script.src = `http://qt.gtimg.cn/q=jj${code}`;
      script.onload = () => {
        const str = window[varName];
        document.head.removeChild(script);
        if (str) {
          const p = str.split('~');
          const nav = parseFloat(p[2]);
          const yes = parseFloat(p[4]);
          const pct = yes > 0 ? ((nav - yes)/yes)*100 : 0;
          resolve({ source: '腾讯证券', estNav: nav, changePct: pct, time: p[13], name: p[1] });
        } else reject(new Error("Empty"));
      };
      script.onerror = () => { document.head.removeChild(script); reject(new Error("Net")); };
      document.head.appendChild(script);
    });
  }

  // --- 2. 搜索接口 (Search) ---

  async searchFund(keyword) {
    const sources = [
      {
        name: 'EastMoney FundSuggest',
        fn: () => jsonp(`https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`, 'FundSearchCallback')
      },
      {
        name: 'EastMoney M-Site', // 备用：移动端接口
        fn: () => jsonp(`https://m.1234567.com.cn/data/FundSearch?key=${encodeURIComponent(keyword)}&count=20`, null)
      }
    ];

    try {
      const data = await this.fetchWithFallback(sources);
      // 适配不同接口的返回格式
      if (data.Datas) return data.Datas.map(i => ({ code: i.CODE, name: i.NAME, type: '基金', sector: '综合' }));
      if (data.list) return data.list.map(i => ({ code: i.code, name: i.name, type: '基金', sector: '综合' }));
      return [];
    } catch (e) {
      console.error("Search failed:", e);
      return [];
    }
  }

  // --- 3. 排行榜接口 (Rank) ---

  async getHotFunds() {
    const date = new Date().toISOString().slice(0,10);
    const sources = [
      {
        name: 'EastMoney Rank',
        fn: () => this._fetchRankRaw(`https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&sd=${date}&ed=${date}&pi=1&pn=20&dx=1`)
      }
      // 可以添加更多排行榜源，如新浪排行的 JSONP
    ];

    try {
      return await this.fetchWithFallback(sources);
    } catch (e) {
      return []; // 失败返回空，前端显示重试
    }
  }

  _fetchRankRaw(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        const data = window.rankData;
        document.head.removeChild(script);
        window.rankData = undefined;
        if (data && data.datas) {
          resolve(data.datas.map(s => {
            const p = s.split(',');
            return { code: p[0], name: p[1], type: '热门榜', netWorth: parseFloat(p[4])||0 };
          }));
        } else reject(new Error("No data"));
      };
      script.onerror = () => {
        document.head.removeChild(script);
        reject(new Error("Net"));
      };
      document.head.appendChild(script);
    });
  }

  // --- 4. 持仓接口 (Holdings) ---
  async getFundHoldings(code) {
     // 这里保持原有的逻辑，因为它本身已经有 fetchPingZhongData -> fetchSinaStocks 的流程
     // 暂不加额外备份，因为持仓数据源比较单一
     try {
       const codes = await this._fetchPingZhongData(code);
       if (!codes.length) return [];
       const sinaCodes = codes.slice(0, 10).map(c => {
         if (c.length === 5) return `hk${c}`;
         if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`;
         return `sz${c}`;
       }).join(',');
       return await this._fetchSinaStocks(sinaCodes);
     } catch (e) {
       return [];
     }
  }

  _fetchPingZhongData(code) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
      script.onload = () => {
        const s = window.stockCodes;
        window.stockCodes = undefined; window.ishb=undefined;
        document.head.removeChild(script);
        resolve(s || []);
      };
      script.onerror = () => { document.head.removeChild(script); resolve([]); };
      document.head.appendChild(script);
    });
  }

  _fetchSinaStocks(list) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://hq.sinajs.cn/list=${list}`;
      script.charset = 'gb2312';
      script.onload = () => {
        const res = [];
        list.split(',').forEach(c => {
          const str = window[`hq_str_${c}`];
          if(str) {
            const p = str.split(',');
            let name = p[0], pct = parseFloat(p[3]);
            if(c.startsWith('hk')) { name = p[1]; pct = parseFloat(p[8]); }
            res.push({ code: c, name, changePct: pct||0 });
          }
        });
        document.head.removeChild(script);
        resolve(res);
      };
      script.onerror = () => { document.head.removeChild(script); resolve([]); };
      document.head.appendChild(script);
    });
  }
}

export const marketService = new MarketService();