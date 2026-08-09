import { AgentReport, TradeDecision, KeyMetric, WhaleOverview } from '../types.js';

export interface WhaleOnChainAnalysisSummary {
  netFlow24hUsd: number;
  buyVolume24hUsd: number;
  sellVolume24hUsd: number;
  trackedWallets: number;
  activeWallets24h: number;
  whaleIndexScore: number | null;
  whaleIndexClassification: string;
  topTokens: { symbol: string; netFlowUsd: number; volumeUsd: number }[];
  compositeScore: number;
  opinion: TradeDecision;
  realData: boolean;
  source: string;
  scope: string;
}

/**
 * Whale Tracker Apex — Inteligência on-chain REAL (Deep Blue Alpha).
 * Usa os agregados públicos (stats, whale-index, top-tokens).
 * Se o snapshot não estiver disponível, reporta DEGRADADO sem inventar números.
 */
export function runWhaleTrackerApexEngine(
  symbol: string,
  _price: number,
  change24h: number,
  _volume24h: number,
  _high24h: number,
  _low24h: number,
  realSnapshot: WhaleOverview | null
): { report: AgentReport; summary: WhaleOnChainAnalysisSummary | null } {
  if (!realSnapshot) {
    const degradedReport: AgentReport = {
      agentId: 'whales',
      agentName: 'Whale Tracker Apex',
      agentRole: 'Head de Inteligência On-Chain',
      specialistType: 'Fundamentalista',
      avatarIcon: 'ShieldAlert',
      opinion: 'AGUARDAR / NEUTRO',
      score: 50,
      summary: `Dados on-chain reais indisponíveis no momento (fonte Deep Blue Alpha não respondeu). Nenhum fluxo de baleias fabricado é exibido.`,
      keyMetrics: [
        { label: 'Fonte On-Chain', value: 'Indisponível', status: 'negative' },
        { label: 'Escopo', value: 'Ethereum', status: 'neutral' },
      ],
      signals: ['Sem dados de baleias no momento.'],
      processingTimeMs: Date.now() % 1000,
      status: 'DEGRADADO',
    };
    return { report: degradedReport, summary: null };
  }

  const { stats, index, topTokens, source, scope } = realSnapshot;
  const netFlow24hUsd = stats.netFlow24h;
  const buyVolume24hUsd = stats.buyVolume24h;
  const sellVolume24hUsd = stats.sellVolume24h;

  // Score composto real
  let compositeScore = 50;
  if (netFlow24hUsd > 0) compositeScore += 18;
  else compositeScore -= 18;
  if (buyVolume24hUsd > sellVolume24hUsd * 1.2) compositeScore += 8;
  if (index.current >= 55) compositeScore += 10;
  else if (index.current <= 45) compositeScore -= 10;

  const finalScore = Math.min(98, Math.max(12, Math.round(compositeScore)));

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (finalScore >= 62) decision = 'COMPRAR';
  else if (finalScore <= 38) decision = 'VENDER';

  const buyShare = buyVolume24hUsd + sellVolume24hUsd > 0
    ? (buyVolume24hUsd / (buyVolume24hUsd + sellVolume24hUsd)) * 100
    : 0;

  const relevantToken = topTokens.find((t) => t.symbol === symbol) ?? topTokens[0];

  const signalsList: string[] = [];
  signalsList.push(`Net Flow on-chain 24h real: $${(netFlow24hUsd / 1e6).toFixed(1)}M (${netFlow24hUsd >= 0 ? 'inflow / acumulação' : 'outflow / distribuição'}).`);
  signalsList.push(`Buy vs Sell 24h real: $${(buyVolume24hUsd / 1e6).toFixed(1)}M compras (${buyShare.toFixed(0)}% do fluxo) vs $${(sellVolume24hUsd / 1e6).toFixed(1)}M vendas.`);
  signalsList.push(`Whale Sentiment Index real: ${index.current}/100 (${index.classification}) — ${stats.activeWallets24h} carteiras ativas em 24h.`);
  if (relevantToken) {
    signalsList.push(`Top token ${relevantToken.symbol}: volume $${(relevantToken.volumeUsd / 1e6).toFixed(2)}M | net flow $${(relevantToken.netFlowUsd / 1e6).toFixed(2)}M.`);
  }

  const keyMetrics: KeyMetric[] = [
    {
      label: 'Net Flow 24h (On-Chain)',
      value: `${netFlow24hUsd >= 0 ? '+' : ''}$${(netFlow24hUsd / 1e6).toFixed(1)}M (${netFlow24hUsd >= 0 ? 'Inflow' : 'Outflow'})`,
      status: netFlow24hUsd >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Buy / Sell Volume 24h',
      value: `$${(buyVolume24hUsd / 1e6).toFixed(0)}M / $${(sellVolume24hUsd / 1e6).toFixed(0)}M`,
      status: buyShare >= 50 ? 'positive' : 'negative',
    },
    {
      label: 'Whale Sentiment Index',
      value: `${index.current}/100 (${index.classification})`,
      status: index.current >= 55 ? 'positive' : index.current <= 45 ? 'negative' : 'neutral',
    },
    {
      label: 'Carteiras Rastreadas',
      value: `${stats.trackedWallets.toLocaleString()} (${stats.activeWallets24h.toLocaleString()} ativas 24h)`,
      status: 'neutral',
    },
    {
      label: 'Escopo On-Chain',
      value: scope,
      status: 'neutral',
    },
  ];

  const report: AgentReport = {
    agentId: 'whales',
    agentName: 'Whale Tracker Apex',
    agentRole: 'Head de Inteligência On-Chain',
    specialistType: 'Fundamentalista',
    avatarIcon: 'ShieldAlert',
    opinion: decision,
    score: finalScore,
    summary: `Análise on-chain real (${source}, ${scope}): Net Flow 24h de $${(netFlow24hUsd / 1e6).toFixed(1)}M. Buy/Sell: $${(buyVolume24hUsd / 1e6).toFixed(1)}M / $${(sellVolume24hUsd / 1e6).toFixed(1)}M. Whale Index ${index.current}/100.`,
    keyMetrics,
    signals: signalsList.slice(0, 4),
    processingTimeMs: Date.now() % 1000,
    status: 'CONCLUÍDO',
  };

  const summaryObj: WhaleOnChainAnalysisSummary = {
    netFlow24hUsd,
    buyVolume24hUsd,
    sellVolume24hUsd,
    trackedWallets: stats.trackedWallets,
    activeWallets24h: stats.activeWallets24h,
    whaleIndexScore: index.current,
    whaleIndexClassification: index.classification,
    topTokens: topTokens.map((t) => ({ symbol: t.symbol, netFlowUsd: t.netFlowUsd, volumeUsd: t.volumeUsd })),
    compositeScore: finalScore,
    opinion: decision,
    realData: true,
    source,
    scope,
  };

  return { report, summary: summaryObj };
}

// Mantém a assinatura anterior para compatibilidade de chamada (dados reais via snapshot)
export async function runWhaleTrackerApexEngineAsync(
  symbol: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  realSnapshot: WhaleOverview | null
): Promise<{ report: AgentReport; summary: WhaleOnChainAnalysisSummary | null }> {
  return runWhaleTrackerApexEngine(symbol, price, change24h, volume24h, high24h, low24h, realSnapshot);
}
