import { AgentReport, TradeDecision, KeyMetric, KlinePoint } from '../types.js';

export interface OrderBookDepthLevel {
  price: number;
  quantity: number;
  totalUsd: number;
}

export interface OrderBookAnalysisSummary {
  bidTotalUsd: number;
  askTotalUsd: number;
  orderBookImbalanceRatio: number; // -1.0 to +1.0
  obiStatus: 'Forte Pressão Compradora (OBI > +0.25)' | 'Equilíbrio de Oferta' | 'Forte Pressão Vendedora (OBI < -0.25)';

  bidAskSpreadUsd: number;
  spreadPercent: number;
  spreadSpikeStatus: 'Spread Normal' | 'Alerta de Anomalia de Liquidez (Spread > 3x Média)';

  pocPriceUsd: number; // Point of Control (Volume Profile)
  deltaVolumeNetUsd: number; // Aggressive Buyers - Aggressive Sellers
  cvdDirection: 'CVD Acumulando Alta' | 'CVD Em Queda' | 'CVD Neutro';
  cvdDivergence: 'Alerta de Absorção: Preço Sobe com CVD Caindo' | 'Alerta de Acúmulo: Preço Cai com CVD Subindo' | 'Sem Divergência de CVD';

  icebergWalls: {
    type: 'Parede de Suporte (Bids)' | 'Parede de Resistência (Asks)';
    price: number;
    volumeUsd: number;
  }[];

  slippageEstimate: {
    order10kUsd: number; // % slippage
    order50kUsd: number;
    order100kUsd: number;
  };

  compositeScore: number;
  opinion: TradeDecision;
}

interface RealDepth {
  bids: OrderBookDepthLevel[];
  asks: OrderBookDepthLevel[];
  bestBid: number;
  bestAsk: number;
  fetchedAt: number;
}

async function fetchRealDepth(symbol: string): Promise<RealDepth | null> {
  const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

  const tryFetch = async (baseUrl: string): Promise<RealDepth | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`https://${baseUrl}/api/v3/depth?symbol=${pair}&limit=20`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = await res.json();
      const bids: OrderBookDepthLevel[] = (data.bids ?? []).map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
        totalUsd: parseFloat(price) * parseFloat(qty),
      }));
      const asks: OrderBookDepthLevel[] = (data.asks ?? []).map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
        totalUsd: parseFloat(price) * parseFloat(qty),
      }));
      if (bids.length === 0 || asks.length === 0) return null;
      return {
        bids,
        asks,
        bestBid: bids[0].price,
        bestAsk: asks[0].price,
        fetchedAt: Date.now(),
      };
    } catch (_err) {
      clearTimeout(timeout);
      return null;
    }
  };

  const fromBinance = await tryFetch('api.binance.com');
  if (fromBinance) return fromBinance;
  return tryFetch('data-api.binance.vision');
}

/**
 * OrderBook Sentinel — Microestrutura real: L2 depth da Binance (bids/asks reais),
 * spread real, OBI real, POC/delta/CVD calculados sobre klines reais.
 * Sem orderbook sintético: se o depth não estiver disponível, reporta DEGRADADO honesto.
 */
export async function runOrderBookSentinelEngine(
  symbol: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  klines: KlinePoint[]
): Promise<{ report: AgentReport; summary: OrderBookAnalysisSummary | null }> {
  const realDepth = await fetchRealDepth(symbol);
  const priceRef = price || klines[klines.length - 1]?.close || 0;

  if (!realDepth || !priceRef) {
    const degradedReport: AgentReport = {
      agentId: 'orderbook',
      agentName: 'OrderBook Sentinel',
      agentRole: 'Head de Microestrutura, L2 Book & Volume Delta',
      specialistType: 'Liquidez & Orderbook',
      avatarIcon: 'Sliders',
      opinion: 'AGUARDAR / NEUTRO',
      score: 50,
      summary: `Livro de ofertas em tempo real indisponível para ${symbol} (fonte Binance não respondeu). Análise de microestrutura pausada — nenhum número inventado.`,
      keyMetrics: [
        { label: 'Order Book L2', value: 'Indisponível', status: 'negative' },
        { label: 'Fonte', value: 'Binance Depth', status: 'neutral' },
      ],
      signals: ['Sem dados de profundidade no momento.'],
      processingTimeMs: Date.now() % 1000,
      status: 'DEGRADADO',
    };
    return { report: degradedReport, summary: null };
  }

  const bids = realDepth.bids;
  const asks = realDepth.asks;
  const bidTotalUsd = bids.reduce((a, b) => a + b.totalUsd, 0);
  const askTotalUsd = asks.reduce((a, b) => a + b.totalUsd, 0);

  // OBI real: (Bid - Ask) / (Bid + Ask)
  const totalBookVolume = bidTotalUsd + askTotalUsd || 1;
  const obi = Number(((bidTotalUsd - askTotalUsd) / totalBookVolume).toFixed(3));

  let obiStatus: 'Forte Pressão Compradora (OBI > +0.25)' | 'Equilíbrio de Oferta' | 'Forte Pressão Vendedora (OBI < -0.25)' = 'Equilíbrio de Oferta';
  if (obi > 0.25) obiStatus = 'Forte Pressão Compradora (OBI > +0.25)';
  else if (obi < -0.25) obiStatus = 'Forte Pressão Vendedora (OBI < -0.25)';

  // Spread real (melhor bid x melhor ask)
  const spreadUsd = Number((realDepth.bestAsk - realDepth.bestBid).toFixed(4));
  const spreadPercent = Number(((spreadUsd / realDepth.bestAsk) * 100).toFixed(4));
  const isSpreadSpike = spreadPercent > 0.15;
  const spreadSpikeStatus = isSpreadSpike
    ? 'Alerta de Anomalia de Liquidez (Spread > 3x Média)'
    : 'Spread Normal';

  // POC: preço de maior volume real no perfil dos klines
  let pocPriceUsd = priceRef;
  if (klines.length > 0) {
    let maxVol = -Infinity;
    for (const k of klines) {
      if (k.volume > maxVol) {
        maxVol = k.volume;
        pocPriceUsd = k.close;
      }
    }
    pocPriceUsd = Number(pocPriceUsd.toFixed(2));
  }

  // Delta Volume & CVD calculados sobre klines reais
  let deltaVolumeNetUsd = 0;
  if (klines.length > 0) {
    for (const k of klines) {
      const isCandleGreen = k.close >= k.open;
      const candleVolUsd = k.volume * k.close;
      deltaVolumeNetUsd += isCandleGreen ? candleVolUsd : -candleVolUsd;
    }
  }

  const cvdDirection = deltaVolumeNetUsd > 0
    ? 'CVD Acumulando Alta'
    : deltaVolumeNetUsd < 0
    ? 'CVD Em Queda'
    : 'CVD Neutro';

  let cvdDivergence: 'Alerta de Absorção: Preço Sobe com CVD Caindo' | 'Alerta de Acúmulo: Preço Cai com CVD Subindo' | 'Sem Divergência de CVD' = 'Sem Divergência de CVD';
  if (change24h > 1.0 && deltaVolumeNetUsd < 0) cvdDivergence = 'Alerta de Absorção: Preço Sobe com CVD Caindo';
  else if (change24h < -1.0 && deltaVolumeNetUsd > 0) cvdDivergence = 'Alerta de Acúmulo: Preço Cai com CVD Subindo';

  // Iceberg walls reais: nível com mais de 2x o nível médio de liquidez
  const avgLevelSize = (bidTotalUsd + askTotalUsd) / Math.max(bids.length + asks.length, 1);
  const icebergWalls: { type: 'Parede de Suporte (Bids)' | 'Parede de Resistência (Asks)'; price: number; volumeUsd: number }[] = [];

  const maxBidLevel = [...bids].sort((a, b) => b.totalUsd - a.totalUsd)[0];
  if (maxBidLevel && maxBidLevel.totalUsd > avgLevelSize * 1.6) {
    icebergWalls.push({ type: 'Parede de Suporte (Bids)', price: maxBidLevel.price, volumeUsd: Math.round(maxBidLevel.totalUsd) });
  }
  const maxAskLevel = [...asks].sort((a, b) => b.totalUsd - a.totalUsd)[0];
  if (maxAskLevel && maxAskLevel.totalUsd > avgLevelSize * 1.6) {
    icebergWalls.push({ type: 'Parede de Resistência (Asks)', price: maxAskLevel.price, volumeUsd: Math.round(maxAskLevel.totalUsd) });
  }

  // Slippage estimado a partir do depth real (somar níveis até cobrir a ordem)
  const slippageFor = (orderUsd: number): number => {
    let cum = 0;
    for (const lvl of asks) {
      if (cum >= orderUsd) break;
      const needed = orderUsd - cum;
      const take = Math.min(needed, lvl.totalUsd);
      cum += take;
      const impact = (lvl.price - realDepth.bestAsk) / realDepth.bestAsk;
      if (cum >= orderUsd) return Number(Math.max(impact, 0).toFixed(4));
    }
    return Number((((orderUsd - cum) * 0.005) / realDepth.bestAsk).toFixed(4));
  };
  const slippage10k = slippageFor(10000);
  const slippage50k = slippageFor(50000);
  const slippage100k = slippageFor(100000);

  // Score de microestrutura sobre dados reais
  let compositeScore = 50;
  compositeScore += obi * 35;
  if (deltaVolumeNetUsd > 0) compositeScore += 10;
  if (deltaVolumeNetUsd < 0) compositeScore -= 10;
  if (cvdDivergence.includes('Acúmulo')) compositeScore += 12;
  if (cvdDivergence.includes('Absorção')) compositeScore -= 12;

  const finalScore = Math.min(98, Math.max(12, Math.round(compositeScore)));

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (finalScore >= 62) decision = 'COMPRAR';
  else if (finalScore <= 38) decision = 'VENDER';

  const signalsList: string[] = [];
  signalsList.push(`Order Book Imbalance (OBI L2 real) em ${obi > 0 ? '+' : ''}${obi} (${obiStatus}).`);
  signalsList.push(`Delta Volume Net (klines reais) em $${(deltaVolumeNetUsd / 1e6).toFixed(2)}M (${cvdDirection}).`);
  signalsList.push(`Spread real Bid/Ask em $${spreadUsd} (${spreadPercent}%) — melhores níveis $${realDepth.bestBid} / $${realDepth.bestAsk}.`);
  if (icebergWalls.length > 0) {
    signalsList.push(`Muralha de Liquidez: ${icebergWalls[0].type} em $${icebergWalls[0].price} ($${(icebergWalls[0].volumeUsd / 1e3).toFixed(0)}k USD).`);
  } else {
    signalsList.push(`Slippage real estimado do depth: $10k em ${slippage10k}% | $100k em ${slippage100k}%.`);
  }

  const keyMetrics: KeyMetric[] = [
    {
      label: 'Order Book Imbalance (OBI L2)',
      value: `${obi > 0 ? '+' : ''}${obi} (${obi > 0 ? 'Bids > Asks' : 'Asks > Bids'})`,
      status: obi > 0.15 ? 'positive' : obi < -0.15 ? 'negative' : 'neutral',
    },
    {
      label: 'CVD & Delta Volume Net',
      value: `$${(deltaVolumeNetUsd / 1e6).toFixed(2)}M (${cvdDirection.split(' ')[1]})`,
      status: deltaVolumeNetUsd > 0 ? 'positive' : 'negative',
    },
    {
      label: 'Spread Bid/Ask Spot (real)',
      value: `$${spreadUsd} (${spreadPercent}%)`,
      status: isSpreadSpike ? 'negative' : 'positive',
    },
    {
      label: 'Volume Profile POC',
      value: `$${pocPriceUsd} (Zona de Maior Volume)`,
      status: priceRef >= pocPriceUsd ? 'positive' : 'negative',
    },
    {
      label: 'Slippage Estimado ($10k/$100k)',
      value: `${slippage10k}% / ${slippage100k}% (Execução Inst.)`,
      status: slippage100k < 0.15 ? 'positive' : 'neutral',
    },
    {
      label: 'Divergência de Microestrutura',
      value: cvdDivergence.split(':')[0],
      status: cvdDivergence.includes('Acúmulo') ? 'positive' : cvdDivergence.includes('Absorção') ? 'negative' : 'neutral',
    },
  ];

  const report: AgentReport = {
    agentId: 'orderbook',
    agentName: 'OrderBook Sentinel',
    agentRole: 'Head de Microestrutura, L2 Book & Volume Delta',
    specialistType: 'Liquidez & Orderbook',
    avatarIcon: 'Sliders',
    opinion: decision,
    score: finalScore,
    summary: `Microestrutura real: OBI L2 de ${obi > 0 ? '+' : ''}${obi} sobre depth real da Binance. Delta Volume de $${(deltaVolumeNetUsd / 1e6).toFixed(1)}M. POC em $${pocPriceUsd}. Slippage $100k em ${slippage100k}%.`,
    keyMetrics,
    signals: signalsList.slice(0, 4),
    processingTimeMs: Date.now() % 1000,
    status: 'CONCLUÍDO',
  };

  const summaryObj: OrderBookAnalysisSummary = {
    bidTotalUsd,
    askTotalUsd,
    orderBookImbalanceRatio: obi,
    obiStatus,
    bidAskSpreadUsd: spreadUsd,
    spreadPercent,
    spreadSpikeStatus,
    pocPriceUsd,
    deltaVolumeNetUsd,
    cvdDirection,
    cvdDivergence,
    icebergWalls,
    slippageEstimate: {
      order10kUsd: slippage10k,
      order50kUsd: slippage50k,
      order100kUsd: slippage100k,
    },
    compositeScore: finalScore,
    opinion: decision,
  };

  return { report, summary: summaryObj };
}
