import { GoogleGenAI, Type } from "@google/genai";
import { SwarmAnalysisResult, TradeDecision, AgentReport } from "../types.js";
import { runDrQuantGraphEngine } from "./quantEngine.js";
import { runSofiaSentimentEngine, buildDegradedSentimentReport } from "./sentimentEngine.js";
import { runOrderBookSentinelEngine, fetchRealDepth } from "./orderbookEngine.js";
import { runWhaleTrackerApexEngine } from "./whaleEngine.js";
import { runAlphaZooEngine } from "./alphaZooEngine.js";
import { runRiskProtocolOfficerEngine } from "./riskEngine.js";
import { getCryptoKlines } from "./cryptoDataService.js";
import { getWhaleOverview } from "./whaleDataService.js";
import { computeWeightedVote } from "../lib/weightedVote.js";
import { computeReview, runReplay, summarizeForPrompt } from "./mirofishService.js";
import { runDeepSeekAgents } from "./deepseekService.js";
import {
  ALL_AGENT_IDS,
  DEEPSEEK_AGENT_IDS,
  GEMINI_AGENT_IDS,
  buildCommitteePrompt,
  degradedAgent,
  mergeAndOrderAgents,
  normalizeAgents,
} from "./committeePrompt.js";

type EngineSource = 'gemini' | 'deepseek' | 'hybrid' | 'fallback';

// Cadeia de modelos Gemini vigentes: se o primário for descontinuado pelo Google
// (ex.: gemini-2.5-flash "no longer available to new users"), o comitê tenta o
// próximo automaticamente em vez de degradar todos os agentes Gemini.
// Sobrescrevível por GEMINI_MODEL, aceitando uma lista separada por vírgula.
const DEFAULT_GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'];

function getGeminiModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_GEMINI_MODELS;
}

// Extrai um resumo curto do motivo de falha de um provedor para o agente degradado.
function shortReason(reason: unknown): string | undefined {
  if (reason instanceof Error) return reason.message;
  return undefined;
}

interface CommitteeMarketInput {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  signalDurationMinutes: number;
  precedents?: string;
  mirofishPromptSection?: string;
}

type SettleResult<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

// Resolve uma promise dentro de um orçamento: se estourar o tempo, devolve
// rejeitada com motivo honesto (usado no modo híbrido para não segurar a resposta).
async function settleWithBudget<T>(label: string, promise: Promise<T>, budgetMs: number): Promise<SettleResult<T>> {
  try {
    const value = await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} excedeu o orçamento híbrido de ${budgetMs}ms`)), budgetMs)
      ),
    ]);
    return { status: 'fulfilled', value };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

export async function analyzeCryptoWithSwarm(
  symbol: string,
  name: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  signalDurationMinutes: number = 5,
  precedents?: string
): Promise<SwarmAnalysisResult> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const hasGemini = !!geminiKey;
  const hasDeepseek = !!deepseekKey;

  // Revisão MiroFish: a simulação é consultada como SUPORTE — o veredito final
  // permanece sempre do comitê. A confiança exibida é ponderada (0.7 comitê + 0.3 sim).
  const mirofishSimulation = runReplay(symbol, { price, change24h });
  const mirofishPromptSection = summarizeForPrompt(symbol, { price, change24h });

  const finalizeWithMirofish = (result: SwarmAnalysisResult): SwarmAnalysisResult => {
    const review = computeReview(symbol, result.finalDecision, result.confidenceScore, { price, change24h }, mirofishSimulation);
    if (review) {
      result.mirofishReview = review;
      result.confidenceScore = review.blendedConfidence;
    }
    return result;
  };

  const common: CommitteeMarketInput = {
    symbol,
    name,
    price,
    change24h,
    volume24h,
    high24h,
    low24h,
    signalDurationMinutes,
    precedents,
    mirofishPromptSection: mirofishPromptSection || undefined,
  };

  // 1) HÍBRIDO — ambas as chaves presentes: Gemini (3 especialistas) + DeepSeek (3) em PARALELO.
  if (hasGemini && hasDeepseek) {
    // Orçamento global: a resposta nunca espera mais que HYBRID_BUDGET_MS pelos dois provedores.
    // O mais rápido responde na hora; o lento vira DEGRADADO com motivo honesto.
    const hybridBudgetMs = Number(process.env.HYBRID_BUDGET_MS) || 12000;
    const [g, d] = await Promise.all([
      settleWithBudget('Gemini', runGeminiAgents({ ...common, agentIds: GEMINI_AGENT_IDS }), hybridBudgetMs),
      settleWithBudget('DeepSeek', runDeepSeekAgents({ ...common, agentIds: DEEPSEEK_AGENT_IDS }), hybridBudgetMs),
    ]);

    // Degradação honesta por lado: provedor que falhou mantém seus agentes com peso reduzido.
    const geminiAgents = g.status === 'fulfilled'
      ? g.value
      : GEMINI_AGENT_IDS.map((id) => degradedAgent(id, 'gemini', shortReason(g.reason)));
    const deepseekAgents = d.status === 'fulfilled'
      ? d.value
      : DEEPSEEK_AGENT_IDS.map((id) => degradedAgent(id, 'deepseek', shortReason(d.reason)));

    if (g.status === 'fulfilled' || d.status === 'fulfilled') {
      const agents = mergeAndOrderAgents([...geminiAgents, ...deepseekAgents]);
      return finalizeWithMirofish(finalizeFromAgents(common, agents, 'hybrid'));
    }

    // Ambos falharam em paralelo → fallback local direto (evita re-tentativa em sequência).
    const fallbackResult = await fallbackSwarmAnalysis(symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes);
    return finalizeWithMirofish(fallbackResult);
  }

  // 2) APENAS GEMINI (ou Gemini como substituto após falha híbrida).
  if (hasGemini) {
    try {
      const agents = await runGeminiAgents({ ...common, agentIds: ALL_AGENT_IDS });
      return finalizeWithMirofish(finalizeFromAgents(common, mergeAndOrderAgents(agents), 'gemini'));
    } catch (err: any) {
      console.log(`[Gemini API] Notice (${err?.message || 'Model Unavailable'}). Tentando próximo provedor.`);
    }
  }

  // 3) APENAS DEEPSEEK (ou DeepSeek como substituto após falha híbrida).
  if (hasDeepseek) {
    try {
      const agents = await runDeepSeekAgents({ ...common, agentIds: ALL_AGENT_IDS });
      return finalizeWithMirofish(finalizeFromAgents(common, mergeAndOrderAgents(agents), 'deepseek'));
    } catch (err: any) {
      console.log(`[DeepSeek API] Notice (${err?.message || 'Model Unavailable'}). Utilizando modelo local.`);
    }
  }

  // 4) FALLBACK LOCAL — engines determinísticos com dados reais.
  const fallbackResult = await fallbackSwarmAnalysis(symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes);
  return finalizeWithMirofish(fallbackResult);
}

// GEMINI ------------------------------------------------------------------

async function runGeminiAgents(params: CommitteeMarketInput & { agentIds: typeof ALL_AGENT_IDS[number][] }): Promise<AgentReport[]> {
  // Failover de chaves: primária (GEMINI_API_KEY) e, em falha, backup (GEMINI_API_KEY_BACKUP).
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter((k): k is string => !!k);
  if (!keys.length) throw new Error('GEMINI_API_KEY não configurada');

  const clients = keys.map((apiKey) => new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  }));

  const prompt = buildCommitteePrompt({ ...params, providerLabel: 'Gemini' });
  // Uma tentativa por chave: 1ª = primária, 2ª = backup (se configurada).
  const parsed = await callGeminiWithRetry(clients, prompt, COMMITTEE_RESPONSE_SCHEMA, keys.length);
  const agents = normalizeAgents(parsed?.agents, 'gemini', params.agentIds);

  // Garante cobertura completa dos agentes solicitados (LLM pode omitir algum).
  const present = new Set(agents.map((a) => a.agentId));
  for (const id of params.agentIds) {
    if (!present.has(id)) agents.push(degradedAgent(id, 'gemini'));
  }

  return agents;
}

const COMMITTEE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    finalDecision: { type: Type.STRING },
    confidenceScore: { type: Type.NUMBER },
    agents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          agentId: { type: Type.STRING },
          agentName: { type: Type.STRING },
          agentRole: { type: Type.STRING },
          opinion: { type: Type.STRING },
          score: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          veto: { type: Type.BOOLEAN },
          vetoReason: { type: Type.STRING },
          keyMetrics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                status: { type: Type.STRING },
              },
            },
          },
          signals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  },
};

async function callGeminiWithRetry(clients: GoogleGenAI[], prompt: string, schema: any, retries = 2): Promise<any> {
  const models = getGeminiModels();
  const modelErrors: string[] = [];

  for (const model of models) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      // Rotaciona a chave a cada tentativa: primária primeiro, backup nas próximas.
      const client = clients[(attempt - 1) % clients.length];
      try {
        // 30.0 second timeout to accommodate structured JSON generation under normal load
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API request timed out')), 30000)
        );

        const apiPromise = client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });

        const response = (await Promise.race([apiPromise, timeoutPromise])) as any;

        if (response && response.text) {
          return cleanAndParseJson(response.text);
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isDeprecated =
          errMsg.includes('no longer available') ||
          errMsg.includes('NOT_FOUND') ||
          errMsg.includes('404') ||
          errMsg.includes('deprecated') ||
          (errMsg.includes('models/') && errMsg.includes('not found'));

        if (isDeprecated) {
          // Modelo descontinuado pelo provedor → tenta o próximo da cadeia na hora.
          modelErrors.push(`${model}: ${errMsg.split('\n')[0].slice(0, 140)}`);
          break;
        }

        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('resource exhausted') ||
          errMsg.includes('429') ||
          errMsg.includes('timeout') ||
          errMsg.includes('timed out');

        if (attempt < retries) {
          // Falha em qualquer chave → tenta a próxima. Backoff apenas em erro transitório.
          if (isTransient) await new Promise((res) => setTimeout(res, 300 * attempt));
          continue;
        }
        // Tentativas esgotadas neste modelo → passa para o próximo da cadeia.
        modelErrors.push(`${model}: ${errMsg.split('\n')[0].slice(0, 140)}`);
        break;
      }
    }
  }

  const detail = modelErrors.length ? ` — ${modelErrors.join(' | ')}` : '';
  throw new Error(`Gemini não retornou resposta válida para nenhum modelo da cadeia.${detail}`);
}

// CONSOLIDADOR DETERMINÍSTICO -------------------------------------------------

// Consolida os 6 pareceres dos agentes (Gemini e/ou DeepSeek) no veredito final
// via votação ponderada (computeWeightedVote) + regras de duração/risco do fallback.
function finalizeFromAgents(common: CommitteeMarketInput, agents: AgentReport[], engineSource: EngineSource): SwarmAnalysisResult {
  const now = Date.now();
  const { symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes } = common;

  const riskAgent = agents.find((a) => a.agentId === 'risk');
  const vetoed = riskAgent?.veto === true;
  const vetoReason = riskAgent?.vetoReason;

  const weightedVote = computeWeightedVote(agents, vetoed);
  const decision = weightedVote.decision;
  const isNeutral = decision === 'AGUARDAR / NEUTRO';

  const { evaluatedDuration, durationReason } = computeDurationAndJustification({
    symbol,
    price,
    change24h,
    volume24h,
    high24h,
    low24h,
    durationMinutes: signalDurationMinutes,
    isNeutral,
    vetoed,
    vetoReason,
    buyWeight: weightedVote.buyWeight,
    sellWeight: weightedVote.sellWeight,
  });

  const providerLabel = engineSource === 'hybrid' ? 'Gemini + DeepSeek' : engineSource === 'deepseek' ? 'DeepSeek' : engineSource === 'gemini' ? 'Gemini' : 'Local';
  const fmtWeight = (w: number) => (Number.isInteger(w) ? w.toString() : w.toFixed(1));
  const buyWeight = weightedVote.buyWeight;
  const sellWeight = weightedVote.sellWeight;

  const entry = price;
  const stop = price * (decision === 'COMPRAR' ? 0.985 : decision === 'VENDER' ? 1.015 : 1);
  const tp = price * (decision === 'COMPRAR' ? 1.03 : decision === 'VENDER' ? 0.97 : 1);

  const reasoningNotes = [
    `Quórum ponderado dos Especialistas: ${fmtWeight(buyWeight)} Compras | ${fmtWeight(sellWeight)} Vendas | Peso total ${fmtWeight(weightedVote.totalWeight)} | Decisão ${decision}.`,
    `Inferência por IA (${providerLabel}) sobre dados reais de mercado: preço spot, variação 24h e amplitude intraday.`,
    ...agents.slice(0, 6).map((a) => `${a.agentName} [${a.score}]: ${(a.summary || '').split('.')[0] || 'Sem detalhes fornecidos'}.`),
  ];

  const summaryConsensus = isNeutral
    ? vetoed
      ? `O Comitê Vibe-Trading VETOU a operação em ${symbol}${vetoReason ? `: ${vetoReason}` : ''}. NÃO ABRIR posições.`
      : `O Comitê Vibe-Trading concluiu por AGUARDAR / NEUTRO em ${symbol}. O mercado apresenta incerteza/consolidação, recomendando NÃO ABRIR posições.`
    : `O Comitê Vibe-Trading aprovou ${decision} em ${symbol} com peso de quórum ${fmtWeight(Math.max(buyWeight, sellWeight))}/${fmtWeight(weightedVote.totalWeight)} via inferência ${providerLabel}.`;

  return {
    assetSymbol: symbol,
    assetName: name,
    assetPrice: price,
    timestamp: now,
    engineSource,
    finalDecision: decision,
    confidenceScore: Math.round(weightedVote.confidenceScore),
    signalDurationMinutes: isNeutral ? 0 : signalDurationMinutes,
    recommendedDurationMinutes: evaluatedDuration,
    durationJustification: durationReason,
    expiryTimestamp: now + evaluatedDuration * 60 * 1000,
    entryTarget: Number(entry.toFixed(4)),
    stopLoss: Number(stop.toFixed(4)),
    takeProfit: Number(tp.toFixed(4)),
    riskRewardRatio: isNeutral ? 'N/A (NEUTRO)' : '1:2.0',
    summaryConsensus,
    reasoningNotes,
    agents,
  };
}

// Regras determinísticas de duração segura (compartilhadas com o fallback local).
function computeDurationAndJustification(params: {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  durationMinutes: number;
  isNeutral: boolean;
  vetoed: boolean;
  vetoReason?: string;
  buyWeight: number;
  sellWeight: number;
}): { evaluatedDuration: number; durationReason: string } {
  const { symbol, price, change24h, volume24h, high24h, low24h, durationMinutes, isNeutral, vetoed, vetoReason, buyWeight, sellWeight } = params;
  const priceSpreadPct = price > 0 ? ((high24h - low24h) / price) * 100 : 0;
  const isHighVolume = volume24h > 150000000;
  const isStrongTrend = Math.abs(change24h) >= 2.0;
  const fmtWeight = (w: number) => (Number.isInteger(w) ? w.toString() : w.toFixed(1));

  if (isNeutral) {
    return {
      evaluatedDuration: 0,
      durationReason: vetoed
        ? `Comitê definiu 0 minutos de permanência devido ao VETO do Risk Officer${vetoReason ? ` (${vetoReason})` : ''}.`
        : `Comitê definiu 0 minutos de permanência pois o quórum ponderado mínimo (2/3 do peso total) não foi alcançado (${fmtWeight(buyWeight)} Compras / ${fmtWeight(sellWeight)} Vendas).`,
    };
  }

  if (priceSpreadPct > 4.5 || Math.abs(change24h) > 6.0) {
    const d = durationMinutes <= 3 ? 1 : 3;
    return {
      evaluatedDuration: d,
      durationReason: `Comitê reduziu a permanência para ${d}m (Micro-Scalp): A alta volatilidade e amplitude intraday (${priceSpreadPct.toFixed(1)}%) aumentam o risco de exaustão da kline. O trader deve realizar o lucro rápido antes de uma reação contrária.`,
    };
  }

  if (isHighVolume && isStrongTrend && priceSpreadPct <= 3.8) {
    const d = durationMinutes < 10 ? 10 : 15;
    return {
      evaluatedDuration: d,
      durationReason: `Comitê aprovou a extensão do tempo seguro para ${d}m: O volume expressivo ($${(volume24h / 1e6).toFixed(0)}M) acompanhado de tendência firme e volatilidade controlada (${priceSpreadPct.toFixed(1)}%) comprovam sustentação sólida para alcançar o Take Profit sem risco prematuro.`,
    };
  }

  return {
    evaluatedDuration: durationMinutes,
    durationReason: `Comitê ratificou a janela operacional de ${durationMinutes}m: As condições de volume ($${(volume24h / 1e6).toFixed(0)}M) e estrutura gráfica ajustam-se perfeitamente a esta exposição.`,
  };
}

// FALLBACK LOCAL ---------------------------------------------------------------

async function fallbackSwarmAnalysis(
  symbol: string,
  name: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  durationMinutes: number
): Promise<SwarmAnalysisResult> {
  const now = Date.now();

  // Deadline para feeds externos: degrada honesto em vez de deixar o swarm lento.
  const deadlineMs = 1500;
  const withDeadline = <T>(promise: Promise<T>): Promise<T | null> =>
    Promise.race([
      promise.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), deadlineMs)),
    ]);

  const [klines, sentimentRes, depth, whaleSnapshot] = await Promise.all([
    withDeadline(getCryptoKlines(symbol, '15m', 40)),
    withDeadline(runSofiaSentimentEngine(symbol, price, change24h, volume24h, high24h, low24h)),
    withDeadline(fetchRealDepth(symbol)),
    withDeadline(getWhaleOverview()),
  ]);

  const klinesSafe = klines ?? [];
  const sofiaSentiment = sentimentRes ?? buildDegradedSentimentReport(symbol);

  const drQuant = runDrQuantGraphEngine(symbol, price, change24h, volume24h, high24h, low24h, klinesSafe);
  const orderbookSentinel = await runOrderBookSentinelEngine(symbol, price, change24h, volume24h, high24h, low24h, klinesSafe, depth);
  const whaleApex = runWhaleTrackerApexEngine(symbol, price, change24h, volume24h, high24h, low24h, whaleSnapshot);
  const alphaZoo = runAlphaZooEngine(symbol, price, change24h, volume24h, high24h, low24h, klinesSafe);

  const preliminaryDirection: TradeDecision = change24h > 0.5 ? 'COMPRAR' : change24h < -2.0 ? 'VENDER' : 'AGUARDAR / NEUTRO';
  const riskOfficer = runRiskProtocolOfficerEngine(symbol, price, change24h, volume24h, high24h, low24h, klinesSafe, preliminaryDirection);

  const allAgents = [
    drQuant.report,
    sofiaSentiment.report,
    orderbookSentinel.report,
    whaleApex.report,
    alphaZoo.report,
    riskOfficer.report,
  ];

  const weightedVote = computeWeightedVote(allAgents, !!riskOfficer.summary.isVetoedByRiskOfficer);
  const buyVotes = weightedVote.buyWeight;
  const sellVotes = weightedVote.sellWeight;
  const decision: TradeDecision = weightedVote.decision;

  const isNeutral = decision === 'AGUARDAR / NEUTRO';
  const confidence = weightedVote.confidenceScore;

  const entry = price;
  const stop = riskOfficer.summary.technicalStopLossUSD;
  const tp = riskOfficer.summary.takeProfitTargetUSD;

  const { evaluatedDuration, durationReason } = computeDurationAndJustification({
    symbol,
    price,
    change24h,
    volume24h,
    high24h,
    low24h,
    durationMinutes,
    isNeutral,
    vetoed: !!riskOfficer.summary.isVetoedByRiskOfficer,
    vetoReason: riskOfficer.summary.vetoReason,
    buyWeight: buyVotes,
    sellWeight: sellVotes,
  });

  const fmtWeight = (w: number) => (Number.isInteger(w) ? w.toString() : w.toFixed(1));

  return {
    assetSymbol: symbol,
    assetName: name,
    assetPrice: price,
    timestamp: now,
    engineSource: 'fallback',
    finalDecision: decision,
    confidenceScore: Math.round(confidence),
    signalDurationMinutes: isNeutral ? 0 : durationMinutes,
    recommendedDurationMinutes: evaluatedDuration,
    durationJustification: durationReason,
    expiryTimestamp: now + evaluatedDuration * 60 * 1000,
    entryTarget: Number(entry.toFixed(4)),
    stopLoss: Number(stop.toFixed(4)),
    takeProfit: Number(tp.toFixed(4)),
    riskRewardRatio: isNeutral ? 'N/A (NEUTRO)' : `1:${riskOfficer.summary.riskRewardRatio}`,
    summaryConsensus: isNeutral
      ? `O Comitê Vibe-Trading concluiu por AGUARDAR / NEUTRO em ${symbol}. ${riskOfficer.summary.isVetoedByRiskOfficer ? riskOfficer.summary.vetoReason : 'Quórum insuficiente de especialistas (requerido >= 4/6).'}`
      : `O Comitê Vibe-Trading aprovou ${decision} em ${symbol} com peso de quórum ${fmtWeight(Math.max(buyVotes, sellVotes))}/${fmtWeight(weightedVote.totalWeight)} e sinal verde do Risk Protocol Officer.`,
    reasoningNotes: [
      `Quórum ponderado dos Especialistas: ${fmtWeight(buyVotes)} Compras | ${fmtWeight(sellVotes)} Vendas | Peso total ${fmtWeight(weightedVote.totalWeight)} | Quórum Mínimo: 2/3 do peso (${decision}).`,
      `Dr. Quant Graph: ${drQuant.summary.confluenceCount} sinais confluentes (${drQuant.summary.candlestickPattern}).`,
      `Sofia Sentiment: Fear & Greed ${sofiaSentiment.summary.fearAndGreedCurrent ?? 'n/d'}/100 | Funding Rate: ${sofiaSentiment.summary.fundingRateBinancePercent ?? 'n/d'}% (${sofiaSentiment.summary.fundingRateStatus}).`,
      `OrderBook Sentinel: ${orderbookSentinel.summary ? `OBI L2 de ${orderbookSentinel.summary.orderBookImbalanceRatio > 0 ? '+' : ''}${orderbookSentinel.summary.orderBookImbalanceRatio} | Delta Vol $${(orderbookSentinel.summary.deltaVolumeNetUsd / 1e6).toFixed(1)}M | POC $${orderbookSentinel.summary.pocPriceUsd}.` : 'Book L2 indisponível (sem dados fabricados).'}`,
      `Whale Tracker Apex: ${whaleApex.summary ? `Net Flow $${(whaleApex.summary.netFlow24hUsd / 1e6).toFixed(1)}M | Buy/Sell $${(whaleApex.summary.buyVolume24hUsd / 1e6).toFixed(1)}M / $${(whaleApex.summary.sellVolume24hUsd / 1e6).toFixed(1)}M | Whale Index ${whaleApex.summary.whaleIndexScore ?? 'n/d'}.` : 'Dados on-chain indisponíveis (sem dados fabricados).'}`,
      `Alpha Zoo Engine: Regime HMM (${alphaZoo.summary.marketRegime.regimeType.split(' ')[0]}) | Backtest real Win Rate ${alphaZoo.summary.walkForwardWinRate90d}% (Pós-Taxas 0.10%).`,
      `Risk Protocol Officer: RRR 1:${riskOfficer.summary.riskRewardRatio} | Half-Kelly ${riskOfficer.summary.fractionalKellyPositionSizePercent}% ($${riskOfficer.summary.recommendedCapitalAllocationUSD}) | VaR 95% ${riskOfficer.summary.var95Percent}% | Veto Status: ${riskOfficer.summary.isVetoedByRiskOfficer ? '🛑 VETADO' : '✅ APROVADO'}.`,
    ],
    agents: allAgents.map((a) => ({ ...a, provider: 'local' as const })),
  };
}

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSub);
    }
    throw err;
  }
}
