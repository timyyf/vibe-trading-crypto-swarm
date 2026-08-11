import React from 'react';
import { BitcoinWhaleOverview } from '../types';
import { ShieldAlert, Coins, ArrowUpRight, Wallet, Layers, Boxes } from 'lucide-react';

interface BitcoinWhalePanelProps {
  overview: BitcoinWhaleOverview | null;
  loading?: boolean;
}

const fmtUsd = (v: number | null): string => {
  if (v === null) return '—';
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const shortAddr = (addr: string): string => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

const shortTx = (txid: string): string => `${txid.slice(0, 10)}…${txid.slice(-8)}`;

export const BitcoinWhalePanel: React.FC<BitcoinWhalePanelProps> = ({ overview, loading }) => {
  if (loading && !overview) {
    return (
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 text-[10px] font-mono text-[#9CA3AF]">
        Carregando movimentos de baleias BTC…
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Movimentos de Baleias Bitcoin</h3>
          <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
            Mempool.space indisponível no momento. Nenhum dado fabricado é exibido.
          </p>
        </div>
      </div>
    );
  }

  const { stats, moves, source, scope } = overview;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Movimentos</span>
            <Coins className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-mono font-bold text-lg text-white mt-1">{stats.whaleMoves}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Saídas ≥ 10 BTC ({source}).</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Total Movimentado</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono font-bold text-lg text-emerald-400 mt-1">{stats.totalMovedBtc} BTC</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">{fmtUsd(stats.totalMovedUsd)} em grandes UTXOs.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Carteiras Receptoras</span>
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="font-mono font-bold text-lg text-white mt-1">{stats.uniqueRecipients}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Endereços distintos recebendo baleias.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Blocos</span>
            <Boxes className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="font-mono font-bold text-lg text-white mt-1">#{stats.latestBlockHeight}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">{stats.blocksScanned} blocos varridos.</p>
        </div>
      </div>

      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        <div className="p-3 border-b border-[#24272C] bg-[#16191D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Top Movimentações BTC</h3>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-[#0A0B0D] px-2 py-0.5 rounded border border-[#24272C]">
            Dados reais · {scope}
          </span>
        </div>

        <div className="divide-y divide-[#24272C]/60">
          {moves.length === 0 && (
            <div className="p-3 text-[10px] font-mono text-[#6B7280]">Nenhum movimento ≥ 10 BTC nas últimas amostras.</div>
          )}
          {moves.map((m) => (
            <div key={`${m.txid}-${m.recipient}`} className="p-2.5 hover:bg-[#1C1F24] transition-colors flex items-center justify-between font-mono">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded flex items-center justify-center border bg-amber-500/10 text-amber-400 border-amber-500/30 shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">{m.amountBtc} BTC</span>
                    <span className="text-[#9CA3AF] text-[10px]">{fmtUsd(m.amountUsd)}</span>
                  </div>
                  <div className="text-[10px] text-[#6B7280] truncate">
                    bloco #{m.blockHeight} · tx {shortTx(m.txid)} → {shortAddr(m.recipient)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
