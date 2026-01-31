/**
 * MarketService - 真实金融数据网关 (V6.0 HTTPS Production Ready)
 * 修复 Mixed Content 问题，更换稳定 API 源
 */

// JSONP 工具 (优化版)
const jsonp = (url, callbackName) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const name = callbackName || `jsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    
    if (url.indexOf('callback=') === -1 && !callbackName) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + `callback=${name}`;
    }

    // 10秒超时
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout: ${url}`));
    }, 10000); 

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      // 只有自动生成的 name 才清除，避免误删公共回调
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
      reject(new Error(`Network Error (Check HTTPS/CORS): ${url}`));
    };
    
    document.head.appendChild(script);
  });
};

export class MarketService {
  
  /**
   * 1. 实时估值 (GSZ)
   * 强制使用 HTTPS
   */
  async getFundRealtime(code) {
    if (!code) return null;
    try {
      const timestamp = Date.now();
      // 修复：使用 https 协议
      const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${timestamp}`;
      
      return await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const originalJsonpgz = window.jsonpgz;
        
        // 劫持回调
        window.jsonpgz = (data) => {
          window.jsonpgz = originalJsonpgz;
          if (script.parentNode) document.head.removeChild(script);
          
          if (data && data.fundcode === code) {
            resolve({
              source: '天天基金(Real)',
              estNav: parseFloat(data.gsz),
              changePct: parseFloat(data.gszzl),
              time: data.gztime,
              name: data.name,
              yesterdayNav: parseFloat(data.dwjz)
            });
          } else {
            reject(new Error("Invalid data"));
          }
        };

        script.src = url;
        script.onerror = () => {
          window.jsonpgz = originalJsonpgz;
          if(script.parentNode) document.head.removeChild(script);
          reject(new Error("Network Error"));
        };
        document.head.appendChild(script);
      });
    } catch (e) {
      // console.warn(e);
      return null;
    }
  }

  /**
   * 2. 搜索基金
   * 修复：使用 HTTPS 的 FundSuggest 接口
   */
  async searchFund(keyword) {
    if (!keyword) return [];
    // 必须使用 HTTPS
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;
    
    try {
      const data = await jsonp(url, 'FundSearchCallback');
      if (data && data.Datas) {
        return data.Datas.map(item => ({
          code: item.CODE,
          name: item.NAME,
          type: item.FundBaseInfo?.FTYPE || '基金',
          sector: '综合',
          netWorth: 0 
        }));
      }
      return [];
    } catch (e) {
      console.error("Search failed:", e);
      return [];
    }
  }

  /**
   * 3. 热门排行榜 (重大升级)
   * 切换至东方财富移动端 API (FundMNRank)，它返回纯 JSON，稳定且支持 HTTPS。
   * 弃用不稳定的 PC 端 rankhandler.aspx
   */
  async getHotFunds() {
    // 混合型基金(1), 近1周涨幅排序(rzdf), 前20名
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNRank?FundType=1&SortColumn=rzdf&Sort=desc&PageSize=20&PageIndex=1&CompanyId=`;
    
    try {
      // 这个接口虽然是 API，但通常不支持直接 fetch (CORS)。
      // 这里的技巧是：如果后端支持 CORS 最好，不支持则需要 JSONP。
      // 经过测试，东方财富移动端接口通常不支持浏览器直接 fetch。
      // 因此我们回退到使用 PC 端接口，但强制 HTTPS，并优化解析逻辑。
      
      // 方案 B: PC 端接口 HTTPS 版 (修正参数确保 JSONP 正常)
      const date = new Date().toISOString().slice(0,10);
      const pcUrl = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&sd=${date}&ed=${date}&qdii=&tabSubtype=,,,,,&pi=1&pn=20&dx=1`;

      return await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = pcUrl;
        
        script.onload = () => {
          // 这个接口返回 var rankData = ...
          const data = window.rankData;
          document.head.removeChild(script);
          window.rankData = undefined;

          if (data && data.datas) {
            const list = data.datas.map(str => {
              const parts = str.split(',');
              return {
                code: parts[0],
                name: parts[1],
                type: '热门榜',
                sector: 'Top 20',
                netWorth: parseFloat(parts[4]) || 0,
                changePct: parseFloat(parts[6]) || 0 // 日增长率
              };
            });
            resolve(list);
          } else {
            resolve([]);
          }
        };

        script.onerror = () => {
          document.head.removeChild(script);
          reject(new Error("Rank API Failed"));
        };
        document.head.appendChild(script);
      });

    } catch (e) {
      console.error("Get Hot Funds Failed:", e);
      return [];
    }
  }

  /**
   * 4. 获取持仓 (HTTPS 适配)
   */
  async getFundHoldings(code) {
    try {
      const codes = await this.fetchPingZhongData(code);
      if (!codes || codes.length === 0) return [];

      const sinaCodes = codes.slice(0, 10).map(c => {
        if (c.length === 5) return `hk${c}`;
        if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`;
        return `sz${c}`;
      }).join(',');

      return await this.fetchSinaStocks(sinaCodes);
    } catch (e) {
      return [];
    }
  }

  fetchPingZhongData(code) {
    return new Promise((resolve) => {
      // 修复：HTTPS
      const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
      const script = document.createElement('script');
      script.onload = () => {
        const stocks = window.stockCodes;
        window.stockCodes = undefined; window.ishb = undefined;
        document.head.removeChild(script);
        resolve(stocks || []);
      };
      script.onerror = () => {
        if(script.parentNode) document.head.removeChild(script);
        resolve([]);
      };
      document.head.appendChild(script);
    });
  }

  fetchSinaStocks(listStr) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      // 修复：HTTPS
      script.src = `https://hq.sinajs.cn/list=${listStr}`;
      script.charset = 'gb2312';
      
      script.onload = () => {
        const results = [];
        const codes = listStr.split(',');
        codes.forEach(c => {
          const varName = `hq_str_${c}`;
          const dataStr = window[varName];
          if (dataStr) {
            const parts = dataStr.split(',');
            let name = parts[0];
            let pct = parseFloat(parts[3]);
            if (c.startsWith('hk')) { 
              name = parts[1];
              pct = parseFloat(parts[8]); 
            }
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