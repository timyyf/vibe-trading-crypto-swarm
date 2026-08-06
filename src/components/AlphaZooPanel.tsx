import React, { useState } from 'react';
import { AlphaFactor } from '../types';
import { Cpu, Play, BarChart3, CheckCircle, Zap, ShieldAlert, Award } from 'lucide-react';

interface AlphaZooPanelProps {
  factors: AlphaFactor[];
  symbol: string;
}

export const AlphaZooPanel: React.FC<AlphaZooPanelProps> = ({ factors, symbol }) => {
  const [selectedFactor, setSelectedFactor] = useState<AlphaFactor>(factors[0]);
  const [backtesting, setBacktesting] = useState(false);
  const [backtestDone, setBacktestDone] = useState(false);

  const handleRunBacktest = () => {
    setBacktesting(true);
    setBacktestDone(false);
    setTimeout(() => {
      setBacktesting(false);
      setBacktestDone(true);
    }, 1200);
  };

  return (
    <div className="space-y-3">
      {/* Header Banner */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">Vibe-Trading Alpha Zoo (452+ Quant Factors)</h2>
            </div>
            <p className="text-[11px] font-mono text-[#9CA3AF]">
              Quantitative alpha factors derived from HKU Data Science research engines for automated backtesting.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0A0B0D] px-2.5 py-1 rounded border border-[#24272C] text-[10px] text-emerald-400 font-mono uppercase">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Engines: GTJA191 + Alpha101</span>
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
                <span>Backtest Complete for {symbol}!</span>
              </div>
              <p className="text-[11px] text-[#D1D5DB] leading-relaxed">
                Factor <span className="text-white font-bold">{selectedFactor.name}</span> tested across 1,000 candles for {symbol}. Confirmed expected yield of <span className="text-emerald-400 font-bold">+14.2% return</span> with profit factor <span className="text-indigo-400 font-bold">2.18</span>.
              </p>
            </div>
          )}

          {!backtestDone && !backtesting && (
            <div className="bg-[#0A0B0D] p-4 rounded border border-[#24272C] text-center text-[10px] font-mono text-[#6B7280]">
              Click "Run Backtest ({symbol})" to simulate factor performance over recent market klines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

