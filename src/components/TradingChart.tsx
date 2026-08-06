import React, { useState } from 'react';
import { KlinePoint, CryptoAsset } from '../types';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, BarChart2, Activity, RefreshCw } from 'lucide-react';

interface TradingChartProps {
  symbol: string;
  klines: KlinePoint[];
  asset: CryptoAsset;
  timeframe: '5m' | '15m' | '1h';
  onTimeframeChange: (timeframe: '5m' | '15m' | '1h') => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  klines,
  asset,
  timeframe,
  onTimeframeChange,
  onRefresh,
  isLoading,
}) => {
  const minPrice = Math.min(...klines.map((k) => k.low), asset.price * 0.98);
  const maxPrice = Math.max(...klines.map((k) => k.high), asset.price * 1.02);
  const padding = (maxPrice - minPrice) * 0.05;

  return (
    <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3 space-y-3">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24272C] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#1A1D21] border border-[#24272C] flex items-center justify-center font-mono font-bold text-emerald-400 text-xs">
            {symbol.substring(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold text-white uppercase">{symbol}/USDT</h2>
              <span className="text-[10px] bg-[#0A0B0D] text-[#9CA3AF] font-mono px-1.5 py-0.5 rounded border border-[#24272C]">Spot Binance</span>
            </div>
            <p className="text-[10px] text-[#6B7280] font-mono">Kline Price Feeds & Indicators ({timeframe})</p>
          </div>
        </div>

        {/* Timeframe & Refresh Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#0A0B0D] p-0.5 rounded border border-[#24272C]">
            {(['5m', '15m', '1h'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 bg-[#1A1D21] hover:bg-[#24272C] text-[#9CA3AF] hover:text-white rounded border border-[#24272C] transition-colors"
            title="Atualizar Gráfico"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Candlestick / Price Chart */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-emerald-400"></span>
              <span>Close</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-amber-400"></span>
              <span>EMA 20</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-indigo-400"></span>
              <span>SMA 50</span>
            </span>
          </div>
          <div>
            Last: <span className="font-bold text-white">${asset.price.toLocaleString()}</span>
          </div>
        </div>

        <div className="h-64 w-full bg-[#0A0B0D] rounded p-2 border border-[#24272C]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={klines} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2329" />
              <XAxis dataKey="time" stroke="#4b5563" fontSize={9} tickLine={false} />
              <YAxis domain={[minPrice - padding, maxPrice + padding]} stroke="#4b5563" fontSize={9} orientation="right" />
              <Tooltip
                contentStyle={{ backgroundColor: '#121417', borderColor: '#24272C', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, '']}
              />
              <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={1.5} dot={false} name="Preço" />
              <Line type="monotone" dataKey="ema20" stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 3" dot={false} name="EMA 20" />
              <Line type="monotone" dataKey="sma50" stroke="#818cf8" strokeWidth={1} dot={false} name="SMA 50" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RSI Gauge & Volume Sub-Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* RSI Oscillator */}
        <div className="bg-[#121417] p-2.5 rounded border border-[#24272C] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] uppercase">
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>RSI (14)</span>
            </div>
            <span className="text-emerald-400 font-bold">
              {klines[klines.length - 1]?.rsi || 58.4}
            </span>
          </div>

          <div className="h-20 w-full bg-[#0A0B0D] p-1 rounded border border-[#24272C]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={klines} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <YAxis domain={[0, 100]} stroke="#4b5563" fontSize={8} orientation="right" />
                <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="2 2" />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="rsi" stroke="#10b981" strokeWidth={1} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Flow */}
        <div className="bg-[#121417] p-2.5 rounded border border-[#24272C] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] uppercase">
            <div className="flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Volume / Candle</span>
            </div>
            <span>Vol 24h: ${(asset.volume24h / 1e6).toFixed(1)}M</span>
          </div>

          <div className="h-20 w-full bg-[#0A0B0D] p-1 rounded border border-[#24272C]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={klines} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <YAxis stroke="#4b5563" fontSize={8} orientation="right" />
                <Bar dataKey="volume" fill="#10b981" opacity={0.7} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

