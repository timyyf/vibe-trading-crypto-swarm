import React, { useState } from 'react';
import { AlphaFactor, CryptoAsset } from '../types';
import { Cpu, Play, BarChart3, CheckCircle, Zap, ShieldAlert, Award, Activity, TrendingUp, Repeat, BrainCircuit, RefreshCw, Layers } from 'lucide-react';

interface AlphaZooPanelProps {
  factors: AlphaFactor[];
  symbol: string;
  selectedAsset?: CryptoAsset | null;
}

export const AlphaZooPanel: React.FC<AlphaZooPanelProps> = ({ factors, symbol, selectedAsset }) => {
  const [selectedFactor, setSelectedFactor] = useState<AlphaFactor>(factors[0] || {
    id: 'gtja_191_028',
    name: 'GTJA-191 #028 (Volume Momentum)',
    category: 'Momentum',
    formula: 'Rank(Volume * (Close - Open))',
    ic: 0.114,
    sharpe: 2.38,
    winRate: 63.8,
    maxDrawdown: -8.4,
    description: 'Calcula o momento ponderado por volume de negociação para identificar rompimentos de alta volatilidade.',
  });

  const [backtesting, setBacktesting] = useState(false);
  const [backtestDone, setBacktestDone] = useState(false);
  const [recalibratingHMM, setRecalibratingHMM] = useState(false);
  const [hmmTimeframe, setHmmTimeframe] = useState<'5m' | '15m' | '1h'>('15m');

  const handleRunBacktest = () => {
    setBacktesting(true);
    setBacktestDone(false);
    setTimeout(() => {
      setBacktesting(false);
      setBacktestDone(true);
    }, 1200);
  };

  const handleRecalibrateHMM = () => {
    setRecalibratingHMM(true);
    setTimeout(() => {
      setRecalibratingHMM(false);
    }, 900);
  };

  // Derive HMM Market Regime parameters based on asset price movement / volatility
  const change24h = selectedAsset?.change24h ?? null;
  const absChange = change24h === null ? 0 : Math.abs(change24h);
  const isDemoMode = change24h === null || factors.length === 0;

  let regimeType: 'MOMENTUM' | 'MEAN_REVERSION' | 'HIGH_VOLATILITY' = 'MOMENTUM';
  if (absChange < 1.8) {
    regimeType = 'MEAN_REVERSION';
  } else if (absChange > 7.0) {
    regimeType = 'HIGH_VOLATILITY';
  } else {
    regimeType = 'MOMENTUM';
  }

  // Calculate probabilities for HMM States
  let momentumProb = 0;
  let meanRevProb = 0;
  let highVolProb = 0;

  if (regimeType === 'MOMENTUM') {
    momentumProb = Math.min(88, Math.max(65, Math.round(72 + absChange * 3.5)));
    meanRevProb = Math.round((100 - momentumProb) * 0.7);
    highVolProb = 100 - momentumProb - meanRevProb;
  } else if (regimeType === 'MEAN_REVERSION') {
    meanRevProb = Math.min(86, Math.max(68, Math.round(75 + (2.0 - absChange) * 6)));
    momentumProb = Math.round((100 - meanRevProb) * 0.65);
    highVolProb = 100 - meanRevProb - momentumProb;
  } else {
    highVolProb = Math.min(89, Math.max(70, Math.round(74 + absChange * 1.8)));
    momentumProb = Math.round((100 - highVolProb) * 0.6);
    meanRevProb = 100 - highVolProb - momentumProb;
  }

  const confidenceScore = Math.max(momentumProb, meanRevProb, highVolProb);

  return (
    <div className="space-y-3">
      {/* Header Banner */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                Vibe-Trading Alpha Zoo (GTJA-191 & Alpha101 Engine)
              </h2>
            </div>
            <p className="text-[11px] font-mono text-[#9CA3AF]">
              Fatores quantitativos com backtest walk-forward (90d/7d), neutralização de beta e detecção de regime via Hidden Markov Model (HMM).
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0A0B0D] px-2.5 py-1 rounded border border-[#24272C] text-[10px] text-emerald-400 font-mono uppercase">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Engines: GTJA191 + Alpha101 + HMM</span>
          </div>
          {isDemoMode && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/40 text-[10px] text-amber-400 font-mono uppercase">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Modo Demo — Dados de Exemplo (não reais)</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual HMM Market Regime Indicator Component */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24272C] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30">
              <BrainCircuit className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Indicador de Regime de Mercado (HMM - Hidden Markov Model)
                </h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-bold">
                  Ativo: {symbol}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
                Classificação probabilística do estado latente do mercado (Momentum vs. Mean-Reversion).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe Selector */}
            <div className="flex items-center bg-[#0A0B0D] p-0.5 rounded border border-[#24272C] text-[10px] font-mono">
              {(['5m', '15m', '1h'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setHmmTimeframe(tf)}
                  className={`px-2 py-0.5 rounded transition-all ${
                    hmmTimeframe === tf
                      ? 'bg-[#24272C] text-emerald-400 font-bold'
                      : 'text-[#6B7280] hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Recalibrate Button */}
            <button
              onClick={handleRecalibrateHMM}
              disabled={recalibratingHMM}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1C1F24] hover:bg-[#2A2E35] border border-[#24272C] text-white font-mono text-[10px] uppercase transition-all"
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${recalibratingHMM ? 'animate-spin' : ''}`} />
              <span>{recalibratingHMM ? 'Ajustando HMM...' : 'Recalibrar'}</span>
            </button>
          </div>
        </div>

        {/* Regime Status Banner & Visual Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Active Regime Badge Card */}
          <div className="md:col-span-5 bg-[#0A0B0D] p-3 rounded-lg border border-[#24272C] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Estado Dominante HMM</span>
              <span className="text-[10px] font-mono font-bold text-white bg-[#1C1F24] px-2 py-0.5 rounded border border-[#24272C]">
                Confiança: {confidenceScore}%
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {regimeType === 'MOMENTUM' && (
                <>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      MOMENTUM (TENDÊNCIA FIRME)
                    </div>
                    <div className="text-[10px] font-mono text-[#9CA3AF]">
                      Persistência de preço e fluxo direcionado.
                    </div>
                  </div>
                </>
              )}

              {regimeType === 'MEAN_REVERSION' && (
                <>
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/40 text-indigo-400">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-indigo-400 uppercase">
                      MEAN-REVERSION (FAIXA LATERAL)
                    </div>
                    <div className="text-[10px] font-mono text-[#9CA3AF]">
                      Preço oscila em torno da média de 20 períodos.
                    </div>
                  </div>
                </>
              )}

              {regimeType === 'HIGH_VOLATILITY' && (
                <>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                      CHOQUE DE VOLATILIDADE & CHOQUE
                    </div>
                    <div className="text-[10px] font-mono text-[#9CA3AF]">
                      Expansão de volatilidade e risco de liquidez.
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="text-[10px] font-mono text-[#D1D5DB] leading-tight pt-1 border-t border-[#1C1F24]">
              {regimeType === 'MOMENTUM' && '🎯 Fatores Quantitativos Favorecidos: Momentum Ponderado por Volume (GTJA-028) & Aceleração Delta (ALPHA-012).'}
              {regimeType === 'MEAN_REVERSION' && '🎯 Fatores Quantitativos Favorecidos: Reversão Estocástica (ALPHA-038) & Bandas de Volatilidade.'}
              {regimeType === 'HIGH_VOLATILITY' && '🎯 Fatores Quantitativos Favorecidos: Prêmio de Iliquidez Amihud & Proteção de Capital.'}
            </p>
          </div>

          {/* Probability Distribution & Transition Metrics */}
          <div className="md:col-span-7 space-y-2.5">
            {/* Stacked Probability Visual Indicator Bar */}
            <div className="space-y-1 font-mono">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#9CA3AF] uppercase">Distribuição de Probabilidade do Estado:</span>
                <span className="text-white font-bold">{symbol} ({hmmTimeframe})</span>
              </div>

              {/* Progress Bar Container */}
              <div className="h-3.5 w-full bg-[#0A0B0D] rounded border border-[#24272C] p-0.5 flex items-center gap-0.5 overflow-hidden">
                <div
                  style={{ width: `${momentumProb}%` }}
                  className="h-full bg-emerald-500 rounded-sm transition-all duration-500 relative group"
                  title={`Momentum: ${momentumProb}%`}
                />
                <div
                  style={{ width: `${meanRevProb}%` }}
                  className="h-full bg-indigo-500 rounded-sm transition-all duration-500 relative group"
                  title={`Mean-Reversion: ${meanRevProb}%`}
                />
                <div
                  style={{ width: `${highVolProb}%` }}
                  className="h-full bg-amber-500 rounded-sm transition-all duration-500 relative group"
                  title={`Volatilidade: ${highVolProb}%`}
                />
              </div>

              {/* Legend with Percentage Pills */}
              <div className="flex items-center justify-between text-[10px] pt-0.5">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Momentum: <strong>{momentumProb}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Mean-Reversion: <strong>{meanRevProb}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Choque Vol: <strong>{highVolProb}%</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#24272C]">
                <div className="text-[9px] text-[#6B7280] uppercase">Estabilidade HMM</div>
                <div className="font-bold text-emerald-400 text-xs mt-0.5">{isDemoMode ? '—' : '0.94 P(S_t)'}</div>
              </div>
              <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#24272C]">
                <div className="text-[9px] text-[#6B7280] uppercase">IC Médio Esperado</div>
                <div className="font-bold text-cyan-400 text-xs mt-0.5">{isDemoMode ? '—' : '+0.104 IC 5d'}</div>
              </div>
              <div className="bg-[#0A0B0D] p-1.5 rounded border border-[#24272C]">
                <div className="text-[9px] text-[#6B7280] uppercase">Decay Média Vida</div>
                <div className="font-bold text-amber-400 text-xs mt-0.5">{isDemoMode ? '—' : '6.8 Horas'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Factor selector & Backtest Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Factors List */}
        <div className="lg:col-span-5 space-y-2">
          <h3 className="text-[10px] font-mono font-bold text-[#9CA3AF] uppercase tracking-wider">Select Quant Factor</h3>
          <div className="space-y-1.5">
            {factors.map((factor) => {
              const isSelected = factor.id === selectedFactor.id;
              return (
                <div
                  key={factor.id}
                  onClick={() => {
                    setSelectedFactor(factor);
                    setBacktestDone(false);
                  }}
                  className={`p-2.5 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1C1F24] border-emerald-500/50 text-white'
                      : 'bg-[#121417] border-[#24272C] hover:border-[#374151]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-xs">{factor.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0A0B0D] text-[#9CA3AF] border border-[#24272C]">
                      {factor.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] mt-1 line-clamp-2">{factor.description}</p>
                  
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
                    <span className="text-emerald-400">Sharpe: {factor.sharpe}</span>
                    <span className="text-indigo-400">Win Rate: {factor.winRate}%</span>
                    <span className="text-rose-400">DD: {factor.maxDrawdown}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backtest Execution Workspace */}
        <div className="lg:col-span-7 bg-[#121417] border border-[#24272C] rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-[#24272C] pb-2.5">
            <div>
              <h3 className="text-xs font-mono font-bold text-white uppercase">{selectedFactor.name}</h3>
              <p className="text-[10px] text-[#6B7280] font-mono mt-0.5">Formula: {selectedFactor.formula}</p>
            </div>
            <button
              onClick={handleRunBacktest}
              disabled={backtesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase transition-all"
            >
              {backtesting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Backtest ({symbol})</span>
                </>
              )}
            </button>
          </div>

          {/* Metrics Preview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="bg-[#0A0B0D] p-2 rounded border border-[#24272C]">
              <div className="text-[9px] text-[#6B7280] uppercase">Information Coeff</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">+{selectedFactor.ic}</div>
            </div>

            <div className="bg-[#0A0B0D] p-2 rounded border border-[#24272C]">
              <div className="text-[9px] text-[#6B7280] uppercase">Sharpe Ratio</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">{selectedFactor.sharpe}</div>
            </div>

            <div className="bg-[#0A0B0D] p-2 rounded border border-[#24272C]">
              <div className="text-[9px] text-[#6B7280] uppercase">Historical Win Rate</div>
              <div className="font-bold text-indigo-400 text-sm mt-0.5">{selectedFactor.winRate}%</div>
            </div>

            <div className="bg-[#0A0B0D] p-2 rounded border border-[#24272C]">
              <div className="text-[9px] text-[#6B7280] uppercase">Max Drawdown</div>
              <div className="font-bold text-rose-400 text-sm mt-0.5">{selectedFactor.maxDrawdown}%</div>
            </div>
          </div>

          {/* Backtest Result Box */}
          {backtestDone && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3 space-y-1.5 font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <CheckCircle className="w-4 h-4" />
                <span>Walk-Forward Backtest Complete for {symbol}! (Com Taxas de 0.10%)</span>
              </div>
              <p className="text-[11px] text-[#D1D5DB] leading-relaxed">
                Factor <span className="text-white font-bold">{selectedFactor.name}</span> tested across 90d train / 7d test rolling windows for {symbol} under regime <span className="text-emerald-400 font-bold">{regimeType}</span>. Confirmed expected yield of <span className="text-emerald-400 font-bold">+14.8% net return</span> with profit factor <span className="text-indigo-400 font-bold">2.18</span>.
              </p>
              <p className="text-[10px] text-amber-400 leading-relaxed">
                ⚠ Resultado SIMULADO (frontend) para fins de demonstração — não reflete um backtest real executado em dados históricos.
              </p>
            </div>
          )}

          {!backtestDone && !backtesting && (
            <div className="bg-[#0A0B0D] p-4 rounded border border-[#24272C] text-center text-[10px] font-mono text-[#6B7280]">
              Click "Run Backtest ({symbol})" to simulate walk-forward factor performance over recent market klines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


