import { KlinePoint, WhaleOverview, WhaleIndexData, TopWhaleToken, WhaleOverviewStats } from '../types.js';

const BASE_TS = 1700000000000;

export function makeKlines(
  count: number,
  opts: { startPrice?: number; trend?: number; volatility?: number; volume?: number } = {}
): KlinePoint[] {
  const { startPrice = 100, trend = 0.01, volatility = 0, volume = 1000 } = opts;
  const klines: KlinePoint[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const dir = i % 2 === 0 ? 1 : -1;
    const close = price * (1 + trend + dir * volatility);
    const high = Math.max(open, close) * (1 + volatility * 0.2);
    const low = Math.min(open, close) * (1 - volatility * 0.2);
    klines.push({
      time: new Date(BASE_TS + i * 900000).toISOString(),
      timestamp: BASE_TS + i * 900000,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
    });
    price = close;
  }
  return klines;
}

export function makeWhaleOverview(opts: { netFlow?: number; buy?: number; sell?: number; indexScore?: number } = {}): WhaleOverview {
  const { netFlow = 150000000, buy = 300000000, sell = 150000000, indexScore = 65 } = opts;
  const stats: WhaleOverviewStats = {
    trackedWallets: 12450,
    activeWallets24h: 3200,
    buyVolume24h: buy,
    sellVolume24h: sell,
    netFlow24h: netFlow,
    dexTrades24h: 48210,
    exchangeFlows24h: 210000000,
    totalVolume24h: buy + sell,
    latestBlock: 19000000,
  };
  const index: WhaleIndexData = {
    current: indexScore,
    classification: indexScore >= 55 ? 'Otimista' : indexScore <= 45 ? 'Pessimista' : 'Neutro',
    buyScore: 62,
    sellScore: 38,
    confidence: 0.78,
    history: [
      { date: '2026-01-01', value: 55, classification: 'Neutro' },
      { date: '2026-01-02', value: 60, classification: 'Otimista' },
    ],
    fetchedAt: Date.now(),
  };
  const topTokens: TopWhaleToken[] = [
    { symbol: 'ETH', name: 'Ethereum', trades: 1200, volumeUsd: 80000000, netFlowUsd: 12000000, direction: 'ACUMULAÇÃO', wallets: 340 },
    { symbol: 'USDT', name: 'Tether', trades: 3000, volumeUsd: 40000000, netFlowUsd: -5000000, direction: 'NEUTRO', wallets: 900 },
  ];
  return {
    stats,
    index,
    topTokens,
    source: 'Deep Blue Alpha',
    scope: 'Ethereum on-chain',
    fetchedAt: Date.now(),
  };
}
