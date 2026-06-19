export interface HistoryItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MovingAverages {
  ma5: number;
  ma10: number;
  ma20: number; // 月線
  ma60: number; // 季線
}

export interface StockData {
  id: string; // e.g., "2330"
  name: string; // e.g., "台積電"
  symbol: string; // e.g., "2330.TW"
  price: number; // Current intraday price
  open: number;
  high: number;
  low: number;
  close: number; // Previous close
  volume: number; // Current volume of the day
  avgVolume5d: number; // 5-day average volume
  change: number;
  changePercent: number;
  history: HistoryItem[];
  movingAverages: MovingAverages;
  lastMAUpdateDate: string;
  trendStyle: 'breakout' | 'bullish_trend' | 'consolidating' | 'downtrend' | 'random';
  category: string; // e.g., "半導體", "AI伺服器", "散熱模組", "IC設計"
}

export type AlertType = 'above' | 'below' | 'range' | 'breakout';

export interface StockAlert {
  id: string;
  name: string; // Friendly name
  symbol: string;
  stockName: string;
  type: AlertType;
  targetPrice?: number;
  rangeMin?: number;
  rangeMax?: number;
  isTriggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  notes?: string;
}

export interface AlertLog {
  id: string;
  alertId: string;
  symbol: string;
  stockName: string;
  message: string;
  triggeredPrice: number;
  time: string;
}

export interface MarketAnalysisResponse {
  analysis: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'AVOID';
  riskScore: number; // 1-10
}
