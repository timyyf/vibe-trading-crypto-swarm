import { describe, it, expect } from 'vitest';
import { runWhaleTrackerApexEngine } from './whaleEngine.js';
import { makeWhaleOverview } from './testFixtures.js';

describe('whaleEngine - rastreador de baleias', () => {
  it('sem snapshot retorna relatório DEGRADADO honesto sem números fabricados', () => {
    const { report, summary } = runWhaleTrackerApexEngine('ETH', 3000, 0, 0, 0, 0, null);
    expect(report.agentId).toBe('whales');
    expect(report.status).toBe('DEGRADADO');
    expect(report.opinion).toBe('AGUARDAR / NEUTRO');
    expect(report.score).toBe(50);
    expect(summary).toBeNull();
  });

  it('com snapshot de fluxo positivo retorna análise CONCLUÍDA com viés de compra', () => {
    const overview = makeWhaleOverview({ netFlow: 150000000, buy: 300000000, sell: 150000000, indexScore: 70 });
    const { report, summary } = runWhaleTrackerApexEngine('ETH', 3000, 0, 0, 0, 0, overview);
    expect(report.status).toBe('CONCLUÍDO');
    expect(summary?.realData).toBe(true);
    expect(summary?.netFlow24hUsd).toBeGreaterThan(0);
    expect(summary?.buyVolume24hUsd).toBeGreaterThan(summary!.sellVolume24hUsd);
    expect(report.score).toBeGreaterThanOrEqual(62);
    expect(report.opinion).toBe('COMPRAR');
  });

  it('com snapshot de outflow gera viés de venda', () => {
    const overview = makeWhaleOverview({ netFlow: -150000000, buy: 100000000, sell: 300000000, indexScore: 30 });
    const { report, summary } = runWhaleTrackerApexEngine('ETH', 3000, 0, 0, 0, 0, overview);
    expect(summary?.netFlow24hUsd).toBeLessThan(0);
    expect(report.score).toBeLessThanOrEqual(38);
    expect(report.opinion).toBe('VENDER');
  });
});
