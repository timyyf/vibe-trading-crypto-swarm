import { AgentReport, TradeDecision, KeyMetric } from '../types.js';

export interface SentimentAnalysisSummary {
  fearAndGreedCurrent: number | null;
  fearAndGreedClassification: string;
  fundingRateBinancePercent: number | null;
  fundingRateStatus: 'Longs Pagando Shorts (Eufria)' | 'Shorts Pagando Longs (Medo/Squeeze)' | 'Neutro Equilibrado' | 'Não monitorado';
  compositeScore: number; // 0-100
  opinion: TradeDecision;
  realData: boolean;
}

interface FearGreedApiResponse {
  data?: { value: string; value_classification: string }[];
}

interface FundingApiResponse {
  lastFundingRate?: string;
}

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (_err) {
    clearTimeout(timeout);
    return null;
  }
}

// Fear & Greed Index real (alternative.me — sem chave)
export async function fetchFearAndGreed(): Promise<{ value: number; classification: string } | null> {
  const json = await fetchJson<FearGreedApiResponse>('https://api.alternative.me/fng/?limit=1');
  const entry = json?.data?.[0];
  const value = entry ? parseFloat(entry.value) : NaN;
  if (!entry || Number.isNaN(value)) return null;
  return { value: Math.round(value), classification: entry.value_classification || 'Neutro' };
}

// Funding Rate real (Binance futures — best-effort; pode ser geo-bloqueado)
export async function fetchFundingRate(symbol: string): Promise<number | null> {
  const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
  const json = await fetchJson<FundingApiResponse>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`);
  const rate = json ? parseFloat(json.lastFundingRate ?? '') : NaN;
  if (json === null || Number.isNaN(rate)) return null;
  return Number((rate * 100).toFixed(4)); // em %
}

/**
 * Sofia Sentiment — Sentimento de mercado REAL:
 * Fear & Greed (alternative.me) + Funding Rate (Binance futures).
 * Métricas sociais (FinBERT/Google Trends/Reddit) são removidas — sem fonte pública
 * gratuita, então exibimos 'não monitorado' em vez de inventar números.
 */
export async function runSofiaSentimentEngine(
  symbol: string,
  _price: number,
  _change24h: number,
  _volume24h: number,
  _high24h: number,
  _low24h: number
): Promise<{ report: AgentReport; summary: SentimentAnalysisSummary }> {
  const [fg, funding] = await Promise.all([
    fetchFearAndGreed(),
    fetchFundingRate(symbol),
  ]);

  const fearAndGreedCurrent = fg?.value ?? null;
  const fearAndGreedClassification = fg?.classification ?? 'Não monitorado';

  const fundingRateBinancePercent = funding;
  let fundingStatus: SentimentAnalysisSummary['fundingRateStatus'] = 'Não monitorado';
  if (funding !== null) {
    if (funding > 0.015) fundingStatus = 'Longs Pagando Shorts (Eufria)';
    else if (funding < -0.005) fundingStatus = 'Shorts Pagando Longs (Medo/Squeeze)';
    else fundingStatus = 'Neutro Equilibrado';
  }

  // Score composto apenas sobre métricas reais disponíveis
  let compositeScore = 50;
  if (fearAndGreedCurrent !== null) compositeScore += (fearAndGreedCurrent - 50) * 0.4;
  if (fundingStatus === 'Shorts Pagando Longs (Medo/Squeeze)') compositeScore += 10;
  if (fundingStatus === 'Longs Pagando Shorts (Eufria)') compositeScore -= 6;

  const finalScore = Math.min(98, Math.max(12, Math.round(compositeScore)));

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (finalScore >= 62) decision = 'COMPRAR';
  else if (finalScore <= 38) decision = 'VENDER';

  const hasRealData = fearAndGreedCurrent !== null || funding !== null;

  const signalsList: string[] = [];
  if (fearAndGreedCurrent !== null) {
    signalsList.push(`Fear & Greed Index real em ${fearAndGreedCurrent}/100 (${fearAndGreedClassification}).`);
  } else {
    signalsList.push('Fear & Greed Index: fonte indisponível no momento.');
  }
  if (funding !== null) {
    signalsList.push(`Funding Rate real de perpétuos em ${funding > 0 ? '+' : ''}${funding}% (${fundingStatus}).`);
  } else {
    signalsList.push('Funding Rate: fonte indisponível (Binance futures não respondeu).');
  }
  signalsList.push('Métricas sociais (FinBERT/Google Trends/Reddit): não monitoradas — sem fonte pública gratuita.');

  const keyMetrics: KeyMetric[] = [
    {
      label: 'Fear & Greed Index (real)',
      value: fearAndGreedCurrent !== null ? `${fearAndGreedCurrent}/100 (${fearAndGreedClassification})` : 'Não monitorado',
      status: fearAndGreedCurrent !== null
        ? (fearAndGreedCurrent > 55 ? 'positive' : fearAndGreedCurrent < 40 ? 'negative' : 'neutral')
        : 'neutral',
    },
    {
      label: 'Funding Rate (Binance 8h)',
      value: funding !== null ? `${funding > 0 ? '+' : ''}${funding}% (${fundingStatus.split(' ')[0]})` : 'Não monitorado',
      status: funding !== null ? (funding > 0 ? 'positive' : 'negative') : 'neutral',
    },
    {
      label: 'Sentimento Social / NLP',
      value: 'Não monitorado (sem fonte real)',
      status: 'neutral',
    },
    {
      label: 'Google Trends',
      value: 'Não monitorado (sem fonte real)',
      status: 'neutral',
    },
  ];

  const report: AgentReport = {
    agentId: 'sentiment',
    agentName: 'Sofia Sentiment',
    agentRole: 'Head de Sentimento de Mercado & Psicologia',
    specialistType: 'Analista de Sentimento',
    avatarIcon: 'MessageSquare',
    opinion: decision,
    score: finalScore,
    summary: hasRealData
      ? `Sentimento de mercado real: Fear & Greed ${fearAndGreedCurrent !== null ? `${fearAndGreedCurrent}/100 (${fearAndGreedClassification})` : 'indisponível'} e Funding Rate ${funding !== null ? `${funding}%` : 'indisponível'}. Métricas sociais não monitoradas (sem fonte pública gratuita).`
      : `Sentimento: fontes reais indisponíveis no momento. Nenhum número fabricado é exibido.`,
    keyMetrics,
    signals: signalsList.slice(0, 4),
    processingTimeMs: Date.now() % 1000,
    status: hasRealData ? 'CONCLUÍDO' : 'DEGRADADO',
  };

  const summaryObj: SentimentAnalysisSummary = {
    fearAndGreedCurrent,
    fearAndGreedClassification,
    fundingRateBinancePercent: funding,
    fundingRateStatus: fundingStatus,
    compositeScore: finalScore,
    opinion: decision,
    realData: hasRealData,
  };

  return { report, summary: summaryObj };
}
