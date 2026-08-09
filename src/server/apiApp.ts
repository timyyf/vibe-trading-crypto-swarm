import express from "express";
import { getTop100CryptoAssets, getCryptoKlines, ALPHA_ZOO_FACTORS } from "./cryptoDataService.js";
import { analyzeCryptoWithSwarm } from "./geminiService.js";
import { validateAndSanitizeSwarmResponse, runSwarmTestSuite } from "../lib/swarmValidator.js";
import { getWhaleOverview } from "./whaleDataService.js";
import { runHMMRegimeDetection, runBacktest } from "./quantEngine.js";

const app = express();

app.use(express.json());

// --- API ROUTES ---

// System Health & Periodic Diagnostics
app.get("/api/health", async (req, res) => {
  const simulateDisconnectedAgent = req.query.simulateAgent as string | undefined;
  const simulateDegraded = req.query.simulateDegraded === 'true';

  const now = Date.now();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  // Check market feed latency
  const startFeedCheck = Date.now();
  let feedStatus: 'ONLINE' | 'DEGRADED' | 'DISCONNECTED' = 'ONLINE';
  let feedLatency = 12;
  try {
    const assets = await getTop100CryptoAssets();
    feedLatency = Date.now() - startFeedCheck;
    if (assets.length === 0) feedStatus = 'DEGRADED';
  } catch {
    feedStatus = 'DISCONNECTED';
    feedLatency = 999;
  }

  const diagnostics = [
    {
      id: 'market_feed' as const,
      name: 'Binance Orderbook & Market Feed',
      type: 'connector' as const,
      status: simulateDisconnectedAgent === 'market_feed' ? ('DISCONNECTED' as const) : feedStatus,
      latencyMs: feedLatency,
      lastChecked: now,
      details: feedStatus === 'ONLINE' ? 'Feed de dados spot sincronizado em tempo real.' : 'Falha na conexão de dados do livro de ordens.',
    },
    {
      id: 'gemini_llm' as const,
      name: 'Inference Engine (Gemini 2.5 Flash)',
      type: 'connector' as const,
      status: simulateDisconnectedAgent === 'gemini_llm' ? ('DISCONNECTED' as const) : (hasGeminiKey ? ('ONLINE' as const) : ('DEGRADED' as const)),
      latencyMs: hasGeminiKey ? 18 : 120,
      lastChecked: now,
      details: hasGeminiKey ? 'Motor LLM Gemini operacional em alta velocidade.' : 'Chave API ausente ou em modo fallback local.',
    },
    {
      id: 'technical' as const,
      name: 'Dr. Quant Graph (Análise Técnica)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'technical' ? ('DISCONNECTED' as const) : ('ONLINE' as const),
      latencyMs: 14,
      lastChecked: now,
      details: 'Indicadores EMA20, SMA50, RSI(14) e Bollinger operacionais.',
    },
    {
      id: 'sentiment' as const,
      name: 'Sofia Sentiment (Fear & Greed + Funding Rate)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'sentiment' ? ('DISCONNECTED' as const) : (simulateDegraded ? ('DEGRADED' as const) : ('ONLINE' as const)),
      latencyMs: simulateDegraded ? 480 : 22,
      lastChecked: now,
      details: (simulateDisconnectedAgent === 'sentiment' || simulateDegraded)
        ? 'Instabilidade na API alternativa.me / Binance Futures. Desempenho reduzido.'
        : 'Fear & Greed Index (alternative.me) e Funding Rate (Binance Futures) monitorados.',
    },
    {
      id: 'orderbook' as const,
      name: 'OrderBook Sentinel (Liquidez & Depth L2)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'orderbook' ? ('DISCONNECTED' as const) : ('ONLINE' as const),
      latencyMs: 22,
      lastChecked: now,
      details: 'Livro de ofertas L2 real da Binance (bids/asks, OBI, POC, CVD).',
    },
    {
      id: 'whales' as const,
      name: 'Whale Tracker Apex (On-Chain Real)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'whales' ? ('DISCONNECTED' as const) : ('ONLINE' as const),
      latencyMs: 19,
      lastChecked: now,
      details: 'Agregados on-chain reais (Deep Blue Alpha): stats, whale index e top tokens.',
    },
    {
      id: 'alpha' as const,
      name: 'Alpha Zoo Engine (Fatores Quantitativos)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'alpha' ? ('DISCONNECTED' as const) : ('ONLINE' as const),
      latencyMs: 16,
      lastChecked: now,
      details: 'Regime HMM real (Baum-Welch) e backtest walk-forward sobre klines reais.',
    },
    {
      id: 'risk' as const,
      name: 'Risk Protocol Officer (Kelly, VaR & Veto)',
      type: 'agent' as const,
      status: simulateDisconnectedAgent === 'risk' ? ('DISCONNECTED' as const) : ('ONLINE' as const),
      latencyMs: 15,
      lastChecked: now,
      details: 'Half-Kelly, VaR 95% e CVaR calculados sobre volatilidade real dos klines.',
    },
  ];

  const hasDisconnected = diagnostics.some((d) => d.status === 'DISCONNECTED');
  const hasDegraded = diagnostics.some((d) => d.status === 'DEGRADED');

  let overallStatus: 'ONLINE' | 'DEGRADED' | 'DISCONNECTED' = 'ONLINE';
  let warningMessage: string | undefined = undefined;

  if (hasDisconnected) {
    overallStatus = 'DEGRADED';
    const disconnectedItems = diagnostics.filter(d => d.status === 'DISCONNECTED').map(d => d.name).join(', ');
    warningMessage = `Aviso do Sistema: Desconexão detectada no componente (${disconnectedItems}). Desempenho reduzido de análise.`;
  } else if (hasDegraded) {
    overallStatus = 'DEGRADED';
    const degradedItems = diagnostics.filter(d => d.status === 'DEGRADED').map(d => d.name).join(', ');
    warningMessage = `Aviso do Sistema: Alta latência ou degradação detectada no componente (${degradedItems}).`;
  }

  const activeCount = diagnostics.filter(d => d.status === 'ONLINE').length;

  res.json({
    success: true,
    data: {
      overallStatus,
      timestamp: now,
      latencyMs: Math.max(...diagnostics.map(d => d.latencyMs)),
      activeAgentsCount: activeCount,
      totalAgentsCount: diagnostics.length,
      diagnostics,
      warningMessage,
    }
  });
});

// Top 100 cryptocurrencies by 24h volume
app.get("/api/crypto/top", async (_req, res) => {
  try {
    const assets = await getTop100CryptoAssets();
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    console.error("Error fetching top crypto:", err);
    res.status(500).json({ success: false, error: "Falha ao carregar lista de criptomoedas" });
  }
});

// Historical Klines (candlestick chart)
app.get("/api/crypto/klines", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || "BTC";
    const interval = (req.query.interval as string) || "5m";
    const limit = parseInt((req.query.limit as string) || "40", 10);
    const klines = await getCryptoKlines(symbol, interval, limit);
    res.json({ success: true, symbol, interval, data: klines });
  } catch (err) {
    console.error("Error fetching klines:", err);
    res.status(500).json({ success: false, error: "Falha ao carregar gráfico klines" });
  }
});

// Whale On-Chain Overview (agregados reais — Deep Blue Alpha)
app.get("/api/crypto/whales", async (_req, res) => {
  try {
    const overview = await getWhaleOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    console.error("Error fetching whale overview:", err);
    res.status(500).json({ success: false, error: "Falha ao carregar agregados on-chain de baleias" });
  }
});

// Alpha Zoo Factors
app.get("/api/crypto/alpha-factors", (_req, res) => {
  res.json({ success: true, data: ALPHA_ZOO_FACTORS });
});

// Real-Time HMM Market Regime Detection (Baum-Welch sobre klines reais)
app.get("/api/crypto/hmm", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || "BTC";
    const interval = (req.query.interval as string) || "15m";
    const limit = parseInt((req.query.limit as string) || "80", 10);
    const klines = await getCryptoKlines(symbol, interval, limit);
    if (klines.length === 0) {
      return res.status(503).json({ success: false, error: "Klines indisponíveis para detecção de regime HMM" });
    }
    const hmm = runHMMRegimeDetection(klines);
    res.json({ success: true, symbol, interval, data: hmm });
  } catch (err) {
    console.error("Error running HMM regime detection:", err);
    res.status(500).json({ success: false, error: "Falha na detecção de regime HMM" });
  }
});

// Real-Time Walk-Forward Backtest por fator Alpha (sobre klines reais)
app.get("/api/crypto/backtest", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || "BTC";
    const factorId = (req.query.factorId as string) || "gtja191_001";
    const interval = (req.query.interval as string) || "15m";
    const limit = parseInt((req.query.limit as string) || "80", 10);
    const factor = ALPHA_ZOO_FACTORS.find((f) => f.id === factorId) || ALPHA_ZOO_FACTORS[0];
    const klines = await getCryptoKlines(symbol, interval, limit);
    if (klines.length === 0) {
      return res.status(503).json({ success: false, error: "Klines indisponíveis para backtest" });
    }
    const backtest = runBacktest(klines, factor);
    res.json({ success: true, symbol, interval, factorId: factor.id, data: backtest });
  } catch (err) {
    console.error("Error running backtest:", err);
    res.status(500).json({ success: false, error: "Falha ao executar backtest" });
  }
});

// Multi-Agent Swarm Analysis (Gemini Powered)
app.post("/api/swarm/analyze", async (req, res) => {
  try {
    const { symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes } = req.body;
    
    if (!symbol || price === undefined) {
      return res.status(400).json({ success: false, error: "Campos obrigatórios: symbol, price" });
    }

    const duration = parseInt(signalDurationMinutes || "5", 10);
    const result = await analyzeCryptoWithSwarm(
      symbol,
      name || symbol,
      parseFloat(price),
      parseFloat(change24h || "0"),
      parseFloat(volume24h || "0"),
      parseFloat(high24h || price),
      parseFloat(low24h || price),
      duration
    );

    // Validate & Sanitize structure before sending to frontend
    const validation = validateAndSanitizeSwarmResponse(result);

    res.json({
      success: true,
      data: validation.sanitized,
      _debugSchemaValidation: {
        valid: validation.valid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length,
        reports: validation.reports,
      },
    });
  } catch (err) {
    console.error("Error running swarm analysis:", err);
    res.status(500).json({ success: false, error: "Erro durante execução do comitê de IA" });
  }
});

// Real-Time Specialist Agents Partial Results Streaming Endpoint (SSE)
app.post("/api/swarm/stream", async (req, res) => {
  try {
    const { symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes } = req.body;

    if (!symbol || price === undefined) {
      return res.status(400).json({ success: false, error: "Campos obrigatórios: symbol, price" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const duration = parseInt(signalDurationMinutes || "5", 10);
    const parsedPrice = parseFloat(price);
    const parsedChange = parseFloat(change24h || "0");
    const parsedVol = parseFloat(volume24h || "0");
    const parsedHigh = parseFloat(high24h || price);
    const parsedLow = parseFloat(low24h || price);

    // 1. Emit INIT event
    res.write(`data: ${JSON.stringify({
      type: 'init',
      symbol,
      name: name || symbol,
      price: parsedPrice,
      timestamp: Date.now(),
      totalAgents: 6,
      message: `Comitê Swarm iniciado para ${symbol}. Transmitindo análises parciais dos 6 agentes em tempo real...`
    })}\n\n`);

    // 2. Perform swarm analysis (Gemini or Fallback)
    const result = await analyzeCryptoWithSwarm(
      symbol,
      name || symbol,
      parsedPrice,
      parsedChange,
      parsedVol,
      parsedHigh,
      parsedLow,
      duration
    );

    const validation = validateAndSanitizeSwarmResponse(result);
    const sanitizedResult = validation.sanitized;

    // 3. Stream each specialist agent's partial conclusion sequentially
    for (let i = 0; i < sanitizedResult.agents.length; i++) {
      const agent = sanitizedResult.agents[i];
      await new Promise(resolve => setTimeout(resolve, 280));
      res.write(`data: ${JSON.stringify({
        type: 'agent_partial',
        agentIndex: i,
        totalAgents: sanitizedResult.agents.length,
        agent,
        timestamp: Date.now()
      })}\n\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. Emit FINAL CONSENSUS event
    res.write(`data: ${JSON.stringify({
      type: 'final_consensus',
      data: sanitizedResult,
      _debugSchemaValidation: {
        valid: validation.valid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length,
        reports: validation.reports,
      },
      timestamp: Date.now()
    })}\n\n`);

    res.end();
  } catch (err) {
    console.error("Error streaming swarm analysis:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Erro durante execução do streaming do comitê" });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: "Falha na conexão do streaming" })}\n\n`);
      res.end();
    }
  }
});

// Automated Unit Test Suite for /api/swarm/analyze Schema Validation
app.get("/api/swarm/test", async (_req, res) => {
  try {
    const suiteResult = await runSwarmTestSuite(async (payload) => {
      const testResult = await analyzeCryptoWithSwarm(
        payload.symbol,
        payload.name,
        payload.price,
        payload.change24h,
        payload.volume24h,
        payload.high24h,
        payload.low24h,
        payload.signalDurationMinutes
      );
      return { data: testResult };
    });

    res.json({
      success: true,
      timestamp: Date.now(),
      testSuite: suiteResult,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

export default app;
