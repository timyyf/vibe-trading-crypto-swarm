import express from "express";
import { getTop100CryptoAssets, getCryptoKlines, getSparklinesForSymbols, ALPHA_ZOO_FACTORS } from "./cryptoDataService.js";
import { analyzeCryptoWithSwarm } from "./geminiService.js";
import { validateAndSanitizeSwarmResponse, runSwarmTestSuite } from "../lib/swarmValidator.js";
import { getWhaleOverview } from "./whaleDataService.js";
import { runDrQuantGraphEngine, runHMMRegimeDetection, runBacktest } from "./quantEngine.js";
import { runSofiaSentimentEngine } from "./sentimentEngine.js";
import { fetchRealDepth } from "./orderbookEngine.js";
import { runWhaleTrackerApexEngine } from "./whaleEngine.js";
import { runAlphaZooEngine } from "./alphaZooEngine.js";
import { runRiskProtocolOfficerEngine } from "./riskEngine.js";
import { AgentDiagnostic } from "../types.js";
import { swarmBodySchema, swarmAnalyzeLimiter, swarmTestLimiter, SwarmBody, journalBodySchema } from "./swarmSchema.js";
import { ApiRequestLogEntry, buildDiagnostics } from "../lib/observability.js";
import {
  checkSemanticaHealth,
  getPrecedents,
  getDecisionChain,
  listDecisions,
  getGraphStats,
  isSemanticaEnabled,
  isPrecedentInjectionEnabled,
  recordDecision,
  recordJournalEntry,
} from "./semanticaClient.js";

const app = express();

app.use(express.json());

// --- OBSERVABILIDADE: log em memória de todas as requisições ---
const requestLog: ApiRequestLogEntry[] = [];
const REQUEST_LOG_MAX = 2000;
const DIAGNOSTICS_START_TIME = Date.now();

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const entry: ApiRequestLogEntry = {
      method: req.method,
      path: req.path.split("?")[0],
      status: res.statusCode,
      durationMs: Date.now() - start,
      timestamp: Date.now(),
    };
    requestLog.push(entry);
    if (requestLog.length > REQUEST_LOG_MAX) requestLog.shift();
    console.log(`[api] ${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms`);
  });
  next();
});

// Validação do corpo das rotas de comitê via zod (400 com detalhes quando inválido).
function validateSwarmBody(req: express.Request, res: express.Response, next: express.NextFunction) {
  const parsed = swarmBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Payload inválido",
      details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  req.body = parsed.data;
  next();
}

// --- API ROUTES ---

// Cache dos diagnósticos: recálculo a cada 25s, polls intermediários respondem ~30ms.
const HEALTH_CACHE_TTL_MS = 25 * 1000;
const PROBE_DEADLINE_MS = 1500;
let healthCache: { fetchedAt: number; diagnostics: AgentDiagnostic[] } | null = null;

// Sonda externa com deadline global: se estourar 1.5s, marca DEGRADED e responde mesmo assim.
async function probeWithDeadline<T>(
  fn: () => Promise<T>,
  deadlineMs = PROBE_DEADLINE_MS
): Promise<{ ok: boolean; lat: number; value?: T }> {
  const start = Date.now();
  const timeout = new Promise<{ ok: boolean; lat: number }>((resolve) => {
    setTimeout(() => resolve({ ok: false, lat: deadlineMs }), deadlineMs);
  });
  const attempt = (async () => {
    try {
      return { ok: true, lat: Date.now() - start, value: await fn() };
    } catch {
      return { ok: false, lat: Date.now() - start };
    }
  })();
  return (await Promise.race([attempt, timeout])) as { ok: boolean; lat: number; value?: T };
}

// Real-time diagnostics: mede latência real de cada feed/agente (BTC como sonda).
async function buildRealDiagnostics(now: number): Promise<AgentDiagnostic[]> {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const semanticaEnabled = isSemanticaEnabled();

  // Sondas externas rodam em PARALELO, cada uma com deadline de 1.5s.
  const [feedRes, gemRes, klinesRes, sentimentRes, depthRes, whaleFeedRes, semanticaRes] = await Promise.all([
    probeWithDeadline(() => getTop100CryptoAssets()),
    probeWithDeadline(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_DEADLINE_MS);
      try {
        await fetch('https://generativelanguage.googleapis.com/', {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch {
        clearTimeout(timer);
        throw new Error('Gemini endpoint unreachable');
      }
    }),
    probeWithDeadline(() => getCryptoKlines('BTC', '15m', 60)),
    probeWithDeadline(() => runSofiaSentimentEngine('BTC', 0, 0, 0, 0, 0)),
    probeWithDeadline(() => fetchRealDepth('BTC')),
    probeWithDeadline(() => getWhaleOverview()),
    probeWithDeadline(() => checkSemanticaHealth()),
  ]);

  // Feed: OK quando retorna ativos; vazio = DEGRADED; timeout/falha = DEGRADED (deadline).
  const assets = feedRes.value ?? [];
  const feedStatus: AgentDiagnostic['status'] =
    !feedRes.ok ? 'DEGRADED' : assets.length === 0 ? 'DEGRADED' : 'ONLINE';

  // Gemini: chave presente + endpoint respondeu.
  const gemStatus: AgentDiagnostic['status'] = !hasGeminiKey
    ? 'DEGRADED'
    : gemRes.ok
    ? 'ONLINE'
    : 'DEGRADED';

  // Klines de sonda para os agentes locais (BTC 15m).
  const klines = klinesRes.ok ? klinesRes.value! : [];
  const last = klines[klines.length - 1];
  const price = last?.close ?? 0;
  const high = klines.length ? Math.max(...klines.map((k) => k.high)) : 0;
  const low = klines.length ? Math.min(...klines.map((k) => k.low)) : 0;
  const hasKlines = klines.length > 0;

  // 4. Agentes de computação local (tempo real de execução)
  const tTech = Date.now();
  try {
    runDrQuantGraphEngine('BTC', price, 0, 0, high, low, klines);
  } catch { /* mantém DEGRADED */ }
  const techLatency = Date.now() - tTech;

  const tAlpha = Date.now();
  try {
    runAlphaZooEngine('BTC', price, 0, 0, high, low, klines);
  } catch { /* mantém DEGRADED */ }
  const alphaLatency = Date.now() - tAlpha;

  const tRisk = Date.now();
  try {
    runRiskProtocolOfficerEngine('BTC', price, 0, 0, high, low, klines, 'COMPRAR');
  } catch { /* mantém DEGRADED */ }
  const riskLatency = Date.now() - tRisk;

  const tWhale = Date.now();
  let whaleOk = false;
  try {
    const whaleReport = runWhaleTrackerApexEngine('BTC', price, 0, 0, high, low, whaleFeedRes.ok ? whaleFeedRes.value! : null);
    whaleOk = whaleReport.summary !== null;
  } catch { /* mantém DEGRADED */ }
  const whaleLatency = whaleFeedRes.lat + (Date.now() - tWhale);

  const sentimentOk = sentimentRes.ok && sentimentRes.value!.report.status === 'CONCLUÍDO';
  const orderbookOk = depthRes.ok && depthRes.value !== null;

  const sentimentLatency = sentimentRes.lat;
  const orderbookLatency = depthRes.lat;

  const semanticaHealth = semanticaRes.ok && semanticaRes.value ? semanticaRes.value : null;
  const semanticaHealthy = semanticaEnabled && !!semanticaHealth?.healthy;
  const semanticaLatency = semanticaRes.lat;
  const semanticaDecisionCount = semanticaHealth?.decisionCount ?? 0;

  const feedDetails = feedStatus === 'ONLINE'
    ? 'Feed de dados spot Binance sincronizado em tempo real.'
    : feedStatus === 'DEGRADED'
    ? 'Feed de dados sem retorno de ativos no momento.'
    : 'Falha na conexão de dados do livro de ordens.';

  return [
    {
      id: 'market_feed' as const,
      name: 'Binance Orderbook & Market Feed',
      type: 'connector' as const,
      status: feedStatus,
      latencyMs: feedRes.lat,
      lastChecked: now,
      details: feedDetails,
    },
    {
      id: 'gemini_llm' as const,
      name: 'Inference Engine (Gemini 2.5 Flash)',
      type: 'connector' as const,
      status: gemStatus,
      latencyMs: gemRes.lat,
      lastChecked: now,
      details: hasGeminiKey
        ? (gemStatus === 'ONLINE' ? 'Endpoint Gemini respondendo. Chave API configurada.' : 'Endpoint Gemini inacessível no momento.')
        : 'Chave API ausente — comitê em modo fallback local determinístico (dados reais).',
    },
    {
      id: 'technical' as const,
      name: 'Dr. Quant Graph (Análise Técnica)',
      type: 'agent' as const,
      status: hasKlines ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: techLatency,
      lastChecked: now,
      details: hasKlines
        ? `EMA20, SMA50, RSI(14), MACD e Bollinger calculados em ${techLatency}ms sobre ${klines.length} klines reais.`
        : 'Sem klines reais disponíveis para cálculo de indicadores.',
    },
    {
      id: 'sentiment' as const,
      name: 'Sofia Sentiment (Fear & Greed + Funding Rate)',
      type: 'agent' as const,
      status: sentimentOk ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: sentimentLatency,
      lastChecked: now,
      details: sentimentOk
        ? `Fear & Greed (alternative.me) e Funding Rate (Binance Futures) reais em ${sentimentLatency}ms.`
        : 'Fear & Greed / Funding Rate indisponíveis no momento — nenhum número fabricado.',
    },
    {
      id: 'orderbook' as const,
      name: 'OrderBook Sentinel (Liquidez & Depth L2)',
      type: 'agent' as const,
      status: orderbookOk ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: orderbookLatency,
      lastChecked: now,
      details: orderbookOk
        ? `Depth L2 real da Binance (bids/asks, OBI, POC, CVD) em ${orderbookLatency}ms.`
        : 'Depth da Binance indisponível no momento — microestrutura pausada.',
    },
    {
      id: 'whales' as const,
      name: 'Whale Tracker Apex (On-Chain Real)',
      type: 'agent' as const,
      status: whaleOk ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: whaleLatency,
      lastChecked: now,
      details: whaleOk
        ? `Agregados on-chain reais (Deep Blue Alpha) em ${whaleLatency}ms.`
        : 'Deep Blue Alpha indisponível no momento — fluxo on-chain pausado.',
    },
    {
      id: 'alpha' as const,
      name: 'Alpha Zoo Engine (Fatores Quantitativos)',
      type: 'agent' as const,
      status: hasKlines ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: alphaLatency,
      lastChecked: now,
      details: hasKlines
        ? `Regime HMM (Baum-Welch) e backtest walk-forward em ${alphaLatency}ms sobre klines reais.`
        : 'Sem klines reais disponíveis para regime HMM e backtest.',
    },
    {
      id: 'risk' as const,
      name: 'Risk Protocol Officer (Kelly, VaR & Veto)',
      type: 'agent' as const,
      status: hasKlines ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: riskLatency,
      lastChecked: now,
      details: hasKlines
        ? `Half-Kelly, VaR 95% e CVaR calculados em ${riskLatency}ms sobre volatilidade real dos klines.`
        : 'Sem klines reais disponíveis para cálculo de risco.',
    },
    {
      id: 'semantica_kg' as const,
      name: 'Semantica Knowledge Graph (Memória de Longo Prazo)',
      type: 'connector' as const,
      status: semanticaHealthy ? ('ONLINE' as const) : ('DEGRADED' as const),
      latencyMs: semanticaLatency,
      lastChecked: now,
      details: semanticaEnabled
        ? (semanticaHealthy
            ? `Sidecar respondendo em ${semanticaLatency}ms (${semanticaDecisionCount} decisões no grafo).`
            : 'Sidecar inacessível — decisões serão perdidas (degradação graciosa).')
        : 'SEMANTICA_BASE_URL não configurado — memória de longo prazo desativada.',
    },
  ];
}

// System Health & Periodic Diagnostics
app.get("/api/health", async (req, res) => {
  const simulateDisconnectedAgent = req.query.simulateAgent as string | undefined;
  const simulateDegraded = req.query.simulateDegraded === 'true';

  const now = Date.now();

  // Cache 25s: recálculo real apenas no primeiro poll de cada janela.
  if (!healthCache || now - healthCache.fetchedAt >= HEALTH_CACHE_TTL_MS) {
    healthCache = { fetchedAt: now, diagnostics: await buildRealDiagnostics(now) };
  }
  const diagnostics = healthCache.diagnostics.map((d) => ({ ...d, lastChecked: now }));

  // Overrides de simulação (painel de debug)
  for (const d of diagnostics) {
    if (simulateDisconnectedAgent === d.id) {
      d.status = 'DISCONNECTED';
    } else if (simulateDegraded && d.id === 'sentiment') {
      d.status = 'DEGRADED';
    }
  }

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

// Sparklines de tendência (fechamentos 5m) para 1+ símbolos — "symbols=BTC,ETH,SOL"
app.get("/api/crypto/sparkline", async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols as string) || (req.query.symbol as string) || "";
    if (!symbolsParam.trim()) {
      return res.status(400).json({ success: false, error: "Parâmetro 'symbols' é obrigatório (ex.: symbols=BTC,ETH,SOL)" });
    }
    const symbols = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 100);
    const sparklines = await getSparklinesForSymbols(symbols, 24);
    res.json({ success: true, count: Object.keys(sparklines).length, data: sparklines });
  } catch (err) {
    console.error("Error fetching sparklines:", err);
    res.status(500).json({ success: false, error: "Falha ao carregar sparklines" });
  }
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
app.post("/api/swarm/analyze", swarmAnalyzeLimiter, validateSwarmBody, async (req, res) => {
  try {
    const { symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes } = req.body as SwarmBody;

    let precedents: string | undefined;
    if (isPrecedentInjectionEnabled()) {
      const results = await getPrecedents(`Trade em ${symbol}`, 3);
      if (results && results.length > 0) {
        precedents = results
          .map(
            (r) =>
              `- [${r.outcome} | conf ${Math.round((r.confidence ?? 0) * 100)}% | sim ${r.similarity ?? 0}] ${r.scenario}`
          )
          .join("\n");
      }
    }

    const result = await analyzeCryptoWithSwarm(
      symbol,
      name || symbol,
      price,
      change24h ?? 0,
      volume24h ?? 0,
      high24h ?? price,
      low24h ?? price,
      signalDurationMinutes ?? 5,
      precedents
    );

    // Validate & Sanitize structure before sending to frontend
    const validation = validateAndSanitizeSwarmResponse(result);

    // Grava a decisão no grafo Semantica (fire-and-forget; não bloqueia a resposta)
    let semanticaDecisionId: string | null = null;
    if (validation.sanitized) {
      const recorded = recordDecision(validation.sanitized).catch(() => null);
      // Espera no máximo 250ms pelo id para incluí-lo na resposta quando gravado rápido.
      semanticaDecisionId = await Promise.race([
        recorded,
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 250)),
      ]).then((id) => id ?? null);
      if (semanticaDecisionId) console.log(`[semantica] decisão gravada: ${semanticaDecisionId}`);
    }

    res.json({
      success: true,
      data: validation.sanitized,
      semanticaDecisionId,
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
app.post("/api/swarm/stream", swarmAnalyzeLimiter, validateSwarmBody, async (req, res) => {
  try {
    const { symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes } = req.body as SwarmBody;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const duration = signalDurationMinutes ?? 5;
    const parsedPrice = price;
    const parsedChange = change24h ?? 0;
    const parsedVol = volume24h ?? 0;
    const parsedHigh = high24h ?? price;
    const parsedLow = low24h ?? price;

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
    let precedents: string | undefined;
    if (isPrecedentInjectionEnabled()) {
      const results = await getPrecedents(`Trade em ${symbol}`, 3);
      if (results && results.length > 0) {
        precedents = results
          .map(
            (r) =>
              `- [${r.outcome} | conf ${Math.round((r.confidence ?? 0) * 100)}% | sim ${r.similarity ?? 0}] ${r.scenario}`
          )
          .join("\n");
      }
    }

    const result = await analyzeCryptoWithSwarm(
      symbol,
      name || symbol,
      parsedPrice,
      parsedChange,
      parsedVol,
      parsedHigh,
      parsedLow,
      duration,
      precedents
    );

    const validation = validateAndSanitizeSwarmResponse(result);
    const sanitizedResult = validation.sanitized;

    // Grava a decisão no grafo Semantica (fire-and-forget; não bloqueia o streaming)
    if (sanitizedResult) {
      void recordDecision(sanitizedResult).then((decisionId) => {
        if (decisionId) console.log(`[semantica] decisão gravada: ${decisionId}`);
      }).catch(() => {});
    }

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
app.get("/api/swarm/test", swarmTestLimiter, async (_req, res) => {
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

// Observabilidade: diagnóstico agregado das requisições (count, p50, p95, breakdown por rota)
app.get("/api/diagnostics", (_req, res) => {
  const windowMs = 15 * 60 * 1000;
  res.json({
    success: true,
    ...buildDiagnostics(requestLog, Date.now(), windowMs, DIAGNOSTICS_START_TIME),
  });
});

// --- Semantica Knowledge Graph (sidecar via SEMANTICA_BASE_URL) ---

// Status da integração (habilita a aba "knowledge" no frontend)
app.get("/api/knowledge/status", async (_req, res) => {
  const enabled = isSemanticaEnabled();
  const health = await checkSemanticaHealth();
  res.json({ success: true, enabled, health });
});

// Lista decisões gravadas (opcional: ?symbol= & limit=)
app.get("/api/knowledge/decisions", async (req, res) => {
  const symbol = (req.query.symbol as string) || undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 500);
  const data = await listDecisions(symbol, limit);
  if (!data) return res.json({ success: false, disabled: true });
  res.json({ success: true, data });
});

// Precedentes similares por símbolo (usado pelo painel e pela injeção de precedentes)
app.get("/api/knowledge/precedents", async (req, res) => {
  const symbol = (req.query.symbol as string) || "";
  if (!symbol) {
    return res.status(400).json({ success: false, error: "Parâmetro 'symbol' é obrigatório" });
  }
  const data = await getPrecedents(`Trade em ${symbol}`, 5);
  if (!data) return res.json({ success: false, disabled: true });
  res.json({ success: true, data });
});

// Proveniência: cadeia causal de uma decisão (?id=)
app.get("/api/knowledge/provenance", async (req, res) => {
  const id = (req.query.id as string) || "";
  if (!id) {
    return res.status(400).json({ success: false, error: "Parâmetro 'id' é obrigatório" });
  }
  const data = await getDecisionChain(id);
  if (!data) return res.json({ success: false, disabled: true });
  res.json({ success: true, data });
});

// Grava/atualiza um registro do diário de trades no grafo (memória dos agentes)
app.post("/api/knowledge/journal", (req, res) => {
  const parsed = journalBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Payload de diário inválido",
      details: parsed.error.flatten(),
    });
  }
  recordJournalEntry(parsed.data)
    .then((decisionId) => res.json({ success: true, decisionId }))
    .catch(() => res.json({ success: true, decisionId: null }));
});

// Estatísticas agregadas do grafo (nós, arestas, categorias, outcomes)
app.get("/api/knowledge/stats", async (_req, res) => {
  const data = await getGraphStats();
  if (!data) return res.json({ success: false, disabled: true });
  res.json({ success: true, data });
});

export default app;
