import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Sparkles, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  AlertTriangle,
  CheckCircle2, 
  Search, 
  HelpCircle,
  Clock,
  ArrowUpRight,
  Database,
  BarChart3,
  Calendar,
  X,
  Play,
  Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StockData, StockAlert, AlertLog, AlertType } from "./types";
import { calculateMA } from "./stockEngine";

export default function App() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string>("2317"); // Default to 鴻海
  const [activeFilter, setActiveFilter] = useState<'all' | 'long_bull' | 'bull_align' | 'breakout_ma20'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  
  // Custom Stock Form State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStockId, setNewStockId] = useState("");
  const [newStockName, setNewStockName] = useState("");
  const [newStockCategory, setNewStockCategory] = useState("半導體");
  const [newStockBasePrice, setNewStockBasePrice] = useState("100");
  const [newStockTrend, setNewStockTrend] = useState<'breakout' | 'consolidating' | 'bullish_trend' | 'downtrend' | 'random'>('consolidating');
  const [addStockError, setAddStockError] = useState("");

  // Alert State
  const [alerts, setAlerts] = useState<StockAlert[]>([
    {
      id: "alert-1",
      name: "鴻海大於185",
      symbol: "2317.TW",
      stockName: "鴻海",
      type: "above",
      targetPrice: 185.0,
      isTriggered: false,
      createdAt: new Date().toISOString(),
      notes: "波段支撐之上，突破壓力加碼"
    },
    {
      id: "alert-2",
      name: "奇鋐觸發爆量突破月線",
      symbol: "3017.TW",
      stockName: "奇鋐",
      type: "breakout",
      isTriggered: false,
      createdAt: new Date().toISOString(),
      notes: "月線整理完爆量向上"
    }
  ]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);

  // Sound & Notifications Permission State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  // Alert Setting Form State
  const [alertType, setAlertType] = useState<AlertType>("above");
  const [alertTargetPrice, setAlertTargetPrice] = useState("");
  const [alertNotes, setAlertNotes] = useState("");

  // AI Analysis State
  const [aiReport, setAiReport] = useState<{ analysis: string; recommendation: string; riskScore: number } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Simulation Status State
  const [isSimulating, setIsSimulating] = useState(true);
  const [simInterval, setSimInterval] = useState(4); // seconds
  const [simTime, setSimTime] = useState("");
  const [hoveredHistoryIndex, setHoveredHistoryIndex] = useState<number | null>(null);

  // Poll intervals
  const pollTimerRef = useRef<any>(null);

  // Sync Notification Permission on load
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
    
    // Set simulated intraday time
    const updateTime = () => {
      const now = new Date();
      // Taiwan market runs from 09:00 to 13:30. Let's calculate a relative market clock based on active time.
      const timeStr = now.toLocaleTimeString("zh-TW", { hour12: false });
      setSimTime(`盤中實時模擬盤 (${timeStr})`);
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch stocks from API
  const fetchStocks = async () => {
    try {
      const response = await fetch("/api/stocks");
      const data = await response.json();
      setStocks(data);
    } catch (e) {
      console.error("Failed to fetch stock list:", e);
    }
  };

  // Poll server for live stock simulation updates
  useEffect(() => {
    fetchStocks();
    if (isSimulating) {
      pollTimerRef.current = setInterval(fetchStocks, 1500); // Poll fast for immediate alert testing
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isSimulating]);

  // Alert Checking Engine (checks price feeds)
  useEffect(() => {
    if (stocks.length === 0) return;

    stocks.forEach((stock) => {
      // Find active alerts for this symbol
      const activeAlerts = alerts.filter(a => !a.isTriggered && a.symbol === stock.symbol);

      activeAlerts.forEach((alert) => {
        let isTriggered = false;
        let msg = "";

        if (alert.type === "above" && alert.targetPrice && stock.price >= alert.targetPrice) {
          isTriggered = true;
          msg = `📈 股價達到指定高點！【${stock.name}】目前價格為 ${stock.price} 元（漲幅 ${stock.changePercent}%），已突破設定之警示價 ${alert.targetPrice} 元！`;
        } else if (alert.type === "below" && alert.targetPrice && stock.price <= alert.targetPrice) {
          isTriggered = true;
          msg = `📉 股價跌破指定低點！【${stock.name}】目前價格為 ${stock.price} 元（跌幅 ${stock.changePercent}%），已低於設定之警示價 ${alert.targetPrice} 元！`;
        } else if (alert.type === "breakout" && stock.signals?.meetsBreakoutCriteria) {
          isTriggered = true;
          msg = `🔥 爆量大漲訊號突破！【${stock.name}】今日大漲 ${stock.changePercent}%，成交量達 ${stock.volume} 張（超過5日均量 1.5 倍），成功在月線整理沉澱後爆量突破！`;
        }

        if (isTriggered) {
          // Play notification
          triggerAlertOutputs(alert, stock, msg);
        }
      });
    });
  }, [stocks, alerts]);

  // Trigger Alert sound, notification and logs
  const triggerAlertOutputs = (alert: StockAlert, stock: StockData, message: string) => {
    // 1. Mark alert as triggered locally
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, isTriggered: true, triggeredAt: new Date().toLocaleTimeString() } : a));

    // 2. Add to Alert History Logs
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newLog: AlertLog = {
      id: logId,
      alertId: alert.id,
      symbol: stock.symbol,
      stockName: stock.name,
      message: message,
      triggeredPrice: stock.price,
      time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    setAlertLogs(prev => [newLog, ...prev]);

    // 3. Play audio chime
    if (soundEnabled) {
      playAlertAudio();
    }

    // 4. Browser Native Notification
    if (Notification.permission === "granted") {
      try {
        new Notification(`【股價提醒觸發】${stock.name} (${stock.id})`, {
          body: message,
          icon: "/assets/favicon.ico",
          tag: alert.id
        });
      } catch (err) {
        console.warn("Could not dispatch notification inside iframe:", err);
      }
    }
  };

  // Synthesis Alert Chime via AudioContext
  const playAlertAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Dual tone chirp for clean financial notification sound (E5 and G5)
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35); // ramp up
      
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5 
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.35);
      
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn("AudioContext failed to execute. User interaction might be required.", e);
    }
  };

  // Request Notification Permissions
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("此瀏覽器不支援 Web Notifications。");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (e) {
      console.warn("Iframe blocked notification request:", e);
    }
  };

  // Add custom Alert Config
  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const currentStock = stocks.find(s => s.id === selectedStockId);
    if (!currentStock) return;

    let targetPriceNum: number | undefined = undefined;
    if (alertType !== "breakout") {
      targetPriceNum = parseFloat(alertTargetPrice);
      if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
        alert("請輸入有效的警示價格目標。");
        return;
      }
    }

    const typeLabels = {
      above: "大於等於",
      below: "小於等於",
      range: "價格區間",
      breakout: "爆量突破月線"
    };

    const newAlert: StockAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: `${currentStock.name} ${typeLabels[alertType]} ${alertType === "breakout" ? "突破" : targetPriceNum + "元"}`,
      symbol: currentStock.symbol,
      stockName: currentStock.name,
      type: alertType,
      targetPrice: targetPriceNum,
      isTriggered: false,
      createdAt: new Date().toISOString(),
      notes: alertNotes || "無備註"
    };

    setAlerts(prev => [newAlert, ...prev]);
    setAlertTargetPrice("");
    setAlertNotes("");
  };

  // Delete an alert
  const handleDeleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Delete alert logs
  const handleClearLogs = () => {
    setAlertLogs([]);
  };

  // Force Breakout on Current Selected Stock via backend simulator
  const handleSimulateBreakout = async (stockId: string) => {
    try {
      const resp = await fetch("/api/stocks/simulate-breakout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stockId })
      });
      const data = await resp.json();
      if (data.success) {
        // Fetch fresh stocks list instantly
        await fetchStocks();
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  };

  // Add a new stock via API
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStockError("");

    if (!newStockId || !newStockName || !newStockBasePrice) {
      setAddStockError("請填寫所有欄位。");
      return;
    }

    const price = parseFloat(newStockBasePrice);
    if (isNaN(price) || price <= 0) {
      setAddStockError("啟始股價必須為大於0的數字。");
      return;
    }

    try {
      const resp = await fetch("/api/stocks/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newStockId.trim(),
          name: newStockName.trim(),
          category: newStockCategory,
          trendStyle: newStockTrend,
          basePrice: price
        })
      });

      const res = await resp.json();
      if (!resp.ok) {
        setAddStockError(res.error || "新增失敗。");
        return;
      }

      // Success
      await fetchStocks();
      setSelectedStockId(res.stock.id);
      setShowAddStockModal(false);
      
      // Reset form
      setNewStockId("");
      setNewStockName("");
      setNewStockBasePrice("100");
      setNewStockCategory("半導體");
    } catch (e: any) {
      setAddStockError("無法連接至後端服務: " + e.message);
    }
  };

  // Query AI Strategist analysis
  const handleRequestAiAnalysis = async (symbol: string) => {
    setIsAiLoading(true);
    setAiError("");
    setAiReport(null);

    try {
      const resp = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAiError(data.error || "無法生成 AI 分析");
        return;
      }
      setAiReport(data);
    } catch (err: any) {
      setAiError("伺服器連線異常: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Switch current stock and fetch its AI info
  const handleSelectStock = (stockId: string) => {
    setSelectedStockId(stockId);
    setAiReport(null);
    setAiError("");
  };

  const selectedStock = stocks.find(s => s.id === selectedStockId);

  // Group and search filters
  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.name.includes(searchQuery) || stock.id.includes(searchQuery);
    if (!matchesSearch) return false;

    if (activeFilter === "long_bull") {
      return stock.signals?.isLongTermBull;
    }
    if (activeFilter === "bull_align") {
      return stock.signals?.isBullishArrangement;
    }
    if (activeFilter === "breakout_ma20") {
      return stock.signals?.meetsBreakoutCriteria;
    }
    return true;
  });

  return (
    <div id="app-root" className="min-h-screen bg-[#05070A] text-slate-300 font-sans selection:bg-blue-900 selection:text-white pb-12">
      
      {/* HEADER BAR */}
      <header id="app-header" className="sticky top-0 z-40 bg-[#080B11]/90 border-b border-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                策略監控看板
                <span className="text-[10px] text-slate-500 font-normal">STRATEGY MONITOR v2.4</span>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Market Open</span>
                </div>
              </h1>
              <p className="text-xs text-slate-400 font-medium font-sans">量價與多重均線排列・壓回月線突破偵測器</p>
            </div>
          </div>

          {/* Ticker simulation info */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-xs font-semibold text-slate-300 border border-white/5">
              <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span className="font-mono">{simTime}</span>
            </div>

            {/* Notification Permission toggle */}
            <button
              onClick={requestNotificationPermission}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                notificationPermission === "granted"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-[#141A26] text-slate-300 border-white/5 hover:bg-white/5"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{notificationPermission === "granted" ? "已開啟通知" : "允許桌面推播"}</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-[#141A26] border border-white/5 text-slate-300 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
              title={soundEnabled ? "關閉提示音" : "開啟提示音"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Simulator Toggle */}
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isSimulating 
                  ? "bg-blue-600 hover:bg-blue-500 text-white border-transparent" 
                  : "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              <span>{isSimulating ? "盤中更新中" : "暫停更新"}</span>
            </button>
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: STOCK LIST & FILTERS (col-span-4) */}
          <section id="sidebar" className="lg:col-span-4 space-y-6">
            
            {/* STOCKS BOARD & SEARCH */}
            <div className="bg-[#0F141E] rounded-2xl border border-white/5 p-4 shadow-xl">
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-white tracking-wide">個股篩選看板</span>
                <button
                  onClick={() => setShowAddStockModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition duration-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增個股
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="搜尋股票代號、名稱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-white/5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 bg-[#05070A] text-slate-100 placeholder:text-slate-600"
                />
              </div>

              {/* Grouping Filters Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-white/5 border border-white/5 rounded-xl mb-4 text-center text-xs font-bold font-sans">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  全部
                </button>
                <button
                  onClick={() => setActiveFilter('long_bull')}
                  className={`py-1.5 rounded-lg transition-all relative cursor-pointer ${activeFilter === 'long_bull' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  長多
                </button>
                <button
                  onClick={() => setActiveFilter('bull_align')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeFilter === 'bull_align' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  多頭排列
                </button>
                <button
                  onClick={() => setActiveFilter('breakout_ma20')}
                  className={`py-1.5 rounded-lg transition-all relative cursor-pointer ${activeFilter === 'breakout_ma20' ? 'bg-amber-600 text-white' : 'text-amber-400 uppercase tracking-wider font-extrabold bg-amber-500/10 border border-amber-500/20'}`}
                >
                  突破
                </button>
              </div>

              {/* Stocks List */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {stocks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">正在下載股價模擬資料...</div>
                ) : filteredStocks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">無符合當前條件的個股</div>
                ) : (
                  filteredStocks.map((stock) => {
                     const isSelected = stock.id === selectedStockId;
                     const changeSymbol = stock.change >= 0 ? "+" : "";
                     const isBreakout = stock.signals?.meetsBreakoutCriteria;
                     const isLongBull = stock.signals?.isLongTermBull;
                     const isBullAlign = stock.signals?.isBullishArrangement;

                     return (
                      <div
                        key={stock.id}
                        onClick={() => handleSelectStock(stock.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-[#161C27] border-blue-500/50 text-white ring-1 ring-blue-500/20 shadow-lg shadow-blue-900/10"
                            : isBreakout
                            ? "bg-amber-500/5 border-amber-500/30 text-slate-300 hover:bg-white/5"
                            : "bg-[#0F141E] border-white/5 text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {/* Signal micro tag row */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400">
                            {stock.category}
                          </span>
                          <div className="flex gap-1">
                            {isBreakout && (
                              <span className="px-1.5 py-0.5 roundedbg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-[9px] animate-pulse">
                                月線突破
                              </span>
                            )}
                            {isLongBull && (
                              <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${isSelected ? 'bg-slate-800 text-slate-300' : 'bg-white/5 text-slate-400'}`}>
                                長多
                              </span>
                            )}
                            {isBullAlign && (
                              <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${isSelected ? 'bg-blue-600/30 text-blue-400 border border-blue-500/35' : 'bg-white/5 text-slate-400'}`}>
                                排列
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Name and Symbol / Today change */}
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-extrabold text-white">{stock.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {stock.id}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-extrabold block font-mono text-white">{stock.price.toFixed(2)}</span>
                            <span
                              className={`text-[11px] font-bold font-mono block ${
                                stock.change >= 0 ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {changeSymbol}
                              {stock.changePercent}%
                            </span>
                          </div>
                        </div>

                        {/* Real-time ticker flash border effect */}
                        {isBreakout && !isSelected && (
                          <div className="absolute inset-0 border-2 border-amber-400/30 rounded-xl pointer-events-none animate-ping opacity-35 duration-1000" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* FILTER EXPLANATION CARD (Educational block) */}
            <div className="bg-[#0F141E] rounded-2xl border border-white/5 p-4 text-slate-300 space-y-3 shadow-xl">
              <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block">篩選邏輯與技術定義</span>
              
              <div className="space-y-3.5 text-xs">
                <div>
                  <h4 className="font-extrabold text-white flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    1. 長期多頭趨勢 (季線上揚)
                  </h4>
                  <p className="text-slate-400 leading-relaxed pl-3 font-sans">
                    股價必須穩健站於 60 日均線（季線）之上，且季線的趨勢走平，或在近期持續呈現向上的多頭坡度。
                  </p>
                </div>

                <div>
                  <h4 className="font-extrabold text-white flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    2. 主均線多頭排列
                  </h4>
                  <p className="text-slate-400 leading-relaxed pl-3 font-sans">
                    近期均線呈現多重排列：<code className="text-blue-400 font-mono">5MA &gt; 10MA &gt; 20MA</code>，說明短中期股價具備極佳的發散向上多頭共識。
                  </p>
                </div>

                <div className="p-2.5 bg-[#05070A] rounded-xl border border-white/5">
                  <h4 className="font-extrabold text-amber-400 flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    3. 月線整理後「爆量強攻」突破
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px] font-sans">
                    在過去 2-15 日內股價曾<strong>拉回（壓回）至 20 均線（月線）附近</strong>經過時間整理，今天以<strong>至少五日均量 1.5 倍以上</strong>的成交量能、<strong>開盤或昨日低於月線</strong>、且<strong>收盤漲幅高於 5.0%</strong> 長紅紅K棒完美發散突破月均線。這是波段起漲突破的最佳切入型態！
                  </p>
                </div>
              </div>
            </div>

          </section>

          {/* RIGHT COLUMN: STOCK DETAIL CHART & ALERTS CONTROL (col-span-8) */}
          <section id="content" className="lg:col-span-8 space-y-6">

            {selectedStock ? (
              <>
                {/* STOCK BASIC METADATA SECTION */}
                <div className="bg-[#0F141E] rounded-2xl border border-white/5 shadow-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-1 bg-white/5 text-slate-300 border border-white/5 rounded-xl font-bold text-xs shadow-inner font-mono">
                        {selectedStock.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black text-white">{selectedStock.name}</h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#161C27] text-xs font-bold text-blue-400 border border-white/5">
                            {selectedStock.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono tracking-wider">{selectedStock.symbol}</p>
                      </div>
                    </div>

                    {/* Price with giant visual indicators */}
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <div className="text-3xl font-black font-mono tracking-tight text-white select-all">
                          {selectedStock.price.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {selectedStock.change >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-rose-400 fill-rose-500/10" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-emerald-400 fill-emerald-500/10" />
                          )}
                          <span className={`text-sm font-black font-mono ${selectedStock.change >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            {selectedStock.change >= 0 ? "+" : ""}{selectedStock.change.toFixed(2)} ({selectedStock.change >= 0 ? "+" : ""}{selectedStock.changePercent}%)
                          </span>
                        </div>
                      </div>

                      {/* FAST SIMULATE BREAKOUT BUTTON FOR USER VERIFICATION */}
                      <button
                        onClick={() => handleSimulateBreakout(selectedStock.id)}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-blue-500/20 hover:scale-103 transition-all duration-300 cursor-pointer"
                        title="立即將此股注入爆大成交量與巨大拉抬幅度，觸發「爆量長紅 breakout」訊號！"
                      >
                        <BarChart3 className="w-4 h-4 animate-bounce" />
                        模擬爆量突破!
                      </button>
                    </div>
                  </div>

                  {/* Grid fields for OHLC, Volumes & moving average variables */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-3 border-t border-white/5">
                    <div className="p-2.5 bg-[#05070A] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider mb-0.5">開盤價</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{selectedStock.open.toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-[#05070A] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider mb-0.5">最高價</span>
                      <span className="text-sm font-bold font-mono text-rose-400">{selectedStock.high.toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-[#05070A] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider mb-0.5">最低價</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{selectedStock.low.toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-[#05070A] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider mb-0.5">昨日收盤</span>
                      <span className="text-sm font-bold font-mono text-slate-400">{selectedStock.close.toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 bg-blue-500/5 border border-blue-500/25 rounded-xl text-center animate-pulse">
                      <span className="text-[10px] text-blue-400 font-extrabold block uppercase tracking-wider mb-0.5">今日量 (張)</span>
                      <span className="text-sm font-black font-mono text-blue-300">{selectedStock.volume}</span>
                    </div>
                    <div className="p-2.5 bg-[#05070A] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider mb-0.5">5日均量 (張)</span>
                      <span className="text-sm font-bold font-mono text-slate-300">{selectedStock.avgVolume5d}</span>
                    </div>
                  </div>

                  {/* HIGH FIDELITY CANDLESTICK CHART IN SVG */}
                  <div className="bg-slate-950 rounded-2xl p-4 text-white relative border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                        技術K線與多重均線形態 (近 35 日區間)
                      </span>
                      <div className="flex gap-3 text-[10px] font-bold">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-amber-400 block" /> 5MA: {selectedStock.movingAverages.ma5}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-fuchsia-400 block" /> 10MA: {selectedStock.movingAverages.ma10}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-blue-400 block" /> 20MA (月線): {selectedStock.movingAverages.ma20}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-neutral-400 block" /> 60MA (季線): {selectedStock.movingAverages.ma60}
                        </span>
                      </div>
                    </div>

                    {/* SVG Chart area */}
                    <div className="h-64 relative w-full pt-2">
                      {selectedStock.history && selectedStock.history.length > 0 ? (
                        (() => {
                          const limit = 35; // Showing final 35 days
                          const rawHistory = selectedStock.history;
                          const sliceOfHistory = rawHistory.slice(rawHistory.length - limit);
                          
                          // Calculate minimum/maximum values of price & MAs on this slice for proper bounding
                          const pricesInSlice = sliceOfHistory.flatMap(h => [h.high, h.low, h.open, h.close]);
                          // Adding the MAs on this slice to look up min/max bounds
                          const masInSlice: number[] = [];
                          for (let i = rawHistory.length - limit; i < rawHistory.length; i++) {
                            const prevSlice = rawHistory.slice(0, i + 1);
                            masInSlice.push(
                              calculateMA(prevSlice, 5),
                              calculateMA(prevSlice, 10),
                              calculateMA(prevSlice, 20),
                              calculateMA(prevSlice, 60)
                            );
                          }
                          const allVals = pricesInSlice.concat(masInSlice.filter(v => v > 0));
                          const maxPrice = Math.max(...allVals) * 1.02;
                          const minPrice = Math.min(...allVals) * 0.98;
                          const priceRange = maxPrice - minPrice;

                          // Dimensions
                          const width = 600;
                          const height = 240;
                          const paddingRight = 45;
                          const chartWidth = width - paddingRight;
                          const chartHeight = 180;
                          
                          const candleWidth = (chartWidth / limit) * 0.65;
                          const spacing = chartWidth / limit;

                          // Compute coordinates for Candlesticks & lines
                          const getX = (index: number) => index * spacing + spacing / 2;
                          const getY = (val: number) => chartHeight - ((val - minPrice) / priceRange) * chartHeight;

                          // Pre-render curves for MA5, 10, 20, 60
                          const maPts = { ma5: [] as string[], ma10: [] as string[], ma20: [] as string[], ma60: [] as string[] };
                          sliceOfHistory.forEach((_, i) => {
                            const absoluteIndex = rawHistory.length - limit + i;
                            const prevSlice = rawHistory.slice(0, absoluteIndex + 1);
                            
                            const ma5Val = calculateMA(prevSlice, 5);
                            const ma10Val = calculateMA(prevSlice, 10);
                            const ma20Val = calculateMA(prevSlice, 20);
                            const ma60Val = calculateMA(prevSlice, 60);

                            const cx = getX(i);
                            if (ma5Val > 0) maPts.ma5.push(`${cx},${getY(ma5Val)}`);
                            if (ma10Val > 0) maPts.ma10.push(`${cx},${getY(ma10Val)}`);
                            if (ma20Val > 0) maPts.ma20.push(`${cx},${getY(ma20Val)}`);
                            if (ma60Val > 0) maPts.ma60.push(`${cx},${getY(ma60Val)}`);
                          });

                          return (
                            <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                              {/* Horizontal Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, index) => {
                                const val = maxPrice - ratio * priceRange;
                                const vy = ratio * chartHeight;
                                return (
                                  <g key={index}>
                                    <line
                                      x1="0"
                                      y1={vy}
                                      x2={chartWidth}
                                      y2={vy}
                                      className="stroke-slate-900 border-dashed"
                                      strokeWidth="0.5"
                                      strokeDasharray="4 4"
                                    />
                                    <text
                                      x={chartWidth + 5}
                                      y={vy + 4}
                                      className="fill-slate-500 font-mono text-[9px] text-right font-medium"
                                    >
                                      {val.toFixed(0)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Volume Area (drawn as small bars at the bottom) */}
                              {(() => {
                                const volsInSlice = sliceOfHistory.map(h => h.volume);
                                const maxVol = Math.max(...volsInSlice) * 1.5;
                                return sliceOfHistory.map((item, idx) => {
                                  const cx = getX(idx);
                                  const barHeight = (item.volume / maxVol) * 45; // Max 45px volume bars
                                  const vy = chartHeight + 10;
                                  const isUp = item.close >= item.open;
                                  return (
                                    <rect
                                      key={`vol-${idx}`}
                                      x={cx - candleWidth / 2}
                                      y={vy + (45 - barHeight)}
                                      width={candleWidth}
                                      height={barHeight}
                                      className={isUp ? "fill-red-500/35" : "fill-green-500/35"}
                                    />
                                  );
                                });
                              })()}

                              {/* Candlesticks (body & wicks) */}
                              {sliceOfHistory.map((item, idx) => {
                                const cx = getX(idx);
                                const yOpen = getY(item.open);
                                const yClose = getY(item.close);
                                const yHigh = getY(item.high);
                                const yLow = getY(item.low);

                                const isUp = item.close >= item.open;
                                const rectY = isUp ? yClose : yOpen;
                                const rectHeight = Math.max(1.5, Math.abs(yClose - yOpen));

                                return (
                                  <g 
                                    key={idx} 
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredHistoryIndex(rawHistory.length - limit + idx)}
                                    onMouseLeave={() => setHoveredHistoryIndex(null)}
                                  >
                                    {/* Wick lines */}
                                    <line
                                      x1={cx}
                                      y1={yHigh}
                                      x2={cx}
                                      y2={yLow}
                                      className={isUp ? "stroke-red-500" : "stroke-green-500"}
                                      strokeWidth="1.2"
                                    />
                                    {/* Candle Body */}
                                    <rect
                                      x={cx - candleWidth / 2}
                                      y={rectY}
                                      width={candleWidth}
                                      height={rectHeight}
                                      className={isUp ? "fill-red-500 stroke-red-500" : "fill-green-600 stroke-green-600"}
                                      strokeWidth="0.5"
                                    />
                                  </g>
                                );
                              })}

                              {/* MA Lines */}
                              {maPts.ma5.length > 0 && <polyline fill="none" className="stroke-amber-400" strokeWidth="1.2" points={maPts.ma5.join(" ")} />}
                              {maPts.ma10.length > 0 && <polyline fill="none" className="stroke-fuchsia-400" strokeWidth="1.2" points={maPts.ma10.join(" ")} />}
                              {maPts.ma20.length > 0 && <polyline fill="none" className="stroke-blue-400" strokeWidth="1.8" points={maPts.ma20.join(" ")} />}
                              {maPts.ma60.length > 0 && <polyline fill="none" className="stroke-slate-500" strokeWidth="1.2" points={maPts.ma60.join(" ")} />}
                            </svg>
                          );
                        })()
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                          圖表資料加載中...
                        </div>
                      )}
                    </div>

                    {/* Candlestick dynamic tooltip values display on hover */}
                    <div className="h-9 px-2 bg-slate-900 rounded-lg flex items-center justify-between text-[11px] font-mono font-semibold border border-slate-800">
                      {hoveredHistoryIndex !== null && selectedStock.history[hoveredHistoryIndex] ? (
                        (() => {
                          const node = selectedStock.history[hoveredHistoryIndex];
                          const change = node.close - (selectedStock.history[hoveredHistoryIndex - 1]?.close || node.open);
                          const pct = (change / (selectedStock.history[hoveredHistoryIndex - 1]?.close || node.open)) * 100;

                          return (
                            <>
                              <span className="text-slate-400"><Calendar className="w-3 h-3 inline mr-1 text-slate-500" />{node.date}</span>
                              <span>開盤: <strong className="text-slate-200">{node.open}</strong></span>
                              <span>最高: <strong className="text-red-400">{node.high}</strong></span>
                              <span>最低: <strong className="text-green-400">{node.low}</strong></span>
                              <span>收盤: <strong className="text-slate-200">{node.close}</strong></span>
                              <span>
                                漲跌:{" "}
                                <strong className={change >= 0 ? "text-red-400" : "text-green-400"}>
                                  {change >= 0 ? "+" : ""}{change.toFixed(1)} ({change >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                                </strong>
                              </span>
                              <span>量: <strong className="text-teal-300">{node.volume}張</strong></span>
                            </>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500 w-full text-center">💡 滑鼠移動至單個 K 線柱體，即可查詢該日歷史詳細資料</span>
                      )}
                    </div>

                  </div>

                  {/* ACTIVE CRITERIA VERIFICATION CHECKS */}
                  <div className="p-4 bg-[#05070A] rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-extrabold text-white">均線形態突破檢測</h4>
                      <p className="text-xs text-slate-500">系統即時運行篩選算式，驗證是否符合指定起漲條件：</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Check 1 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#0F141E] rounded-xl border border-white/5 shadow-inner">
                        {selectedStock.signals?.isLongTermBull ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-300">季線多頭 (60MA)</span>
                      </div>

                      {/* Check 2 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#0F141E] rounded-xl border border-white/5 shadow-inner">
                        {selectedStock.signals?.isBullishArrangement ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-300">均線排列 (5&gt;10&gt;20)</span>
                      </div>

                      {/* Check 3 */}
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-inner transition-all ${
                        selectedStock.signals?.meetsBreakoutCriteria 
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold" 
                          : "bg-[#0F141E] border-white/5 text-slate-500"
                      }`}>
                        {selectedStock.signals?.meetsBreakoutCriteria ? (
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className="text-xs">月線整理爆量突破</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI DIAGNOSIS REPORT AND STRATEGIST */}
                <div className="bg-gradient-to-br from-blue-950/40 via-[#0F141E] to-[#0F141E] border border-white/5 rounded-3xl p-5 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                  <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-blue-500/10 rounded-full blur-xl" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-blue-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 animate-pulse">
                          AI 股神技術分析診斷師
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-600 text-white rounded font-mono">
                            Gemini 3.5
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400">智慧解構K線、量能、回測軌跡並給予實戰防守位</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRequestAiAnalysis(selectedStock.symbol)}
                      disabled={isAiLoading}
                      className="px-5 py-2.5 bg-blue-600 text-white text-xs font-extrabold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition duration-200 cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-900/20 z-20"
                    >
                      {isAiLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          正在解構均線軌跡...
                        </>
                      ) : (
                        <>
                          <Gauge className="w-4 h-4" />
                          啟動 AI 技術形態診斷
                        </>
                      )}
                    </button>
                  </div>

                  {/* Diagnosis Report Output */}
                  <AnimatePresence mode="wait">
                    {isAiLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="py-6 flex flex-col items-center justify-center space-y-3"
                      >
                        <div className="relative w-12 h-12">
                          <span className="absolute inset-0 rounded-full border-2 border-emerald-500 opacity-20" />
                          <span className="absolute inset-0 rounded-full border-t-2 border-r-2 border-emerald-400 animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-emerald-300 font-semibold font-mono">
                            AI 技術診斷啟動中...
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            正在分析歷史 MA20 & MA60 偏離值與當日爆量實體K線...
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {aiError && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3.5 bg-red-950/40 border border-red-800 rounded-2xl text-xs text-red-300 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{aiError}</span>
                      </motion.div>
                    )}

                    {aiReport && !isAiLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Summary Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Rating badge */}
                          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black block">形態推薦評等</span>
                            <span className={`text-sm font-black ${
                              aiReport.recommendation.startsWith("STRONG") 
                                ? "text-red-400 font-black animate-pulse" 
                                : aiReport.recommendation === "BUY" 
                                ? "text-orange-400" 
                                : "text-amber-300"
                            }`}>
                              {aiReport.recommendation === "STRONG_BUY" ? "🔥 強烈買進 (訊號突破)" : 
                               aiReport.recommendation === "BUY" ? "📈 偏多佈局 (維持多頭)" : 
                               aiReport.recommendation === "HOLD" ? "⌛ 觀望沉澱" : "⚠️ 格局保守"}
                            </span>
                          </div>

                          {/* Risk gauge */}
                          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black block">回測及型態風險評分</span>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm font-black font-mono">{aiReport.riskScore}</span>
                              <span className="text-[10px] text-slate-400">/ 10</span>
                              <span className={`text-xs ml-1 ${aiReport.riskScore <= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                ({aiReport.riskScore <= 4 ? '低回撤風險' : '建議控制部位'})
                              </span>
                            </div>
                          </div>

                          {/* Action Summary */}
                          <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black block">季線/月線排列狀態</span>
                            <span className="text-sm font-semibold text-emerald-300">
                              {selectedStock.movingAverages.ma5 > selectedStock.movingAverages.ma20 ? "高於月線強勢區" : "月理震盪築底"}
                            </span>
                          </div>
                        </div>

                        {/* Analysis Body Text */}
                        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                          <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                            {aiReport.analysis}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {!aiReport && !isAiLoading && (
                      <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-white/10 rounded-2xl">
                        💡 請點選右上方「啟動 AI 技術型態診斷」按鈕，Gemini 3.5 即可為您產出多目標回測與形態完整策略。
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ALERT CONFIGURATION SECTION */}
                <div className="bg-[#0F141E] rounded-2xl border border-white/5 shadow-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-white/5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-black text-white">
                        設定【{selectedStock.name}】盤中即時警示提醒
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">多價格點、形態自訂監控</span>
                  </div>

                  {/* Alert setup form */}
                  <form onSubmit={handleAddAlert} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Choose type */}
                    <div className="md:col-span-3 space-y-1.5">
                      <label className="text-xs font-bold text-slate-400">警示觸發類型</label>
                      <select
                        value={alertType}
                        onChange={(e) => setAlertType(e.target.value as AlertType)}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-white/5 bg-[#05070A] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      >
                        <option value="above">📈 股價大於或等於 (≧)</option>
                        <option value="below">📉 股價小於或等於 (≦)</option>
                        <option value="breakout">🔥 爆量大漲突破月線</option>
                      </select>
                    </div>

                    {/* Target Price */}
                    <div className="md:col-span-3 space-y-1.5">
                      <label className="text-xs font-bold text-slate-400">
                        {alertType === "breakout" ? "突破條件價 (系統自動計算)" : "警示目標價格 (元)"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={alertType === "breakout" ? "一體完美爆量觸發" : `當前: ${selectedStock.price}`}
                        disabled={alertType === "breakout"}
                        value={alertTargetPrice}
                        onChange={(e) => setAlertTargetPrice(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/5 bg-[#05070A] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:bg-[#080C14] disabled:text-slate-600"
                      />
                    </div>

                    {/* Notes */}
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-xs font-bold text-slate-400">警示備註/操盤日記</label>
                      <input
                        type="text"
                        placeholder="例：站上突破區間加碼，跌破月線出場"
                        value={alertNotes}
                        onChange={(e) => setAlertNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 bg-[#05070A] text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>

                    {/* Submit button */}
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-blue-600 border border-transparent text-white rounded-xl text-xs font-extrabold hover:bg-blue-500 transition duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-blue-900/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新增監控
                      </button>
                    </div>
                  </form>

                  {/* ACTIVE REMINDERS TABLE */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-400 block pb-1">目前設定的所有警示清單 ({alerts.length})</span>
                    
                    <div className="border border-white/5 rounded-xl overflow-hidden shadow-2xl bg-[#05070A]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/5 text-slate-400 font-bold font-sans">
                            <th className="p-3">監控目標</th>
                            <th className="p-3">類型</th>
                            <th className="p-3">設定閾值或條件</th>
                            <th className="p-3">備註</th>
                            <th className="p-3">目前狀態</th>
                            <th className="p-3 text-center">刪除</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {alerts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-5 text-center text-slate-500">目前暫無設定任何警示，請利用上方表單新增監控。</td>
                            </tr>
                          ) : (
                            alerts.map((alert) => {
                              return (
                                <tr key={alert.id} className="hover:bg-white/5 transition">
                                  <td className="p-3 text-slate-200">
                                    <strong className="font-extrabold text-white text-sm">{alert.stockName}</strong>
                                    <span className="text-[10px] text-slate-500 font-mono block">{alert.symbol}</span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      alert.type === "above" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                      alert.type === "below" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                                      "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    }`}>
                                      {alert.type === "above" ? "大於等於 (≧)" :
                                       alert.type === "below" ? "小於等於 (≦)" : 
                                       "突破月線"}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-200">
                                    {alert.type === "breakout" ? "爆量紅K大漲5%突破月線" : `${alert.targetPrice} 元`}
                                  </td>
                                  <td className="p-3 text-slate-400 max-w-[150px] truncate" title={alert.notes}>
                                    {alert.notes}
                                  </td>
                                  <td className="p-3">
                                    {alert.isTriggered ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                                          💥 已觸發提醒
                                        </span>
                                        <span className="text-[9px] text-slate-500 block font-mono">{alert.triggeredAt}</span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#161C27] text-blue-400 border border-blue-500/20 rounded">
                                        🟢 監控中
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => handleDeleteAlert(alert.id)}
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded transition cursor-pointer"
                                      title="移除警示"
                                    >
                                      <Trash2 className="w-4 h-4 mx-auto" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* ALERT LOGGER AND LOG DUMP (live triggering console) */}
                <div className="bg-[#0F141E] rounded-2xl border border-white/5 shadow-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-white/5">
                        <Database className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-black text-white">
                        盤中觸發警示實時紀錄日誌
                      </h3>
                    </div>

                    <button
                      onClick={handleClearLogs}
                      className="px-2.5 py-1 text-xs font-bold text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition duration-200 cursor-pointer"
                    >
                      清除紀錄
                    </button>
                  </div>

                  {/* Logs list */}
                  <div className="rounded-xl bg-[#05070A] p-4 font-mono text-xs text-slate-300 min-h-[160px] max-h-[240px] overflow-y-auto space-y-2 relative border border-white/5 overflow-x-hidden">
                    {alertLogs.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-2">
                        <Clock className="w-8 h-8 text-slate-755 animate-pulse" />
                        <span className="text-[11px] font-sans">
                          等待盤中股價波動觸發警示... (可點擊股票卡右方「模擬爆量突破」按鈕快速測試)
                        </span>
                      </div>
                    ) : (
                      alertLogs.map((log) => {
                        return (
                          <div key={log.id} className="p-2.5 rounded bg-[#0F141E] border-y border-r border-white/5 border-l-4 border-rose-500 hover:bg-[#161C27] transition flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-[10px] font-bold">[{log.time}]</span>
                                <strong className="text-rose-400 font-extrabold">{log.stockName} ({log.symbol})</strong>
                                <span className="text-slate-400 text-[10px]">觸發價: {log.triggeredPrice} 元</span>
                              </div>
                              <p className="text-slate-200 text-[11px] font-sans leading-relaxed">{log.message}</p>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-100 font-black text-[9px] uppercase shrink-0 font-sans">
                              MATCHED
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-24 text-center bg-[#0F141E] rounded-2xl border border-white/5">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-bounce" />
                <p className="text-white font-bold mb-1">未選取任何追蹤個股</p>
                <p className="text-xs text-slate-500">請在左側看板點擊欲查看的股票。</p>
              </div>
            )}

          </section>

        </div>
      </main>

      {/* NEW STOCK MODAL DIALOG */}
      <AnimatePresence>
        {showAddStockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F141E] rounded-3xl border border-white/5 shadow-2xl overflow-hidden max-w-md w-full p-6 relative space-y-4"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowAddStockModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">新增個股監控及模擬</h3>
                <p className="text-xs text-slate-400">自訂一隻個股，並選擇其形態特徵注入模擬盤中：</p>
              </div>

              {addStockError && (
                <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-350 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{addStockError}</span>
                </div>
              )}

              <form onSubmit={handleAddStock} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Symbol Code */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">股票代號</label>
                    <input
                      type="text"
                      required
                      placeholder="例如: 3481"
                      value={newStockId}
                      onChange={(e) => setNewStockId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 bg-[#05070A] text-slate-100 placeholder:text-slate-700 font-bold"
                    />
                  </div>

                  {/* Stock Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">股票名稱</label>
                    <input
                      type="text"
                      required
                      placeholder="例如: 群創"
                      value={newStockName}
                      onChange={(e) => setNewStockName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 bg-[#05070A] text-slate-100 placeholder:text-slate-700 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">產業分類</label>
                    <select
                      value={newStockCategory}
                      onChange={(e) => setNewStockCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 bg-[#05070A] text-slate-200 font-bold"
                    >
                      <option value="半導體">半導體</option>
                      <option value="IC設計">IC設計</option>
                      <option value="AI伺服器">AI伺服器</option>
                      <option value="散熱模組">散熱模組</option>
                      <option value="面板製造">面板製造</option>
                      <option value="網通光通訊">網通光通訊</option>
                      <option value="重電與綠能">重電與綠能</option>
                    </select>
                  </div>

                  {/* Starting Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">起始價格 (元)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.1"
                      placeholder="100"
                      value={newStockBasePrice}
                      onChange={(e) => setNewStockBasePrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 bg-[#05070A] text-slate-100 placeholder:text-slate-700 font-bold"
                    />
                  </div>
                </div>

                {/* Simulated Trend Archetype */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">注入 K 線特徵 (快速測試篩選器)</label>
                  <select
                    value={newStockTrend}
                    onChange={(e) => setNewStockTrend(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 bg-[#05070A] text-slate-200 font-bold"
                  >
                    <option value="consolidating">⏳ 壓回月線整理 (高契合度，等待今天量爆衝突破)</option>
                    <option value="breakout">⚡ 經典突破 (今日大漲+爆量)</option>
                    <option value="bullish_trend">📈 持續多頭發散 (MA5 &gt; MA10 &gt; MA20)</option>
                    <option value="downtrend">📉 接刀空頭阻力 (均線空頭排列，將被多頭篩選過濾)</option>
                    <option value="random">🎲 隨機窄幅盤整</option>
                  </select>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold hover:bg-blue-500 transition duration-200 cursor-pointer"
                >
                  確認建立並開始監控
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
