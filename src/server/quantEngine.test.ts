import { describe, it, expect } from 'vitest';
import {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateStochRSI,
  calculateMACD,
  calculateATR,
  calculateVWAP,
  calculateOBV,
  detectCandlestickPatterns,
  runDrQuantGraphEngine,
  runHMMRegimeDetection,
  runBacktest,
} from './quantEngine.js';
import { makeKlines } from './testFixtures.js';
import { ALPHA_ZOO_FACTORS } from './cryptoDataService.js';

describe('quantEngine - indicadores', () => {
  it('calculateEMA retorna a própria constante para séries constantes', () => {
    const closes = Array(50).fill(100);
    expect(calculateEMA(closes, 20)).toBeCloseTo(100, 6);
  });

  it('calculateEMA pesa valores recentes mais que antigos', () => {
    const closes = Array(50).fill(10).concat([1000, 1000, 1000]);
    const ema = calculateEMA(closes, 20);
    expect(ema).toBeGreaterThan(10);
    expect(ema).toBeLessThan(1000);
  });

  it('calculateSMA retorna a média simples dos últimos `period` valores', () => {
    const closes = Array(30).fill(5).concat([10, 20, 30, 40, 50]);
    expect(calculateSMA(closes, 5)).toBe(30);
  });

  it('calculateRSI retorna 100 em série apenas de altas', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    expect(calculateRSI(closes)).toBe(100);
  });

  it('calculateRSI retorna 0 em série apenas de quedas', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    expect(calculateRSI(closes)).toBe(0);
  });

  it('calculateRSI retorna 50 (neutro) quando há dados insuficientes', () => {
    expect(calculateRSI([1, 2, 3], 14)).toBe(50);
  });

  it('calculateStochRSI fica dentro de [0,100] e nunca lança', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const { k, d } = calculateStochRSI(closes);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThanOrEqual(100);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(100);
  });

  it('calculateMACD é nulo em série constante', () => {
    const closes = Array(60).fill(250);
    const { line, signal, hist } = calculateMACD(closes);
    expect(Math.abs(line)).toBeLessThan(1e-6);
    expect(Math.abs(signal)).toBeLessThan(1e-6);
    expect(Math.abs(hist)).toBeLessThan(1e-6);
  });

  it('calculateATR/calculateVWAP/calculateOBV retornam números positivos em candles reais', () => {
    const klines = makeKlines(40, { trend: 0.01, volatility: 0.005 });
    expect(calculateATR(klines)).toBeGreaterThan(0);
    expect(calculateVWAP(klines)).toBeGreaterThan(0);
    expect(calculateOBV(klines)).toBeGreaterThan(0);
  });

  it('detectCandlestickPatterns não lança com poucos candles', () => {
    expect(detectCandlestickPatterns(makeKlines(2))).toBe('Sem padrão definido');
  });
});

describe('quantEngine - Dr Quant Graph', () => {
  const klines = makeKlines(40, { trend: 0.015, volatility: 0.004 });

  it('retorna relatório válido do agente technical', () => {
    const { report, summary } = runDrQuantGraphEngine('BTC', 50000, 1.5, 20000000000, 51000, 49000, klines);
    expect(report.agentId).toBe('technical');
    expect(['COMPRAR', 'VENDER', 'AGUARDAR / NEUTRO']).toContain(report.opinion);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.keyMetrics.length).toBeGreaterThan(0);
    expect(summary.score).toBe(report.score);
  });

  it('não lança com klines vazios (degradação honesta)', () => {
    const { report } = runDrQuantGraphEngine('BTC', 50000, 0, 0, 50000, 50000, []);
    expect(report.agentId).toBe('technical');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});

describe('quantEngine - HMM e Backtest', () => {
  const klines = makeKlines(60, { trend: 0.01, volatility: 0.004 });

  it('runHMMRegimeDetection retorna regime válido com probabilidades somando ~100', () => {
    const hmm = runHMMRegimeDetection(klines);
    expect(['MOMENTUM', 'MEAN_REVERSION', 'HIGH_VOLATILITY']).toContain(hmm.dominantRegime);
    const sum = hmm.probabilities.momentum + hmm.probabilities.meanReversion + hmm.probabilities.highVolatility;
    expect(sum).toBeGreaterThan(90);
    expect(sum).toBeLessThan(110);
    expect(hmm.confidence).toBeGreaterThanOrEqual(0);
    expect(hmm.confidence).toBeLessThanOrEqual(100);
    expect(hmm.realData).toBe(true);
  });

  it('runBacktest roda sobre candles reais e popula todos os campos', () => {
    const factor = ALPHA_ZOO_FACTORS[0];
    const bt = runBacktest(klines, factor);
    expect(bt.barsUsed).toBe(klines.length);
    expect(bt.factorId).toBe(factor.id);
    expect(bt.totalTrades).toBeGreaterThan(0);
    expect(bt.finalEquityCurve.length).toBeGreaterThan(0);
    expect(bt.realData).toBe(true);
  });
});
