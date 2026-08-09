import React from 'react';
import { WhaleOverview } from '../types';
import { ShieldAlert, Activity, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, Database } from 'lucide-react';

interface WhaleRadarProps {
  symbol: string;
  overview: WhaleOverview | null;
}

export const WhaleRadar: React.FC<WhaleRadarProps> = ({ symbol, overview }) => {
  if (!overview) {
    return (
      <div className="space-y-3">
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Radar de Grandes Carteiras em {symbol}</h3>
            <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
              Agregados on-chain reais indisponíveis no momento (fonte Deep Blue Alpha não respondeu). Nenhum dado fabricado é exibido.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { stats, index, topTokens, source, scope } = overview;
  const netFlow = stats.netFlow24h; // positivo = acumulação
  const buyShare = stats.buyVolume24h + stats.sellVolume24h > 0
    ? (stats.buyVolume24h / (stats.buyVolume24h + stats.sellVolume24h)) * 100
    : 0;

  return (
    <div className="space-y-3">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Buy Volume 24h</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono font-bold text-lg text-emerald-400 mt-1">
            ${(stats.buyVolume24h / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">{buyShare.toFixed(0)}% do fluxo on-chain.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Sell Volume 24h</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-mono font-bold text-lg text-rose-400 mt-1">
            ${(stats.sellVolume24h / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Pressão vendedora on-chain.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Net Flow 24h</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className={`font-mono font-bold text-lg mt-1 ${netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netFlow >= 0 ? '+' : ''}${(netFlow / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">
            {netFlow >= 0 ? '✓ Viés Altista (Inflow)' : '⚠️ Viés Baixista (Outflow)'}
          </p>
        </div>
      </div>

      {/* Whale Sentiment Index */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-4 h-4 text-indigo-400" />
          <div>
            <div className="text-[10px] font-mono text-[#9CA3AF] uppercase">Whale Sentiment Index</div>
            <div className="font-mono font-bold text-white text-sm mt-0.5">
              {index.current}/100 <span className="text-[#9CA3AF]">({index.classification})</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-[#9CA3AF] uppercase">{stats.activeWallets24h.toLocaleString()} carteiras ativas</div>
          <div className="text-[10px] font-mono text-[#6B7280] mt-0.5">Buy {index.buyScore}/100 | Confiança {index.confidence}%</div>
        </div>
      </div>

      {/* Top Tokens */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        <div className="p-3 border-b border-[#24272C] bg-[#16191D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Top Tokens por Fluxo ({source}, {scope})</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-[#0A0B0D] px-2 py-0.5 rounded border border-[#24272C]">
            Dados reais agregados
          </span>
        </div>

        <div className="divide-y divide-[#24272C]/60">
          {topTokens.length === 0 && (
            <div className="p-3 text-[10px] font-mono text-[#6B7280]">Nenhum token listado pela fonte no momento.</div>
          )}
          {topTokens.map((token) => (
            <div key={token.symbol} className="p-2.5 hover:bg-[#1C1F24] transition-colors flex items-center justify-between font-mono">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded flex items-center justify-center border ${
                  token.direction === 'ACUMULAÇÃO'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : token.direction === 'DISTRIBUIÇÃO'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                }`}>
                  {token.direction === 'ACUMULAÇÃO' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : token.direction === 'DISTRIBUIÇÃO' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <Wallet className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">{token.symbol}</span>
                    <span className="text-[#9CA3AF] text-[10px]">Volume ${(token.volumeUsd / 1e6).toFixed(2)}M</span>
                  </div>
                  <div className="text-[10px] text-[#6B7280]">
                    {token.trades} trades · {token.wallets} carteiras baleia
                  </div>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <div className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                  token.direction === 'ACUMULAÇÃO'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : token.direction === 'DISTRIBUIÇÃO'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-[#1C1F24] text-[#9CA3AF] border border-[#24272C]'
                }`}>
                  {token.direction === 'ACUMULAÇÃO' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  <span>{token.direction}</span>
                </div>
                <div className="text-[9px] text-[#6B7280]">
                  Net ${token.netFlowUsd >= 0 ? '+' : ''}${(token.netFlowUsd / 1e6).toFixed(2)}M
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
