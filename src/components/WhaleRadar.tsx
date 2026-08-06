import React from 'react';
import { WhaleTransaction } from '../types';
import { ShieldAlert, ArrowUpRight, ArrowDownLeft, Wallet, AlertOctagon, Activity } from 'lucide-react';

interface WhaleRadarProps {
  symbol: string;
  transactions: WhaleTransaction[];
}

export const WhaleRadar: React.FC<WhaleRadarProps> = ({ symbol, transactions }) => {
  const totalInflow = transactions
    .filter((t) => t.type === 'EXCHANGE_INFLOW')
    .reduce((sum, t) => sum + t.amountUSD, 0);

  const totalOutflow = transactions
    .filter((t) => t.type === 'EXCHANGE_OUTFLOW')
    .reduce((sum, t) => sum + t.amountUSD, 0);

  const netFlow = totalOutflow - totalInflow; // positive means net outflow (accumulation/bullish)

  return (
    <div className="space-y-3">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Exchange Inflow</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-mono font-bold text-lg text-rose-400 mt-1">
            ${(totalInflow / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Potencial pressão vendedora.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Exchange Outflow</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono font-bold text-lg text-emerald-400 mt-1">
            ${(totalOutflow / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Acúmulo em cold wallets.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Net Flow ({symbol})</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className={`font-mono font-bold text-lg mt-1 ${netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netFlow >= 0 ? '+' : ''}${(netFlow / 1e6).toFixed(2)}M
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">
            {netFlow >= 0 ? '✓ Viés Altista (Acúmulo)' : '⚠️ Viés Baixista (Liquidação)'}
          </p>
        </div>
      </div>

      {/* Whale Transactions Feed */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        <div className="p-3 border-b border-[#24272C] bg-[#16191D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Radar de Grandes Carteiras em {symbol}</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-[#0A0B0D] px-2 py-0.5 rounded border border-[#24272C]">
            Ordens &gt; $100k USD
          </span>
        </div>

        <div className="divide-y divide-[#24272C]/60">
          {transactions.map((tx) => {
            const timeAgo = Math.round((Date.now() - tx.timestamp) / 60000);
            return (
              <div key={tx.id} className="p-2.5 hover:bg-[#1C1F24] transition-colors flex items-center justify-between font-mono">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center border ${
                      tx.type === 'EXCHANGE_OUTFLOW'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : tx.type === 'EXCHANGE_INFLOW'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    {tx.type === 'EXCHANGE_OUTFLOW' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : tx.type === 'EXCHANGE_INFLOW' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">
                        {tx.amountCrypto.toLocaleString()} {tx.symbol}
                      </span>
                      <span className="text-emerald-400 text-[11px]">
                        (${(tx.amountUSD / 1e6).toFixed(2)}M)
                      </span>
                    </div>
                    <div className="text-[10px] text-[#6B7280]">
                      De <span className="text-[#9CA3AF]">{tx.from}</span> para{' '}
                      <span className="text-[#9CA3AF]">{tx.to}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div
                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      tx.impactLevel === 'ALTO'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : tx.impactLevel === 'MÉDIO'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-[#1C1F24] text-[#9CA3AF] border border-[#24272C]'
                    }`}
                  >
                    <AlertOctagon className="w-2.5 h-2.5" />
                    <span>Impacto {tx.impactLevel}</span>
                  </div>
                  <div className="text-[9px] text-[#6B7280]">{timeAgo}m atrás</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

