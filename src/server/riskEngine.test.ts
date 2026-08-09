import { describe, it, expect } from 'vitest';
import { runRiskProtocolOfficerEngine } from './riskEngine.js';
import { makeKlines } from './testFixtures.js';

describe('riskEngine - protocolo de risco', () => {
  it('veto por RRR quando os candles são planos (ATR ~0)', () => {
    const flat = makeKlines(20, { trend: 0, volatility: 0 });
    const { report, summary } = runRiskProtocolOfficerEngine('BTC', 50000, 0, 0, 50000, 50000, flat, 'COMPRAR');
    expect(summary.isVetoedByRiskOfficer).toBe(true);
    expect(summary.rrrStatus).toContain('REPROVADO');
    expect(report.status).toBe('DEGRADADO');
    expect(report.opinion).toBe('AGUARDAR / NEUTRO');
  });

  it('aprova trade em tendência suave (RRR 1:2.35 e VaR baixo)', () => {
    const mild = makeKlines(20, { trend: 0.01, volatility: 0 });
    const { report, summary } = runRiskProtocolOfficerEngine('BTC', 50000, 1.0, 0, 50500, 49500, mild, 'COMPRAR');
    expect(summary.isVetoedByRiskOfficer).toBe(false);
    expect(summary.riskRewardRatio).toBeGreaterThanOrEqual(2.0);
    expect(summary.technicalStopLossUSD).toBeLessThan(50000);
    expect(summary.takeProfitTargetUSD).toBeGreaterThan(50000);
    expect(report.status).toBe('CONCLUÍDO');
  });

  it('veto por VaR quando a volatilidade é extrema', () => {
    const volatile = makeKlines(30, { trend: 0, volatility: 0.08 });
    const { summary } = runRiskProtocolOfficerEngine('BTC', 50000, 0, 0, 55000, 45000, volatile, 'COMPRAR');
    expect(summary.isVetoedByRiskOfficer).toBe(true);
    expect(summary.var95Percent).toBeGreaterThan(8.5);
    expect(summary.vetoReason).toContain('VaR 95%');
  });

  it('direção VENDA posiciona stop acima do preço', () => {
    const mild = makeKlines(20, { trend: -0.005, volatility: 0 });
    const { summary } = runRiskProtocolOfficerEngine('BTC', 50000, -2.0, 0, 50500, 49000, mild, 'VENDER');
    expect(summary.technicalStopLossUSD).toBeGreaterThan(50000);
    expect(summary.takeProfitTargetUSD).toBeLessThan(50000);
  });
});
