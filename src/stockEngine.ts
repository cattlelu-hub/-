import { StockData, HistoryItem, MovingAverages } from './types';

// Helper function to generate date strings
export function getPastDates(days: number): string[] {
  const dates: string[] = [];
  const start = new Date();
  // Adjust starting point to avoid weekends if possible, but regular dates are fine for simulation
  for (let i = days; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    // Format YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// Generate sample historical stock data
export function generateStockHistory(
  symbol: string,
  basePrice: number,
  trendStyle: 'breakout' | 'bullish_trend' | 'consolidating' | 'downtrend' | 'random',
  days = 90
): HistoryItem[] {
  const dates = getPastDates(days);
  const history: HistoryItem[] = [];
  let currentPrice = basePrice;
  
  // We want to simulate price action going back 'days' days.
  // We'll generate daily bars.
  for (let i = 0; i < dates.length; i++) {
    const isToday = i === dates.length - 1;
    let changePct = 0;
    let baseVol = 5000 + Math.random() * 5000;

    // Simulate different archetypes depending on trendStyle
    if (trendStyle === 'bullish_trend') {
      // Steady long-term upward trend
      // Upward bias: 55% chance of going up, 45% chance of going down
      const bias = Math.random() < 0.55 ? 1.0 : -0.9;
      changePct = (Math.random() * 0.025) * bias;
      baseVol *= (1 + Math.random() * 0.4);
    } else if (trendStyle === 'downtrend') {
      // Steady long-term downward trend
      const bias = Math.random() < 0.45 ? 1.0 : -1.0;
      changePct = (Math.random() * 0.025) * bias;
      baseVol *= (0.7 + Math.random() * 0.3);
    } else if (trendStyle === 'consolidating') {
      // Tightly compressing around MA20
      // Sideways narrow channel
      const t = i / dates.length;
      if (t < 0.6) {
        // Initial uptrend
        const bias = Math.random() < 0.53 ? 1.0 : -0.9;
        changePct = (Math.random() * 0.022) * bias;
      } else {
        // Retraced to MA20 and now quiet, narrow range
        // Volatility dries up
        const targetPrice = basePrice * 1.1; // steady around 1.1x entry
        const diff = targetPrice - currentPrice;
        changePct = (diff / currentPrice) * 0.3 + (Math.random() - 0.5) * 0.008;
        baseVol *= 0.5; // low volume
      }
    } else if (trendStyle === 'breakout') {
      // This stock retracted and is breaking out today (or very near today)
      const totalSteps = dates.length;
      const breakoutDayIndex = totalSteps - 1; // today is breakout
      
      if (i < breakoutDayIndex - 12) {
        // Step 1: Uptrend
        changePct = (Math.random() * 0.02) + (Math.random() > 0.45 ? 0.005 : -0.015);
      } else if (i < breakoutDayIndex) {
        // Step 2: Retrace back to月線 & quiet consolidation
        // Move towards a lower level slightly above original base price, low volatility
        const pullTarget = basePrice * 1.05;
        const diff = pullTarget - currentPrice;
        changePct = (diff / currentPrice) * 0.4 + (Math.random() - 0.5) * 0.007;
        baseVol *= 0.4; // Dried up volume during consolidation
      } else if (isToday) {
        // Step 3: Explosive Breakout Today!
        // 漲幅 5% 以上, 爆量 1.5 倍以上
        changePct = 0.052 + Math.random() * 0.03; // 5.2% to 8.2% surge
        baseVol *= 3.2; // 3.2x average volume indicator
      }
    } else {
      // Random walk
      changePct = (Math.random() - 0.5) * 0.03;
    }

    currentPrice = currentPrice * (1 + changePct);
    
    // Add noise to high/low/open
    const open = currentPrice * (1 - (Math.random() - 0.5) * 0.008);
    const high = Math.max(open, currentPrice) * (1 + Math.random() * 0.01);
    const low = Math.min(open, currentPrice) * (1 - Math.random() * 0.01);
    const close = currentPrice;
    const volume = Math.floor(baseVol);

    history.push({
      date: dates[i],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume
    });
  }

  return history;
}

// Compute moving averages on history items
export function calculateMA(history: HistoryItem[], period: number): number {
  if (history.length < period) return 0;
  let sum = 0;
  for (let i = history.length - period; i < history.length; i++) {
    sum += history[i].close;
  }
  return sum / period;
}

export function computeMAsForStock(history: HistoryItem[]): MovingAverages {
  return {
    ma5: parseFloat(calculateMA(history, 5).toFixed(2)),
    ma10: parseFloat(calculateMA(history, 10).toFixed(2)),
    ma20: parseFloat(calculateMA(history, 20).toFixed(2)), // 月線
    ma60: parseFloat(calculateMA(history, 60).toFixed(2))  // 季線
  };
}

// Generate the initial list of simulated stocks
export function generateInitialStocksList(): StockData[] {
  const stockTemplates = [
    { id: "2330", name: "台積電", symbol: "2330.TW", basePrice: 910, trend: "bullish_trend", cat: "半導體" },
    { id: "2317", name: "鴻海", symbol: "2317.TW", basePrice: 175, trend: "breakout", cat: "電子代工" },
    { id: "2454", name: "聯發科", symbol: "2454.TW", basePrice: 1250, trend: "consolidating", cat: "IC設計" },
    { id: "3017", name: "奇鋐", symbol: "3017.TW", basePrice: 620, trend: "breakout", cat: "散熱模組" },
    { id: "2382", name: "廣達", symbol: "2382.TW", basePrice: 310, trend: "downtrend", cat: "AI伺服器" },
    { id: "3231", name: "緯創", symbol: "3231.TW", basePrice: 110, trend: "bullish_trend", cat: "AI伺服器" },
    { id: "3037", name: "欣興", symbol: "3037.TW", basePrice: 165, trend: "breakout", cat: "ABF載板" },
    { id: "3025", name: "星通", symbol: "3025.TW", basePrice: 78, trend: "consolidating", cat: "光通訊" },
    { id: "2308", name: "台達電", symbol: "2308.TW", basePrice: 360, trend: "random", cat: "電源供應器" },
    { id: "3661", name: "世芯-KY", symbol: "3661.TW", basePrice: 2200, trend: "consolidating", cat: "矽智財" }
  ];

  const stocks: StockData[] = stockTemplates.map(t => {
    // Generate historical data
    const history = generateStockHistory(t.id, t.basePrice, t.trend as any);
    const movingAverages = computeMAsForStock(history);
    
    // Last history bar contains yesterday/previous info
    const todayBar = history[history.length - 1];
    const prevBar = history[history.length - 2] || todayBar;
    
    // Calculate 5-day average volume BEFORE today
    const past5BarsForVol = history.slice(history.length - 6, history.length - 1);
    const sumVol = past5BarsForVol.reduce((acc, bar) => acc + bar.volume, 0);
    const avgVol5d = past5BarsForVol.length > 0 ? Math.floor(sumVol / past5BarsForVol.length) : 10000;
    
    const price = todayBar.close;
    const change = parseFloat((price - prevBar.close).toFixed(2));
    const changePercent = parseFloat(((change / prevBar.close) * 100).toFixed(2));

    return {
      id: t.id,
      name: t.name,
      symbol: t.symbol,
      price: price,
      open: todayBar.open,
      high: todayBar.high,
      low: todayBar.low,
      close: prevBar.close,
      volume: todayBar.volume,
      avgVolume5d: avgVol5d,
      change: change,
      changePercent: changePercent,
      history: history,
      movingAverages: movingAverages,
      lastMAUpdateDate: todayBar.date,
      trendStyle: t.trend as any,
      category: t.cat
    };
  });

  return stocks;
}

// Evaluate screening criteria
export interface FilterResult {
  isLongTermBull: boolean; // 長期多頭趨勢 (Close > MA60, and MA60 slope is up - currently higher than 5 days ago)
  isBullishArrangement: boolean; // 近期均線多頭排列 (MA5 > MA10 > MA20)
  hasRetracedToMA20: boolean; // 曾壓回月均線：在過去 2 到 15 天內，每日最低價曾與 MA20 很接近或穿過（距離在 2% 以內）
  hasConsolidated: boolean; // 經過時間整理沉澱：在過去 10 天內，收盤價與 MA20 平均距離不大，且成交量呈萎縮趨勢
  isPriceJumpToday: boolean; // 今天漲幅 5% 以上
  isVolumeExplodeToday: boolean; // 今日成交量 >= 5均量 的 1.5 倍以上
  isBreakoutToday: boolean; // 突破月線：今日收盤價在月線之上，且（昨日收盤價在月線之下，或今日開盤價在月線之下/附近）
  meetsBreakoutCriteria: boolean; // 曾壓回月均線經過整理沉澱後，以5均量1.5倍漲幅5%以上突破月均線！
}

export function evaluateCriteria(stock: StockData): FilterResult {
  const history = stock.history;
  const mas = stock.movingAverages;
  const close = stock.price;
  const vol = stock.volume;
  const avgVol5d = stock.avgVolume5d;

  // 1. Long-term Bull: Price above MA60, AND MA60 is rising compared to 5 bars ago
  // Let's compute MA60 5 days ago
  let ma60Prev = mas.ma60;
  if (history.length >= 65) {
    const historicalSlice = history.slice(0, history.length - 5);
    ma60Prev = calculateMA(historicalSlice, 60);
  }
  const isLongTermBull = close > mas.ma60 && mas.ma60 >= ma60Prev;

  // 2. Short-term Bullish Arrangement (多頭排列)
  const isBullishArrangement = mas.ma5 > mas.ma10 && mas.ma10 > mas.ma20;

  // 3. 曾壓回月均線：在過去 3 到 15 天內（不含今天），股價最低點曾壓回到月均線附近
  // 我們檢查那段時間的 Low 曾低於月線，或與月線相差小於 1.5%
  let hasRetracedToMA20 = false;
  let hasConsolidated = false;

  if (history.length >= 35) {
    const checkDays = 15;
    let retracedCount = 0;
    let maxDeviationSinceRetrace = 0;
    
    // Track daily MAs to do historical calculation
    for (let offset = 2; offset <= checkDays; offset++) {
      const idx = history.length - offset;
      if (idx < 20) continue;
      
      const slice = history.slice(0, idx + 1);
      const histMA20 = calculateMA(slice, 20);
      const dayLow = history[idx].low;
      const dayHigh = history[idx].high;
      const dayClose = history[idx].close;

      // Check if dayLow was close to or below MA20 (within 1.5%)
      const threshold = histMA20 * 1.015;
      if (dayLow <= threshold) {
        retracedCount++;
      }
      
      // Compute deviation
      const dev = Math.abs(dayClose - histMA20) / histMA20;
      maxDeviationSinceRetrace += dev;
    }
    
    hasRetracedToMA20 = retracedCount >= 1; // 至少有 1 天壓回月線附近
    
    // 整理沉澱：平均偏差小於 4%，說明股價糾纏、波動小
    const avgDev = maxDeviationSinceRetrace / checkDays;
    hasConsolidated = avgDev < 0.04;
  } else {
    // Backup defaults for smaller datasets
    hasRetracedToMA20 = stock.trendStyle === 'breakout' || stock.trendStyle === 'consolidating';
    hasConsolidated = stock.trendStyle === 'breakout' || stock.trendStyle === 'consolidating';
  }

  // 4. Today's triggers
  const isPriceJumpToday = stock.changePercent >= 5.0;
  
  // 今日交易量比 5日均量
  const isVolumeExplodeToday = vol >= avgVol5d * 1.5;

  // Breakout MA20
  // Close > MA20, yesterday close was <= MA20 * 1.015 (or today open <= MA20 * 1.015)
  // Which means we were resting at MA20 and broke out of it.
  const yesterdayClose = stock.close;
  const openPrice = stock.open;
  
  const isBreakoutToday = close > mas.ma20 && 
                          (yesterdayClose <= mas.ma20 * 1.01 || openPrice <= mas.ma20 * 1.01);

  // Meets whole custom breakout criteria!
  // "曾壓回月均線經過時間整理沉澱後，以5均日交易量1.5倍以上漲幅5%突破月均線"
  const meetsBreakoutCriteria = hasRetracedToMA20 && 
                                hasConsolidated && 
                                isVolumeExplodeToday && 
                                isPriceJumpToday && 
                                isBreakoutToday;

  return {
    isLongTermBull,
    isBullishArrangement,
    hasRetracedToMA20,
    hasConsolidated,
    isPriceJumpToday,
    isVolumeExplodeToday,
    isBreakoutToday,
    meetsBreakoutCriteria
  };
}

// Tick Simulation: updates a stock programmatically to simulate active intraday noise or simulated breakouts.
export function simulateStockTick(
  stock: StockData,
  forceBreakout = false
): StockData {
  const updatedHistory = [...stock.history];
  const lastIdx = updatedHistory.length - 1;
  const prevBar = updatedHistory[lastIdx - 1];

  let newPrice = stock.price;
  let newVol = stock.volume;

  if (forceBreakout) {
    // Instantly simulate an explosive breakout!
    // Jump by +5.5% or more
    newPrice = parseFloat((stock.close * (1 + 0.055 + Math.random() * 0.02)).toFixed(2));
    // Surge volume to 2.2x of 5-day average
    newVol = Math.floor(stock.avgVolume5d * (1.6 + Math.random() * 1.2));
  } else {
    // Normal micro-flaking intraday noise: ±0.1% to ±0.3%
    const scale = (Math.random() - 0.49) * 0.003; // slightly upwards
    newPrice = parseFloat((stock.price * (1 + scale)).toFixed(2));
    // Add micro volumes
    newVol += Math.floor(Math.random() * 80 + 20);
  }

  // Lock within realistic high/low
  const highPrice = Math.max(stock.high, newPrice);
  const lowPrice = Math.min(stock.low, newPrice);
  const change = parseFloat((newPrice - stock.close).toFixed(2));
  const changePercent = parseFloat(((change / stock.close) * 100).toFixed(2));

  // Update current day's history entry
  updatedHistory[lastIdx] = {
    ...updatedHistory[lastIdx],
    close: newPrice,
    high: highPrice,
    low: lowPrice,
    volume: newVol
  };

  // Re-compute moving averages
  const movingAverages = computeMAsForStock(updatedHistory);

  return {
    ...stock,
    price: newPrice,
    high: highPrice,
    low: lowPrice,
    volume: newVol,
    change: change,
    changePercent: changePercent,
    history: updatedHistory,
    movingAverages: movingAverages
  };
}
