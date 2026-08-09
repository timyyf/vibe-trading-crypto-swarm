import { describe, it, expect } from 'vitest';
import { runAlphaZooEngine } from './alphaZooEngine.js';
import { makeKlines } from './testFixtures.js';

describe('alphaZoo - fatores quantitativos', () => {
  const klines = makeKlines(60, { trend: 0.01, volatility: 0.004 });

  it('retorna relatório com 5 fatores calculados em tempo real', () => {
    const { report, summary } = runAlphaZooEngine('BTC', 50000, 1.5, 0, 51000, 49000, klines);
    expect(report.agentId).toBe('alpha');
    expect(['COMPRAR', 'VENDER', 'AGUARDAR / NEUTRO']).toContain(report.opinion);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(summary.top5Factors.length).toBeGreaterThan(0);
    for (const f of summary.top5Factors) {
      expect(typeof f.factorValue).toBe('number');
      expect(typeof f.backtestSharpe).toBe('number');
      expect(typeof f.winRatePercent).toBe('number');
    }
  });

  it('não lança com klines vazios', () => {
    const { report } = runAlphaZooEngine('BTC', 50000, 0, 0, 50000, 50000, []);
    expect(report.agentId).toBe('alpha');
  });
});
