import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { generateInitialStocksList, simulateStockTick, evaluateCriteria, generateStockHistory, computeMAsForStock } from "./src/stockEngine";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory stock storage
let activeStocks = generateInitialStocksList();

// Background simulator: tick prices every 4 seconds to simulate real-time market action
setInterval(() => {
  activeStocks = activeStocks.map(stock => {
    // If the stock is flagged for simulated breakout, we don't overwrite it immediately with tiny ticks
    return simulateStockTick(stock, false);
  });
}, 4000);

// Google GenAI initialization
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (err) {
    console.error("Failed to initialize Google GenAI SDK:", err);
  }
}

// REST APIs
// 1. Get all stocks with their computed criteria signals
app.get("/api/stocks", (req, res) => {
  const stocksWithSignals = activeStocks.map(stock => {
    const signals = evaluateCriteria(stock);
    return {
      ...stock,
      signals
    };
  });
  res.json(stocksWithSignals);
});

// 2. Force a breakout simulation on a stock
app.post("/api/stocks/simulate-breakout", (req, res) => {
  const { id } = req.body;
  const stockIdx = activeStocks.findIndex(s => s.id === id);
  
  if (stockIdx === -1) {
    return res.status(404).json({ error: "Stock not found" });
  }

  // Force breakout update
  activeStocks[stockIdx] = simulateStockTick(activeStocks[stockIdx], true);
  
  const signals = evaluateCriteria(activeStocks[stockIdx]);
  res.json({
    success: true,
    stock: {
      ...activeStocks[stockIdx],
      signals
    }
  });
});

// 3. Add a tracked custom stock symbol
app.post("/api/stocks/add", (req, res) => {
  const { id, name, category, trendStyle, basePrice } = req.body;

  if (!id || !name || !category || !basePrice) {
    return res.status(400).json({ error: "缺少必要欄位。請填寫代號、名稱、分類與價格" });
  }

  const exists = activeStocks.some(s => s.id === id || s.symbol.startsWith(id));
  if (exists) {
    return res.status(400).json({ error: `代號 ${id} 的個股已在追蹤清單中` });
  }

  const symbol = `${id}.TW`;
  
  // Create simulated history
  const priceNum = parseFloat(basePrice);
  const type = trendStyle || "random";
  const mockHistory = generateStockHistory(id, priceNum, type);
  const movingAverages = computeMAsForStock(mockHistory);
  
  const todayBar = mockHistory[mockHistory.length - 1];
  const prevBar = mockHistory[mockHistory.length - 2] || todayBar;

  const past5BarsForVol = mockHistory.slice(mockHistory.length - 6, mockHistory.length - 1);
  const sumVol = past5BarsForVol.reduce((acc: number, bar: any) => acc + bar.volume, 0);
  const avgVol5d = past5BarsForVol.length > 0 ? Math.floor(sumVol / past5BarsForVol.length) : 8000;

  const currentPrice = todayBar.close;
  const change = parseFloat((currentPrice - prevBar.close).toFixed(2));
  const changePercent = parseFloat(((change / prevBar.close) * 100).toFixed(2));

  const newStock = {
    id,
    name,
    symbol,
    price: currentPrice,
    open: todayBar.open,
    high: todayBar.high,
    low: todayBar.low,
    close: prevBar.close,
    volume: todayBar.volume,
    avgVolume5d: avgVol5d,
    change,
    changePercent,
    history: mockHistory,
    movingAverages,
    lastMAUpdateDate: todayBar.date,
    trendStyle: type,
    category
  };

  activeStocks.unshift(newStock); // Add at the start of array
  res.json({ success: true, stock: newStock });
});

// 4. Gemini Stock Strategist AI Analysis
app.post("/api/gemini/analyze", async (req, res) => {
  const { symbol } = req.body;
  const stock = activeStocks.find(s => s.symbol === symbol || s.id === symbol);

  if (!stock) {
    return res.status(404).json({ error: "找不到指定的個股資料" });
  }

  if (!ai) {
    // Return friendly local analysis as a fallback if API key is not configured or fails
    const signals = evaluateCriteria(stock);
    const localFallback = {
      analysis: `【系統自動生成分析】個股 ${stock.name} (${stock.id}) 目前價格為 ${stock.price} 元（漲跌幅: ${stock.changePercent}%）。` +
        `其均線數值分別為：5日線 ${stock.movingAverages.ma5}元，10日線 ${stock.movingAverages.ma10}元，月線 ${stock.movingAverages.ma20}元，季線 ${stock.movingAverages.ma60}元。\n\n` +
        `● 長期趨勢: ${signals.isLongTermBull ? "符合多頭趨勢，股價位於 60 日均線（季線）之上且季線走平上揚。" : "偏向空頭或盤整，股價位於 60 日均線之下。"}\n` +
        `● 均線排列: ${signals.isBullishArrangement ? "均線呈現多頭排列 (5MA > 10MA > 20MA)，短期上攻力道強勁。" : "均線糾纏或空頭排列。"}\n` +
        `● 突破訊號: ${signals.meetsBreakoutCriteria ? "🔥符合精選條件：該股在經歷月線壓回整理沉澱後，今日以超過 5 均量 1.5 倍的成交量（今日: ${stock.volume}張，5日均量: ${stock.avgVolume5d}張）且漲幅大於 5% 突破月線！這是極佳的波段啟動突破點。" : "目前暫無月線級別的爆量突破訊號。"}\n\n` +
        `建議觀察盤中爆量守穩突破長紅棒低點，分批佈局。`,
      recommendation: signals.meetsBreakoutCriteria ? "STRONG_BUY" : (signals.isBullishArrangement ? "BUY" : "HOLD"),
      riskScore: signals.meetsBreakoutCriteria ? 3 : (signals.isLongTermBull ? 4 : 7)
    };
    return res.json(localFallback);
  }

  try {
    const signals = evaluateCriteria(stock);
    const prompt = `你是一位專業的台灣股市首席策略分析師與K線形態學大師。請分析以下個股技術指標，並給出專業、客觀且具有洞察力的分析報告。
個股資訊:
名稱: ${stock.name} (${stock.id})
分類: ${stock.category}
當前股價: ${stock.price} 元
今日漲跌幅: ${stock.changePercent}%
今日成交量: ${stock.volume} 張
五日平均成交量: ${stock.avgVolume5d} 張
當前均線: 5MA: ${stock.movingAverages.ma5} 元, 10MA: ${stock.movingAverages.ma10} 元, 20MA (月線): ${stock.movingAverages.ma20} 元, 60MA (季線): ${stock.movingAverages.ma60} 元

篩選指標符合度:
1. 是否為長期多頭 (價高於 60MA 且 60MA 上揚): ${signals.isLongTermBull ? "是" : "否"}
2. 近期短中期均線是否呈現多頭排列 (5MA > 10MA > 20MA): ${signals.isBullishArrangement ? "是" : "否"}
3. 是否符合月均線壓回整理後爆量 (>1.5x五均量) 大漲 (>5%) 突破月線條件: ${signals.meetsBreakoutCriteria ? "是！(今日完美爆量突破)" : "否"}

請根據上述數據撰寫詳細分析，討論該股的「長期走勢、短期均線排列、月線壓回與今日突破特徵、籌碼/交易量配合度、具體防守點位（支撐價位）與進場時機建議」。
你必須回傳 JSON 格式的內容，包含以下三個欄位，不需要 Markdown 裝飾：
{
  "analysis": "這裡填寫你的詳細分析與操作建議，請用繁體中文，分點陳述有條理，字數大約 300 - 450 字。",
  "recommendation": "STRONG_BUY" 或 "BUY" 或 "HOLD" 或 "SELL" 或 "AVOID",
  "riskScore": 1 到 10 之間的數字 (1代表風險極低，10代表風險極高)
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text || "";
    const parsed = JSON.parse(resultText.trim());
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: "AI 諮詢暫時繁忙，請稍後再試: " + error.message });
  }
});

// Configure static assets of Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
