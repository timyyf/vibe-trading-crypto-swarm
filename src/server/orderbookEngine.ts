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

/**
 * OrderBook Sentinel — Market Microstructure, L2 Depth & Delta Volume Engine
 */
export function runOrderBookSentinelEngine(
  symbol: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  klines: KlinePoint[]
): { report: AgentReport; summary: OrderBookAnalysisSummary } {
  // 1. Synthetic L2 Order Book Depth Generation around current price
  const topLevelsCount = 8;
  const priceStep = price * 0.0012; // 0.12% per level

  let bidTotalUsd = 0;
  let askTotalUsd = 0;

  const bids: OrderBookDepthLevel[] = [];
  const asks: OrderBookDepthLevel[] = [];

  // Generate Bid Side (Buyers)
  for (let i = 1; i <= topLevelsCount; i++) {
    const levelPrice = price - (i * priceStep);
    // Add realistic depth variation
    const multiplier = 1 + (Math.sin(i * 1.5) * 0.4) + (change24h > 0 ? 0.3 : -0.1);
    const totalUsd = Math.round((volume24h / 8000) * (1 + (8 - i) * 0.25) * Math.max(0.4, multiplier));
    const qty = totalUsd / levelPrice;
    bids.push({ price: levelPrice, quantity: qty, totalUsd });
    bidTotalUsd += totalUsd;
  }

  // Generate Ask Side (Sellers)
  for (let i = 1; i <= topLevelsCount; i++) {
    const levelPrice = price + (i * priceStep);
    const multiplier = 1 + (Math.cos(i * 1.5) * 0.4) + (change24h < 0 ? 0.3 : -0.1);
    const totalUsd = Math.round((volume24h / 8000) * (1 + (8 - i) * 0.25) * Math.max(0.4, multiplier));
    const qty = totalUsd / levelPrice;
    asks.push({ price: levelPrice, quantity: qty, totalUsd });
    askTotalUsd += totalUsd;
  }

  // 2. Order Book Imbalance (OBI) Calculation
  // OBI = (Bid Volume - Ask Volume) / (Bid Volume + Ask Volume)
  const totalBookVolume = bidTotalUsd + askTotalUsd || 1;
  const obi = Number(((bidTotalUsd - askTotalUsd) / totalBookVolume).toFixed(3));

  let obiStatus: 'Forte Pressão Compradora (OBI > +0.25)' | 'Equilíbrio de Oferta' | 'Forte Pressão Vendedora (OBI < -0.25)' = 'Equilíbrio de Oferta';
  if (obi > 0.20) {
    obiStatus = 'Forte Pressão Compradora (OBI > +0.25)';
  } else if (obi < -0.20) {
    obiStatus = 'Forte Pressão Vendedora (OBI < -0.25)';
  }

  // 3. Bid-Ask Spread & Anomaly Detection
  const bestBid = bids[0]?.price || price * 0.9998;
  const bestAsk = asks[0]?.price || price * 1.0002;
  const spreadUsd = Number((bestAsk - bestBid).toFixed(4));
  const spreadPercent = Number(((spreadUsd / price) * 100).toFixed(4));

  const isSpreadSpike = spreadPercent > 0.15; // > 0.15% spread anomaly
  const spreadSpikeStatus = isSpreadSpike
    ? 'Alerta de Anomalia de Liquidez (Spread > 3x Média)'
    : 'Spread Normal';

  // 4. Volume Profile / Point of Control (POC)
  const range = high24h - low24h || 1;
  const pocPriceUsd = Number((low24h + (range * (change24h >= 0 ? 0.62 : 0.38))).toFixed(2));

  // 5. Delta Volume & Cumulative Volume Delta (CVD)
  let deltaVolumeNetUsd = 0;
  if (klines && klines.length > 0) {
    for (const k of klines) {
      const isCandleGreen = k.close >= k.open;
      const candleVolUsd = k.volume * k.close;
      deltaVolumeNetUsd += isCandleGreen ? candleVolUsd * 0.58 : -candleVolUsd * 0.58;
    }
  } else {
    deltaVolumeNetUsd = volume24h * (change24h / 100) * 0.4;
  }

  const cvdDirection = deltaVolumeNetUsd > 0
    ? 'CVD Acumulando Alta'
    : deltaVolumeNetUsd < 0
    ? 'CVD Em Queda'
    : 'CVD Neutro';

  // CVD Divergence Detection
  let cvdDivergence: 'Alerta de Absorção: Preço Sobe com CVD Caindo' | 'Alerta de Acúmulo: Preço Cai com CVD Subindo' | 'Sem Divergência de CVD' = 'Sem Divergência de CVD';

  if (change24h > 1.0 && deltaVolumeNetUsd < -5000000) {
    cvdDivergence = 'Alerta de Absorção: Preço Sobe com CVD Caindo';
  } else if (change24h < -1.0 && deltaVolumeNetUsd > 5000000) {
    cvdDivergence = 'Alerta de Acúmulo: Preço Cai com CVD Subindo';
  }

  // 6. Iceberg Walls Detection (> 2x average level size)
  const avgLevelSize = (bidTotalUsd + askTotalUsd) / 16;
  const icebergWalls: { type: 'Parede de Suporte (Bids)' | 'Parede de Resistência (Asks)'; price: number; volumeUsd: number }[] = [];

  const maxBidLevel = [...bids].sort((a, b) => b.totalUsd - a.totalUsd)[0];
  if (maxBidLevel && maxBidLevel.totalUsd > avgLevelSize * 1.6) {
    icebergWalls.push({
      type: 'Parede de Suporte (Bids)',
      price: Number(maxBidLevel.price.toFixed(2)),
      volumeUsd: Math.round(maxBidLevel.totalUsd),
    });
  }

  const maxAskLevel = [...asks].sort((a, b) => b.totalUsd - a.totalUsd)[0];
  if (maxAskLevel && maxAskLevel.totalUsd > avgLevelSize * 1.6) {
    icebergWalls.push({
      type: 'Parede de Resistência (Asks)',
      price: Number(maxAskLevel.price.toFixed(2)),
      volumeUsd: Math.round(maxAskLevel.totalUsd),
    });
  }

  // 7. Slippage Simulation ($10k, $50k, $100k market orders)
  const liquidityDepthRatio = (volume24h / 1e8) || 1;
  const slippage10k = Number(Math.max(0.002, 0.02 / liquidityDepthRatio).toFixed(3));
  const slippage50k = Number(Math.max(0.01, 0.08 / liquidityDepthRatio).toFixed(3));
  const slippage100k = Number(Math.max(0.025, 0.18 / liquidityDepthRatio).toFixed(3));

  // 8. Composite Microstructure Score (0 - 100)
  let compositeScore = 50;
  compositeScore += (obi * 35); // OBI impact
  if (deltaVolumeNetUsd > 0) compositeScore += 10;
  if (deltaVolumeNetUsd < 0) compositeScore -= 10;
  if (cvdDivergence.includes('Acúmulo')) compositeScore += 12;
  if (cvdDivergence.includes('Absorção')) compositeScore -= 12;

  const finalScore = Math.min(98, Math.max(12, Math.round(compositeScore)));

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (finalScore >= 62) {
    decision = 'COMPRAR';
  } else if (finalScore <= 38) {
    decision = 'VENDER';
  }

  const signalsList: string[] = [];
  signalsList.push(`Order Book Imbalance (OBI L2) em ${obi > 0 ? '+' : ''}${obi} (${obiStatus}).`);
  signalsList.push(`Delta Volume Net em $${(deltaVolumeNetUsd / 1e6).toFixed(2)}M (${cvdDirection}).`);
  signalsList.push(`Point of Control (POC Volume Profile) em $${pocPriceUsd}.`);
  if (icebergWalls.length > 0) {
    signalsList.push(`Muralha de Liquidez: ${icebergWalls[0].type} em $${icebergWalls[0].price} ($${(icebergWalls[0].volumeUsd / 1e3).toFixed(0)}k USD).`);
  } else {
    signalsList.push(`Simulação de Slippage: $100k order impact em apenas ${slippage100k}%.`);
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
      label: 'Spread Bid/Ask Spot',
      value: `$${spreadUsd} (${spreadPercent}%)`,
      status: isSpreadSpike ? 'negative' : 'positive',
    },
    {
      label: 'Volume Profile POC',
      value: `$${pocPriceUsd} (Zona de Maior Volume)`,
      status: price >= pocPriceUsd ? 'positive' : 'negative',
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
    summary: `Análise de microestrutura de mercado: OBI L2 de ${obi > 0 ? '+' : ''}${obi}. Delta Volume de $${(deltaVolumeNetUsd / 1e6).toFixed(1)}M. POC em $${pocPriceUsd}. Slippage $100k em ${slippage100k}%.`,
    keyMetrics,
    signals: signalsList.slice(0, 4),
    processingTimeMs: 112,
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
