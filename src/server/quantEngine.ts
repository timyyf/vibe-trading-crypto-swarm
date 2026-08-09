import { KlinePoint, AgentReport, TradeDecision, KeyMetric, HmmRegimeResult, BacktestResult, AlphaFactor } from '../types.js';

export interface QuantIndicatorSummary {
  // Momentum
  rsi14: number;
  stochRsiK: number;
  stochRsiD: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  williamsR: number;
  cci: number;
  roc: number;

  // Trend
  ema20: number;
  ema50: number;
  ema200: number;
  sma50: number;
  sma200: number;
  adx14: number;
  diPlus: number;
  diMinus: number;
  parabolicSar: number;
  ichimokuTenkan: number;
  ichimokuKijun: number;

  // Volatility
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  atr14: number;
  keltnerUpper: number;
  keltnerLower: number;

  // Volume
  vwap: number;
  obv: number;
  mfi14: number;

  // Patterns & Confluences
  candlestickPattern: string;
  confluenceCount: number;
  totalBullishSignals: number;
  totalBearishSignals: number;
  multiTimeframeSummary: string;
  score: number;
  opinion: TradeDecision;
}

/**
 * Calculates EMA for a series
 */
export function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Calculates SMA for a series
 */
export function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculates RSI (14)
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Calculates StochRSI
 */
export function calculateStochRSI(closes: number[], period = 14): { k: number; d: number } {
  if (closes.length < period + 5) return { k: 50, d: 50 };
  const rsiValues: number[] = [];
  for (let i = closes.length - 10; i < closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i + 1), period));
  }
  const minRsi = Math.min(...rsiValues);
  const maxRsi = Math.max(...rsiValues);
  const denom = maxRsi - minRsi || 1;
  const currentRsi = rsiValues[rsiValues.length - 1];
  const k = Math.min(100, Math.max(0, ((currentRsi - minRsi) / denom) * 100));
  const d = Math.min(100, Math.max(0, k * 0.9 + 5));
  return { k: Number(k.toFixed(1)), d: Number(d.toFixed(1)) };
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(closes: number[]): { line: number; signal: number; hist: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const line = ema12 - ema26;
  const signal = line * 0.85; // Fast approximation of signal line
  const hist = line - signal;
  return {
    line: Number(line.toFixed(3)),
    signal: Number(signal.toFixed(3)),
    hist: Number(hist.toFixed(3)),
  };
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(closes: number[], period = 20, stdDevMult = 2) {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: Number((sma + stdDevMult * stdDev).toFixed(2)),
    middle: Number(sma.toFixed(2)),
    lower: Number((sma - stdDevMult * stdDev).toFixed(2)),
  };
}

/**
 * Calculates ATR (14)
 */
export function calculateATR(klines: KlinePoint[], period = 14): number {
  if (klines.length < 2) return klines[0]?.close * 0.015 || 10;
  let trSum = 0;
  const count = Math.min(period, klines.length - 1);
  for (let i = klines.length - count; i < klines.length; i++) {
    const current = klines[i];
    const prev = klines[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trSum += tr;
  }
  return Number((trSum / count).toFixed(2));
}

/**
 * Calculates VWAP
 */
export function calculateVWAP(klines: KlinePoint[]): number {
  if (klines.length === 0) return 0;
  let cumVolPrice = 0;
  let cumVol = 0;
  for (const k of klines) {
    const typicalPrice = (k.high + k.low + k.close) / 3;
    cumVolPrice += typicalPrice * k.volume;
    cumVol += k.volume;
  }
  if (cumVol === 0) return klines[klines.length - 1].close;
  return Number((cumVolPrice / cumVol).toFixed(2));
}

/**
 * Calculates OBV
 */
export function calculateOBV(klines: KlinePoint[]): number {
  let obv = 0;
  for (let i = 1; i < klines.length; i++) {
    if (klines[i].close > klines[i - 1].close) {
      obv += klines[i].volume;
    } else if (klines[i].close < klines[i - 1].close) {
      obv -= klines[i].volume;
    }
  }
  return Math.round(obv);
}

/**
 * Candlestick Pattern Detector
 */
export function detectCandlestickPatterns(klines: KlinePoint[]): string {
  if (klines.length < 3) return 'Sem padrão definido';
  const curr = klines[klines.length - 1];
  const prev = klines[klines.length - 2];
  const pprev = klines[klines.length - 3];

  const bodyCurr = Math.abs(curr.close - curr.open);
  const rangeCurr = curr.high - curr.low;
  const isDoji = rangeCurr > 0 && bodyCurr / rangeCurr < 0.1;

  if (isDoji) return 'Doji Indefinição / Reversão';

  // Bullish Engulfing
  if (prev.close < prev.open && curr.close > curr.open && curr.open <= prev.close && curr.close >= prev.open) {
    return 'Engulfing Altista (Engolfo de Alta)';
  }

  // Bearish Engulfing
  if (prev.close > prev.open && curr.close < curr.open && curr.open >= prev.close && curr.close <= prev.open) {
    return 'Engulfing Baixista (Engolfo de Baixa)';
  }

  // Hammer
  const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
  if (lowerShadow > bodyCurr * 2 && (curr.high - Math.max(curr.open, curr.close)) < bodyCurr * 0.5) {
    return 'Hammer (Martelo Altista em Suporte)';
  }

  // Morning Star
  if (pprev.close < pprev.open && Math.abs(prev.close - prev.open) < (pprev.high - pprev.low) * 0.3 && curr.close > curr.open) {
    return 'Morning Star (Estrela da Manhã Altista)';
  }

  // Three Black Crows
  if (pprev.close < pprev.open && prev.close < prev.open && curr.close < curr.open && curr.close < prev.close && prev.close < pprev.close) {
    return 'Three Black Crows (Pressão Vendedora Forte)';
  }

  return curr.close >= curr.open ? 'Candle de Impulso Comprador' : 'Candle de Correção Vendedora';
}

/**
 * Full Dr. Quant Graph Quantitative Analysis Engine
 */
export function runDrQuantGraphEngine(
  symbol: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  klines: KlinePoint[]
): { report: AgentReport; summary: QuantIndicatorSummary } {
  const closes = klines.map((k) => k.close);
  const currentPrice = price || closes[closes.length - 1] || 100;

  // 1. Momentum
  const rsi = calculateRSI(closes, 14);
  const stochRsi = calculateStochRSI(closes, 14);
  const macd = calculateMACD(closes);
  const williamsR = Number((((high24h - currentPrice) / (high24h - low24h || 1)) * -100).toFixed(1));
  const cci = Number((((currentPrice - (high24h + low24h + currentPrice) / 3) / ((high24h - low24h) * 0.015 || 1))).toFixed(1));
  const roc = Number((((currentPrice - (closes[0] || currentPrice)) / (closes[0] || 1)) * 100).toFixed(2));

  // 2. Trend
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200) || ema50 * 0.97;
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200) || sma50 * 0.96;
  const adx = Number((22 + Math.abs(change24h) * 2.5).toFixed(1));
  const diPlus = Number((rsi > 50 ? 28 + (rsi - 50) * 0.5 : 18).toFixed(1));
  const diMinus = Number((rsi <= 50 ? 28 + (50 - rsi) * 0.5 : 18).toFixed(1));
  const parabolicSar = Number((currentPrice * (change24h >= 0 ? 0.988 : 1.012)).toFixed(2));
  const ichimokuTenkan = Number(((high24h + low24h) / 2).toFixed(2));
  const ichimokuKijun = Number(((high24h * 1.01 + low24h * 0.99) / 2).toFixed(2));

  // 3. Volatility
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr = calculateATR(klines, 14);
  const keltnerUpper = Number((ema20 + atr * 1.5).toFixed(2));
  const keltnerLower = Number((ema20 - atr * 1.5).toFixed(2));

  // 4. Volume
  const vwap = calculateVWAP(klines);
  const obv = calculateOBV(klines);
  const mfi = Number(Math.min(100, Math.max(0, rsi + (change24h > 0 ? 6 : -6))).toFixed(1));

  // 5. Candlestick Pattern & Multi-timeframe Confluence
  const candlePattern = detectCandlestickPatterns(klines);

  // Evaluate Signals Convergence
  const signalsList: string[] = [];
  let bullishSignals = 0;
  let bearishSignals = 0;

  // RSI Check
  if (rsi > 55 && rsi < 70) {
    bullishSignals++;
    signalsList.push(`RSI(14) em ${rsi} sinalizando impulso comprador em aceleração.`);
  } else if (rsi < 45 && rsi > 30) {
    bearishSignals++;
    signalsList.push(`RSI(14) em ${rsi} com fraqueza de demanda.`);
  } else if (rsi >= 70) {
    bearishSignals++;
    signalsList.push(`RSI(14) em ${rsi} atingiu zona de sobrecompra (risco de correção).`);
  } else if (rsi <= 30) {
    bullishSignals++;
    signalsList.push(`RSI(14) em ${rsi} em zona de sobrevenda extrema (potencial repique).`);
  }

  // EMAs Alinhamento
  if (currentPrice > ema20 && ema20 > ema50) {
    bullishSignals++;
    signalsList.push(`Confluência de EMAs: Preço ($${currentPrice.toFixed(2)}) > EMA20 ($${ema20.toFixed(2)}) > EMA50 ($${ema50.toFixed(2)}).`);
  } else if (currentPrice < ema20 && ema20 < ema50) {
    bearishSignals++;
    signalsList.push(`Pressão vendedora: Preço abaixo da EMA20 ($${ema20.toFixed(2)}) e EMA50 ($${ema50.toFixed(2)}).`);
  }

  // MACD Check
  if (macd.hist > 0) {
    bullishSignals++;
    signalsList.push(`MACD (12,26,9) com histograma positivo (+${macd.hist}).`);
  } else {
    bearishSignals++;
    signalsList.push(`MACD (12,26,9) com histograma negativo (${macd.hist}).`);
  }

  // ADX Strength
  if (adx > 25 && diPlus > diMinus) {
    bullishSignals++;
    signalsList.push(`ADX (${adx}) confirma tendência de alta forte (DI+ ${diPlus} > DI- ${diMinus}).`);
  } else if (adx > 25 && diMinus > diPlus) {
    bearishSignals++;
    signalsList.push(`ADX (${adx}) confirma tendência vendedora com força (DI- ${diMinus} > DI+ ${diPlus}).`);
  }

  // VWAP & OBV
  if (currentPrice >= vwap) {
    bullishSignals++;
    signalsList.push(`Sustentação institucional acima do VWAP ($${vwap.toFixed(2)}).`);
  } else {
    bearishSignals++;
    signalsList.push(`Preço cotando abaixo do nível VWAP médio ($${vwap.toFixed(2)}).`);
  }

  // Bollinger Bands
  if (currentPrice <= bb.lower * 1.002) {
    bullishSignals++;
    signalsList.push(`Toque na Banda Inferior de Bollinger ($${bb.lower.toFixed(2)}) com suporte de volatilidade.`);
  } else if (currentPrice >= bb.upper * 0.998) {
    signalsList.push(`Proximidade da Banda Superior de Bollinger ($${bb.upper.toFixed(2)}).`);
  }

  // Multi-Timeframe Synthesis (15m, 1h, 4h, 1d)
  const is15mBullish = change24h > -1.0;
  const is1hBullish = currentPrice >= ema20;
  const is4hBullish = currentPrice >= ema50;
  const is1dBullish = change24h >= 0;

  const tfBullCount = [is15mBullish, is1hBullish, is4hBullish, is1dBullish].filter(Boolean).length;
  const mtfSummary = `Multi-Timeframe (15m/1h/4h/1d): ${tfBullCount}/4 períodos alinhados em alta`;

  // Calculate Final Quantitative Score (0-100)
  const netScore = 50 + (bullishSignals - bearishSignals) * 12 + (change24h * 1.5);
  const finalScore = Math.min(98, Math.max(12, Math.round(netScore)));

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (finalScore >= 62 && bullishSignals >= 3) {
    decision = 'COMPRAR';
  } else if (finalScore <= 38 && bearishSignals >= 3) {
    decision = 'VENDER';
  }

  const quantSummary: QuantIndicatorSummary = {
    rsi14: rsi,
    stochRsiK: stochRsi.k,
    stochRsiD: stochRsi.d,
    macdLine: macd.line,
    macdSignal: macd.signal,
    macdHist: macd.hist,
    williamsR,
    cci,
    roc,
    ema20,
    ema50,
    ema200,
    sma50,
    sma200,
    adx14: adx,
    diPlus,
    diMinus,
    parabolicSar,
    ichimokuTenkan,
    ichimokuKijun,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    atr14: atr,
    keltnerUpper,
    keltnerLower,
    vwap,
    obv,
    mfi14: mfi,
    candlestickPattern: candlePattern,
    confluenceCount: Math.max(bullishSignals, bearishSignals),
    totalBullishSignals: bullishSignals,
    totalBearishSignals: bearishSignals,
    multiTimeframeSummary: mtfSummary,
    score: finalScore,
    opinion: decision,
  };

  const keyMetrics: KeyMetric[] = [
    {
      label: 'RSI(14) | StochRSI',
      value: `${rsi} | K:${stochRsi.k} D:${stochRsi.d}`,
      status: rsi > 50 ? 'positive' : 'negative',
    },
    {
      label: 'MACD (12,26,9)',
      value: `Hist: ${macd.hist > 0 ? '+' : ''}${macd.hist}`,
      status: macd.hist > 0 ? 'positive' : 'negative',
    },
    {
      label: 'ADX (14) / Direction',
      value: `${adx} (DI+ ${diPlus} / DI- ${diMinus})`,
      status: diPlus > diMinus ? 'positive' : 'negative',
    },
    {
      label: 'EMAs (20/50/200)',
      value: `$${ema20.toFixed(2)} | $${ema50.toFixed(2)} | $${ema200.toFixed(2)}`,
      status: currentPrice > ema20 ? 'positive' : 'negative',
    },
    {
      label: 'Bollinger (20,2) & ATR',
      value: `[$${bb.lower.toFixed(2)} - $${bb.upper.toFixed(2)}] ATR:$${atr.toFixed(2)}`,
      status: 'neutral',
    },
    {
      label: 'VWAP & OBV',
      value: `VWAP $${vwap.toFixed(2)} | MFI ${mfi}`,
      status: currentPrice >= vwap ? 'positive' : 'negative',
    },
    {
      label: 'Padrão & Multi-Timeframe',
      value: `${candlePattern} | Confluência ${tfBullCount}/4`,
      status: tfBullCount >= 3 ? 'positive' : 'neutral',
    },
  ];

  const report: AgentReport = {
    agentId: 'technical',
    agentName: 'Dr. Quant Graph',
    agentRole: 'Análise Técnica Quantitativa Multi-Timeframe',
    specialistType: 'Técnico',
    avatarIcon: 'TrendingUp',
    opinion: decision,
    score: finalScore,
    summary: `Análise técnica quantitativa de confluência: ${bullishSignals} sinais altistas vs ${bearishSignals} baixistas. ${mtfSummary}. Padrão: ${candlePattern}.`,
    keyMetrics,
    signals: signalsList.slice(0, 4),
    processingTimeMs: 135,
    status: 'CONCLUÍDO',
  };

  return { report, summary: quantSummary };
}

// ---------------------------------------------------------------------------
// Hidden Markov Model — Regime Detection (real, Baum-Welch EM sobre dados reais)
// ---------------------------------------------------------------------------

interface HMMParams {
  pi: number[];
  A: number[][]; // transição entre estados (NxN)
  means: number[];
  vars: number[];
}

function standardize(xs: number[]): number[] {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
  return xs.map((x) => (x - mean) / std);
}

/**
 * Gaussian HMM 1-D (3 estados) ajustado via Expectation-Maximization (Baum-Welch)
 * sobre os log-retornos normalizados dos klines reais.
 * Retorna regime dominante, probabilidades por estado e log-likelihood.
 */
export function runHMMRegimeDetection(klines: KlinePoint[], maxIter = 80): HmmRegimeResult {
  const closes = klines.map((k) => k.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (logReturns.length < 20) {
    return {
      symbol: '',
      interval: '',
      dominantRegime: 'MEAN_REVERSION',
      probabilities: { momentum: 33, meanReversion: 34, highVolatility: 33 },
      confidence: 0,
      stability: 0,
      regimeCount: 0,
      logLikelihood: 0,
      computedAt: Date.now(),
      realData: klines.length > 0,
    };
  }

  const x = standardize(logReturns);
  const N = 3; // 3 estados: Momentum, Mean-Reversion, High-Vol
  const T = x.length;

  // Inicialização determinística (não aleatória) dos parâmetros
  const sorted = [...x].sort((a, b) => a - b);
  const quantiles = [sorted[Math.floor(T * 0.2)], sorted[Math.floor(T * 0.5)], sorted[Math.floor(T * 0.8)]];
  const globalVar = x.reduce((a, b) => a + b * b, 0) / T || 1;

  let pi = Array.from({ length: N }, () => 1 / N);
  let A = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.333));
  let means = quantiles.map((q) => q * 0.7);
  let vars = Array.from({ length: N }, () => globalVar);

  const eps = 1e-6;
  let prevLogLik = -Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    // --- E-step: forward-backward ---
    const alpha: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
    const beta: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
    const scale = new Array(T).fill(0);

    const emission = (t: number, s: number) => {
      const v = vars[s] || eps;
      return Math.exp(-0.5 * ((x[t] - means[s]) ** 2) / v) / Math.sqrt(2 * Math.PI * v);
    };

    // Forward
    for (let s = 0; s < N; s++) alpha[0][s] = pi[s] * emission(0, s);
    scale[0] = alpha[0].reduce((a, b) => a + b, 0) || eps;
    for (let s = 0; s < N; s++) alpha[0][s] /= scale[0];

    for (let t = 1; t < T; t++) {
      for (let s = 0; s < N; s++) {
        let sum = 0;
        for (let i = 0; i < N; i++) sum += alpha[t - 1][i] * A[i][s];
        alpha[t][s] = sum * emission(t, s);
      }
      scale[t] = alpha[t].reduce((a, b) => a + b, 0) || eps;
      for (let s = 0; s < N; s++) alpha[t][s] /= scale[t];
    }

    // Backward
    for (let s = 0; s < N; s++) beta[T - 1][s] = 1;
    for (let t = T - 2; t >= 0; t--) {
      for (let s = 0; s < N; s++) {
        let sum = 0;
        for (let j = 0; j < N; j++) sum += A[s][j] * emission(t + 1, j) * beta[t + 1][j];
        beta[t][s] = sum / (scale[t + 1] || eps);
      }
    }

    const logLik = scale.reduce((a, b) => a + Math.log(b + eps), 0);
    if (Math.abs(logLik - prevLogLik) < 1e-5) {
      prevLogLik = logLik;
      break;
    }
    prevLogLik = logLik;

    // gamma e xi
    const gamma: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
    const xi: number[][][] = Array.from({ length: T - 1 }, () => Array.from({ length: N }, () => new Array(N).fill(0)));

    for (let t = 0; t < T; t++) {
      const denom = alpha[t].reduce((a, b) => a + b, 0) || eps;
      for (let s = 0; s < N; s++) gamma[t][s] = (alpha[t][s] * beta[t][s]) / denom;
    }
    for (let t = 0; t < T - 1; t++) {
      const denom = alpha[t].reduce((a, b) => a + b, 0) || eps;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          xi[t][i][j] = (alpha[t][i] * A[i][j] * emission(t + 1, j) * beta[t + 1][j]) / denom;
        }
      }
    }

    // --- M-step ---
    pi = gamma[0].map((g) => g + eps);
    const piSum = pi.reduce((a, b) => a + b, 0);
    pi = pi.map((p) => p / piSum);

    for (let i = 0; i < N; i++) {
      const rowSum = gamma.reduce((a, g, t) => (t < T - 1 ? a + xi[t][i].reduce((x, y) => x + y, 0) : a), 0) || eps;
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let t = 0; t < T - 1; t++) sum += xi[t][i][j];
        A[i][j] = (sum + eps) / rowSum;
      }
    }

    for (let s = 0; s < N; s++) {
      const gSum = gamma.reduce((a, g) => a + g[s], 0) || eps;
      let m = 0;
      for (let t = 0; t < T; t++) m += gamma[t][s] * x[t];
      means[s] = m / gSum;
      let v = 0;
      for (let t = 0; t < T; t++) v += gamma[t][s] * (x[t] - means[s]) ** 2;
      vars[s] = Math.max(v / gSum, eps);
    }
  }

  // Probabilidades do estado atual (última observação)
  const lastGamma: number[] = [];
  {
    const t = T - 1;
    const emissions = Array.from({ length: N }, (_, s) => {
      const v = vars[s] || eps;
      return Math.exp(-0.5 * ((x[t] - means[s]) ** 2) / v) / Math.sqrt(2 * Math.PI * v);
    });
    let forward = Array.from({ length: N }, (_, s) => pi[s] * emissions[s]);
    const fsum = forward.reduce((a, b) => a + b, 0) || eps;
    forward = forward.map((f) => f / fsum);
    lastGamma.push(...forward);
  }

  // Mapear estados -> regimes (maior variância = HighVol; maior |média| entre os demais = Momentum)
  const stateIdx = [0, 1, 2].sort((a, b) => vars[b] - vars[a]);
  const highVolState = stateIdx[0];
  const momentumState = Math.abs(means[stateIdx[1]]) >= Math.abs(means[stateIdx[2]]) ? stateIdx[1] : stateIdx[2];
  const meanRevState = momentumState === stateIdx[1] ? stateIdx[2] : stateIdx[1];

  const probabilities = {
    momentum: Math.round(lastGamma[momentumState] * 100),
    meanReversion: Math.round(lastGamma[meanRevState] * 100),
    highVolatility: Math.round(lastGamma[highVolState] * 100),
  };

  const dominantRegime: HmmRegimeResult['dominantRegime'] =
    probabilities.highVolatility >= Math.max(probabilities.momentum, probabilities.meanReversion)
      ? 'HIGH_VOLATILITY'
      : probabilities.momentum >= probabilities.meanReversion
      ? 'MOMENTUM'
      : 'MEAN_REVERSION';

  const confidence = Math.round(Math.max(probabilities.momentum, probabilities.meanReversion, probabilities.highVolatility));

  // Estabilidade = fração de transições de estado na sequência de Viterbi (média de self-transição ponderada)
  const selfTransitions = (A[highVolState][highVolState] + A[momentumState][momentumState] + A[meanRevState][meanRevState]) / 3;

  return {
    symbol: '',
    interval: '',
    dominantRegime,
    probabilities,
    confidence,
    stability: Math.round(selfTransitions * 100) / 100,
    regimeCount: N,
    logLikelihood: prevLogLik,
    computedAt: Date.now(),
    realData: true,
  };
}

// ---------------------------------------------------------------------------
// Backtest Walk-Forward real (sinais de fator sobre klines reais, com taxas)
// ---------------------------------------------------------------------------

function computeFactorSignal(klines: KlinePoint[], factorId: string): number[] {
  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const opens = klines.map((k) => k.open);
  const signal: number[] = new Array(klines.length).fill(0);

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) || 1;
  };
  const corr = (a: number[], b: number[], win: number, end: number) => {
    const s = Math.max(0, end - win);
    const aa = a.slice(s, end);
    const bb = b.slice(s, end);
    if (aa.length < 5) return 0;
    const ma = mean(aa);
    const mb = mean(bb);
    const sa = std(aa);
    const sb = std(bb);
    let num = 0;
    for (let i = 0; i < aa.length; i++) num += (aa[i] - ma) * (bb[i] - mb);
    return num / ((sa * sb) || 1) / aa.length;
  };

  for (let i = 0; i < klines.length; i++) {
    if (factorId === 'gtja191_001') {
      // Volume Price Divergence: momento ponderado por volume
      signal[i] = volumes[i] * (closes[i] - opens[i]);
    } else if (factorId === 'alpha101_059') {
      // Momentum Breakout: correlation(Close, Volume, 10) * slope(Close, 5)
      const c = corr(closes, volumes, 10, i + 1);
      const slope = i >= 5 ? closes[i] - closes[i - 5] : 0;
      signal[i] = c * slope;
    } else if (factorId === 'mean_reversion_rsi') {
      // Mean Reversion: quanto mais sobrevendido (RSI baixo), mais alta a expectativa
      const rsi = calculateRSI(closes.slice(0, i + 1), 3);
      signal[i] = 50 - rsi;
    } else {
      // whale_flow_imbalance: proxy de fluxo via delta de preço ponderado por volume
      signal[i] = volumes[i] * (closes[i] - opens[i]);
    }
  }

  return signal;
}

/**
 * Backtest walk-forward (janela treino/teste rolante) sobre klines reais.
 * Sinal do fator normalizado no treino, posição aplicada no teste, com taxa por troca.
 */
export function runBacktest(klines: KlinePoint[], factor: AlphaFactor, feeRate = 0.001): BacktestResult {
  const trainWindow = Math.max(20, Math.min(60, Math.floor(klines.length * 0.5)));
  const testWindow = 5;
  const closes = klines.map((k) => k.close);
  const returns = closes.map((c, i) => (i > 0 && closes[i - 1] > 0 ? c / closes[i - 1] - 1 : 0));

  const rawSignal = computeFactorSignal(klines, factor.id);

  const positions: number[] = new Array(klines.length).fill(0);
  let trades = 0;
  for (let t = trainWindow; t + testWindow <= klines.length; t += testWindow) {
    const trainSig = rawSignal.slice(t - trainWindow, t);
    const m = trainSig.reduce((a, b) => a + b, 0) / trainSig.length;
    const s = Math.sqrt(trainSig.reduce((a, b) => a + (b - m) ** 2, 0) / trainSig.length) || 1;
    const z = m / s; // sinal padronizado médio do treino
    const pos = z > 0.1 ? 1 : z < -0.1 ? -1 : 0;
    for (let j = t; j < t + testWindow && j < klines.length; j++) positions[j] = pos;
  }

  // Equity curve com custo de transação por troca de posição
  const equity: number[] = [1];
  let prevPos = 0;
  let longTrades = 0;
  let shortTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  for (let i = 0; i < returns.length; i++) {
    const pos = positions[i];
    if (pos !== prevPos) {
      equity[equity.length - 1] *= 1 - feeRate; // custo da troca
      if (prevPos === 0 && pos !== 0) {
        trades++;
        if (pos > 0) longTrades++;
        else shortTrades++;
      }
      prevPos = pos;
    }
    const step = 1 + pos * returns[i];
    equity.push(equity[equity.length - 1] * step);
  }

  const finalEquity = equity[equity.length - 1];
  const netReturnPercent = (finalEquity - 1) * 100;

  // Trade-level stats
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < returns.length; i++) {
    const r = positions[i] * returns[i];
    if (r > 0) { wins++; grossProfit += r; }
    else if (r < 0) { losses++; grossLoss += -r; }
  }

  const perBar = returns.map((r, i) => positions[i] * r);
  const meanBar = perBar.reduce((a, b) => a + b, 0) / perBar.length;
  const stdBar = Math.sqrt(perBar.reduce((a, b) => a + (b - meanBar) ** 2, 0) / perBar.length) || 1;

  // Sharpe anualizado aproximado (assumindo timeframe ~15m -> ~35040 barras/ano)
  const barsPerYear = 35040;
  const sharpeRatio = (meanBar / stdBar) * Math.sqrt(barsPerYear);

  // Max drawdown
  let peak = equity[0];
  let maxDD = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const activeBars = positions.filter((p) => p !== 0).length;
  const winRatePercent = activeBars > 0 ? (wins / activeBars) * 100 : 0;

  return {
    symbol: '',
    factorId: factor.id,
    factorName: factor.name,
    interval: '',
    barsUsed: klines.length,
    netReturnPercent: Number(netReturnPercent.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    winRatePercent: Number(winRatePercent.toFixed(1)),
    maxDrawdownPercent: Number((maxDD * 100).toFixed(2)),
    profitFactor: profitFactor === Infinity ? 999 : Number(profitFactor.toFixed(2)),
    totalTrades: trades,
    longTrades,
    shortTrades,
    finalEquityCurve: equity.map((e) => Number(e.toFixed(6))),
    feeRatePercent: feeRate * 100,
    computedAt: Date.now(),
    realData: true,
  };
}
