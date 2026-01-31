// [Real Data Only] 
// 此文件不再包含任何模拟基金列表。所有数据均来自 MarketService 的实时 API。

// 历史数据生成器 (仅用于图表 UI 占位，因为免费接口不提供历史 K 线)
export const generateHistory = (baseNav, days) => {
  const data = [];
  let nav = parseFloat(baseNav) || 1.0; 
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    nav = nav * (1 + (Math.random() * 0.02 - 0.01)); 
    data.push({ date: date.toISOString().split('T')[0], value: nav });
  }
  return data;
};