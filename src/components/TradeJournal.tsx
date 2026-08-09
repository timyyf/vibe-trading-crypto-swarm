import React from 'react';
import { TradeJournalEntry } from '../types';
import { BookOpen, Clock, Download, CheckCircle, XCircle, Code, Shield, TrendingUp, Target, Percent, Layers } from 'lucide-react';
import { JOURNAL_MAX_ENTRIES, JOURNAL_TTL_DAYS } from '../lib/journal';

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

  const pnlColor = (value: number) => (value >= 0 ? 'text-emerald-400' : 'text-rose-400');

  const trades = entries.filter((e) => e.type !== 'OBSERVAÇÃO');
  const closed = trades.filter((e) => e.status === 'LUCRO' || e.status === 'PREJUÍZO');
  const wins = closed.filter((e) => e.status === 'LUCRO').length;
  const losses = closed.filter((e) => e.status === 'PREJUÍZO').length;
  const openCount = trades.filter((e) => e.status === 'EM_ANDAMENTO').length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const totalPnl = closed.reduce((acc, e) => acc + (e.pnlPercent ?? 0), 0);
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : null;
  const symbolCounts = new Map<string, number>();
  trades.forEach((e) => symbolCounts.set(e.symbol, (symbolCounts.get(e.symbol) ?? 0) + 1));
  const topSymbols = [...symbolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const statCard = (icon: React.ReactNode, label: string, value: string, valueClass = 'text-white') => (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#1C1F24] border border-[#24272C] rounded-lg">
      <span className="text-emerald-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] font-mono font-bold text-[#9CA3AF] uppercase tracking-wider">{label}</div>
        <div className={`text-sm font-mono font-bold ${valueClass} truncate`}>{value}</div>
      </div>
    </div>
  );

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

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1.5 rounded bg-[#1C1F24] border border-[#24272C] font-mono text-[10px] font-bold text-[#9CA3AF]">
            {entries.length}/{JOURNAL_MAX_ENTRIES} registros • retenção {JOURNAL_TTL_DAYS}d
          </div>

        <button
          onClick={exportPineScript}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1C1F24] hover:bg-[#24272C] text-emerald-400 border border-[#24272C] font-mono font-bold text-xs uppercase transition-colors"
        >
          <Code className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export Pine Script v6</span>
        </button>
        </div>
      </div>

      {/* Performance Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {statCard(
            <Target className="w-4 h-4" />,
            'Win-rate',
            winRate !== null ? `${winRate.toFixed(0)}%` : '—',
            winRate !== null ? pnlColor(winRate - 50) : ''
          )}
          {statCard(
            <TrendingUp className="w-4 h-4" />,
            'PnL total',
            totalPnl !== 0 ? `${totalPnl.toFixed(1)}%` : '0%',
            pnlColor(totalPnl)
          )}
          {statCard(
            <Percent className="w-4 h-4" />,
            'PnL médio',
            avgPnl !== null ? `${avgPnl.toFixed(1)}%` : '—',
            avgPnl !== null ? pnlColor(avgPnl) : ''
          )}
          {statCard(
            <Shield className="w-4 h-4" />,
            'Fechados (L/L)',
            `${closed.length} (${wins}/${losses})`
          )}
          {statCard(
            <Layers className="w-4 h-4" />,
            'Abertos • Top',
            `${openCount} • ${topSymbols.map(([s]) => s).join(', ') || '—'}`
          )}
        </div>
      )}

      {/* Journal Table */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#6B7280] space-y-2">
            <Clock className="w-6 h-6 text-[#6B7280] mx-auto" />
            <p>Nenhum trade registrado no diário ainda.</p>
            <p className="text-[#9CA3AF]">
              Vá para a <span className="text-emerald-400 font-bold uppercase">Sala de Reuniões</span> e rode uma análise — operações e observações do comitê são registradas automaticamente.
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
                  const isObservation = entry.type === 'OBSERVAÇÃO';

                  return (
                    <tr key={entry.id} className="hover:bg-[#1C1F24] transition-colors">
                      <td className="py-2 px-3 text-[#6B7280]">{dateStr}</td>

                      <td className="py-2 px-3 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{entry.symbol}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase ${
                              isObservation
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : entry.type === 'COMPRA'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-white">
                        {entry.entryPrice !== undefined ? `$${entry.entryPrice.toLocaleString()}` : '—'}
                      </td>

                      <td className="py-2 px-3 text-right text-[11px]">
                        {isObservation || entry.targetPrice === undefined || entry.stopPrice === undefined ? (
                          <span className="text-[#6B7280]">—</span>
                        ) : (
                          <>
                            <div className="text-emerald-400">TP: ${entry.targetPrice.toLocaleString()}</div>
                            <div className="text-rose-400">SL: ${entry.stopPrice.toLocaleString()}</div>
                          </>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        {isObservation ? (
                          <span className="text-[#6B7280]">—</span>
                        ) : isExpired ? (
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
                            isObservation
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : entry.status === 'EM_ANDAMENTO'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : entry.status === 'LUCRO'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isObservation ? 'OBSERVAÇÃO' : entry.status}
                        </span>
                        {!isObservation && entry.pnlPercent !== undefined && (
                          <div className={`mt-0.5 text-[10px] font-bold ${pnlColor(entry.pnlPercent)}`}>
                            {entry.pnlPercent >= 0 ? '+' : ''}{entry.pnlPercent.toFixed(1)}%
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center space-x-1">
                        {!isObservation && (
                          <>
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
                          </>
                        )}
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

