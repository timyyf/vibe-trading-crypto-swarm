import React from 'react';
import { DefiLlamaFlows } from '../types';
import { ShieldAlert, TrendingUp, TrendingDown, Database, Activity } from 'lucide-react';

interface DefiLlamaPanelProps {
  flows: DefiLlamaFlows | null;
  loading?: boolean;
}

const fmtUsd = (v: number): string => {
  return v >= 1_000_000_000 ? `$${(v / 1_000_000_000).toFixed(2)}B` : `$${(v / 1_000_000).toFixed(1)}M`;
};

export const DefiLlamaPanel: React.FC<DefiLlamaPanelProps> = ({ flows, loading }) => {
  if (loading && !flows) {
    return (
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 text-[10px] font-mono text-[#9CA3AF]">
        Carregando fluxos DeFi…
      </div>
    );
  }

  if (!flows) {
    return (
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Fluxos DeFi (DefiLlama)</h3>
          <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
            DefiLlama indisponível no momento. Nenhum dado fabricado é exibido.
          </p>
        </div>
      </div>
    );
  }

  const { aggregate, topMovers, source, scope } = flows;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Protocolos em Alta 24h</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono font-bold text-lg text-emerald-400 mt-1">{aggregate.gainers24h}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Entradas de TVL (inflow).</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Protocolos em Baixa 24h</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-mono font-bold text-lg text-rose-400 mt-1">{aggregate.losers24h}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Saídas de TVL (outflow).</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Variação Média Abs.</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="font-mono font-bold text-lg text-white mt-1">
            {aggregate.avgAbsChange24h >= 0 ? '+' : ''}{aggregate.avgAbsChange24h}%
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">Movimentação média por protocolo.</p>
        </div>

        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">Protocolos Varridos</span>
            <Database className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="font-mono font-bold text-lg text-white mt-1">{aggregate.protocolsScanned.toLocaleString()}</div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5">{source} · {scope}.</p>
        </div>
      </div>

      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        <div className="p-3 border-b border-[#24272C] bg-[#16191D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Top Movers por Variação de TVL</h3>
          </div>
          <span className="text-[10px] font-mono text-sky-400 bg-[#0A0B0D] px-2 py-0.5 rounded border border-[#24272C]">
            Dados reais
          </span>
        </div>

        <div className="divide-y divide-[#24272C]/60">
          {topMovers.length === 0 && (
            <div className="p-3 text-[10px] font-mono text-[#6B7280]">Nenhum protocolo com variação reportada.</div>
          )}
          {topMovers.map((m) => {
            const up = m.changePct > 0;
            const neutral = m.changePct === 0;
            return (
              <div key={m.name} className="p-2.5 hover:bg-[#1C1F24] transition-colors flex items-center justify-between font-mono">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded flex items-center justify-center border shrink-0 ${
                    up
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : neutral
                      ? 'bg-[#1C1F24] text-[#9CA3AF] border-[#24272C]'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {up ? <TrendingUp className="w-4 h-4" /> : neutral ? <Activity className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">{m.name}</span>
                      <span className="text-[#9CA3AF] text-[10px]">TVL {fmtUsd(m.tvlUsd)}</span>
                    </div>
                    <div className="text-[10px] text-[#6B7280] truncate">
                      {m.category} · {m.chains.join(', ')}
                    </div>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                  up
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : neutral
                    ? 'bg-[#1C1F24] text-[#9CA3AF] border border-[#24272C]'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {up ? '+' : ''}{m.changePct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
