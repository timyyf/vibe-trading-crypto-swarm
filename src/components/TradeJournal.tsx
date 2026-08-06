import React from 'react';
import { TradeJournalEntry } from '../types';
import { BookOpen, Clock, Download, CheckCircle, XCircle, Code, Shield } from 'lucide-react';

interface TradeJournalProps {
  entries: TradeJournalEntry[];
  onRemoveEntry: (id: string) => void;
  onUpdateStatus: (id: string, status: TradeJournalEntry['status']) => void;
}

export const TradeJournal: React.FC<TradeJournalProps> = ({ entries, onRemoveEntry, onUpdateStatus }) => {
  const exportPineScript = () => {
    const script = `//@version=6
strategy("Vibe-Trading Swarm Multi-Agent Signal", overlay=true, margin_long=100, margin_short=100)

// Multi-Agent Parameters
emaLength = input.int(20, title="EMA Length")
rsiLength = input.int(14, title="RSI Length")

emaVal = ta.ema(close, emaLength)
rsiVal = ta.rsi(close, rsiLength)

longCondition = ta.crossover(close, emaVal) and rsiVal > 50
if (longCondition)
    strategy.entry("Swarm Buy", strategy.long)

shortCondition = ta.crossunder(close, emaVal) and rsiVal < 50
if (shortCondition)
    strategy.entry("Swarm Sell", strategy.short)
`;
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'VibeTrading_SwarmStrategy.pine';
    link.click();
  };

  return (
    <div className="space-y-3">
      {/* Header Banner */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">Diário de Trades & Histórico do Comitê</h2>
          </div>
          <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">
            Registro das operações iniciadas via sala de reuniões dos agentes com acompanhamento de contagem regressiva e resultado.
          </p>
        </div>

        <button
          onClick={exportPineScript}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1C1F24] hover:bg-[#24272C] text-emerald-400 border border-[#24272C] font-mono font-bold text-xs uppercase transition-colors"
        >
          <Code className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export Pine Script v6</span>
        </button>
      </div>

      {/* Journal Table */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#6B7280] space-y-2">
            <Clock className="w-6 h-6 text-[#6B7280] mx-auto" />
            <p>Nenhum trade registrado no diário ainda.</p>
            <p className="text-[#9CA3AF]">
              Vá para a <span className="text-emerald-400 font-bold uppercase">Sala de Reuniões</span> e clique em "Registrar Operação no Diário" após gerar uma análise.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#24272C] bg-[#0A0B0D] text-[10px] font-mono font-bold text-[#9CA3AF] uppercase tracking-wider">
                  <th className="py-2 px-3">Hora</th>
                  <th className="py-2 px-3">Ativo / Tipo</th>
                  <th className="py-2 px-3 text-right">Entrada</th>
                  <th className="py-2 px-3 text-right">Alvo / Stop</th>
                  <th className="py-2 px-3 text-center">Validade</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24272C]/60 text-xs font-mono">
                {entries.map((entry) => {
                  const dateStr = new Date(entry.timestamp).toLocaleTimeString();
                  const remainingSecs = Math.max(0, Math.floor((entry.expiryTimestamp - Date.now()) / 1000));
                  const m = Math.floor(remainingSecs / 60);
                  const s = remainingSecs % 60;
                  const isExpired = remainingSecs <= 0;

                  return (
                    <tr key={entry.id} className="hover:bg-[#1C1F24] transition-colors">
                      <td className="py-2 px-3 text-[#6B7280]">{dateStr}</td>

                      <td className="py-2 px-3 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{entry.symbol}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase ${
                              entry.type === 'COMPRA'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-white">
                        ${entry.entryPrice.toLocaleString()}
                      </td>

                      <td className="py-2 px-3 text-right text-[11px]">
                        <div className="text-emerald-400">TP: ${entry.targetPrice.toLocaleString()}</div>
                        <div className="text-rose-400">SL: ${entry.stopPrice.toLocaleString()}</div>
                      </td>

                      <td className="py-2 px-3 text-center">
                        {isExpired ? (
                          <span className="text-[#6B7280]">Expirado ({entry.durationMinutes}m)</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">
                            {m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')} min
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            entry.status === 'EM_ANDAMENTO'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : entry.status === 'LUCRO'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-center space-x-1">
                        <button
                          onClick={() => onUpdateStatus(entry.id, 'LUCRO')}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-[9px] font-bold uppercase"
                          title="Marcar como Lucro"
                        >
                          + Profit
                        </button>
                        <button
                          onClick={() => onUpdateStatus(entry.id, 'PREJUÍZO')}
                          className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-[9px] font-bold uppercase"
                          title="Marcar como Stop Loss"
                        >
                          - Loss
                        </button>
                        <button
                          onClick={() => onRemoveEntry(entry.id)}
                          className="px-1.5 py-0.5 rounded bg-[#1C1F24] text-[#6B7280] hover:text-white text-[9px]"
                        >
                          X
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

