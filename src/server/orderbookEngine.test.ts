import { describe, it, expect } from 'vitest';
import { runOrderBookSentinelEngine, RealDepth, OrderBookDepthLevel } from './orderbookEngine.js';
import { makeKlines } from './testFixtures.js';

function makeDepth(): RealDepth {
  const bids: OrderBookDepthLevel[] = [
    { price: 2998, quantity: 2.0, totalUsd: 5996 },
    { price: 2997, quantity: 1.0, totalUsd: 2997 },
  ];
  const asks: OrderBookDepthLevel[] = [
    { price: 3002, quantity: 1.5, totalUsd: 4503 },
    { price: 3003, quantity: 1.0, totalUsd: 3003 },
  ];
  return { bids, asks, bestBid: 2998, bestAsk: 3002, fetchedAt: Date.now() };
}

describe('orderbookEngine - Sentinel de microestrutura', () => {
  const klines = makeKlines(40, { trend: 0.01 });

  it('com depthOverride sintético retorna análise CONCLUÍDA com spread real', async () => {
    const { report, summary } = await runOrderBookSentinelEngine('ETH', 3000, 0, 0, 0, 0, klines, makeDepth());
    expect(report.agentId).toBe('orderbook');
    expect(report.status).toBe('CONCLUÍDO');
    expect(summary).not.toBeNull();
    expect(summary!.bidAskSpreadUsd).toBe(4);
    expect(summary!.spreadPercent).toBeGreaterThan(0);
    expect(summary!.orderBookImbalanceRatio).toBeGreaterThan(0);
    expect(report.keyMetrics.length).toBeGreaterThan(0);
  });

  it('com depthOverride null retorna DEGRADADO sem buscar rede', async () => {
    const { report, summary } = await runOrderBookSentinelEngine('ETH', 3000, 0, 0, 0, 0, klines, null);
    expect(report.status).toBe('DEGRADADO');
    expect(report.opinion).toBe('AGUARDAR / NEUTRO');
    expect(summary).toBeNull();
  });
});
