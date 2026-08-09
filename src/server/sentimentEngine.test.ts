import { describe, it, expect } from 'vitest';
import { buildDegradedSentimentReport } from './sentimentEngine.js';

describe('sentimentEngine - relatório DEGRADADO honesto', () => {
  it('reporta fontes indisponíveis sem fabricar números', () => {
    const { report, summary } = buildDegradedSentimentReport('BTC');
    expect(report.agentId).toBe('sentiment');
    expect(report.status).toBe('DEGRADADO');
    expect(report.opinion).toBe('AGUARDAR / NEUTRO');
    expect(report.score).toBe(50);
    expect(report.summary).toContain('BTC');
    expect(report.summary).not.toMatch(/\d+%/);
    expect(report.keyMetrics[0].value).toBe('Não monitorado');
  });

  it('summary marcado como dados não reais', () => {
    const { summary } = buildDegradedSentimentReport('ETH');
    expect(summary.realData).toBe(false);
    expect(summary.fearAndGreedCurrent).toBeNull();
    expect(summary.fundingRateBinancePercent).toBeNull();
    expect(summary.fundingRateStatus).toBe('Não monitorado');
    expect(summary.compositeScore).toBe(50);
    expect(summary.opinion).toBe('AGUARDAR / NEUTRO');
  });
});
