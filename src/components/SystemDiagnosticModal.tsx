import React from 'react';
import { ShieldAlert, Cpu, Activity, Wifi, X, RefreshCw, AlertTriangle, CheckCircle2, Server, Radio } from 'lucide-react';
import { SystemDiagnosticResult } from '../types';

interface SystemDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemHealth: SystemDiagnosticResult | null;
  isChecking: boolean;
  onRunDiagnosticNow: (simulateAgent?: string, simulateDegraded?: boolean) => void;
}

export const SystemDiagnosticModal: React.FC<SystemDiagnosticModalProps> = ({
  isOpen,
  onClose,
  systemHealth,
  isChecking,
  onRunDiagnosticNow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121417] border border-[#24272C] rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl font-mono text-[#D1D5DB]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1C1F24] border-b border-[#24272C]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Autodiagnóstico do Sistema & Status dos Agentes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#24272C] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Overview Banner */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#0A0B0D] rounded border border-[#24272C]">
            <div className="flex items-center gap-3">
              {systemHealth?.overallStatus === 'ONLINE' ? (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Status Global:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      systemHealth?.overallStatus === 'ONLINE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {systemHealth?.overallStatus === 'ONLINE' ? '100% OPERACIONAL' : 'DESEMPENHO REDUZIDO'}
                  </span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {systemHealth?.activeAgentsCount ?? 0} de {systemHealth?.totalAgentsCount ?? 6} componentes sincronizados em tempo real. Latência média:{' '}
                  <span className="text-emerald-400 font-bold">{systemHealth?.latencyMs ?? 14}ms</span>.
                </p>
              </div>
            </div>

            <button
              onClick={() => onRunDiagnosticNow()}
              disabled={isChecking}
              className="px-3 py-1.5 rounded bg-[#1C1F24] hover:bg-[#24272C] text-xs text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isChecking ? 'Diagnosticando...' : 'Reavaliar Agora'}</span>
            </button>
          </div>

          {/* Diagnostic Warning Alert */}
          {systemHealth?.warningMessage && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Aviso de Desempenho Reduzido:</span>
                <span>{systemHealth.warningMessage}</span>
              </div>
            </div>
          )}

          {/* Component Diagnostics Grid */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Conectores e Agentes de Análise (6)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {systemHealth?.diagnostics.map((diag) => (
                <div
                  key={diag.id}
                  className={`p-2.5 rounded bg-[#0A0B0D] border transition-all ${
                    diag.status === 'ONLINE'
                      ? 'border-[#24272C]'
                      : diag.status === 'DEGRADED'
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-red-500/40 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Radio
                        className={`w-3.5 h-3.5 ${
                          diag.status === 'ONLINE'
                            ? 'text-emerald-400 animate-pulse'
                            : diag.status === 'DEGRADED'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-white">{diag.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        diag.status === 'ONLINE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : diag.status === 'DEGRADED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {diag.status === 'ONLINE' ? 'ONLINE' : diag.status === 'DEGRADED' ? 'DEGRADADO' : 'DESCONECTADO'}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#9CA3AF] mt-1 line-clamp-2">{diag.details}</p>

                  <div className="flex items-center justify-between text-[9px] font-mono text-[#6B7280] mt-2 pt-1 border-t border-[#1C1F24]">
                    <span>Tipo: {diag.type === 'connector' ? 'Conector de Dados' : 'Agente Swarm'}</span>
                    <span className="text-emerald-400 font-bold">Latência: {diag.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Simulation Test Controls */}
          <div className="p-3 bg-[#0A0B0D] rounded border border-[#24272C] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[#9CA3AF] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Simulação de Teste de Diagnóstico (Modo QA)</span>
              </span>
              <span className="text-[9px] text-[#6B7280]">Testar comportamento do alerta</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onRunDiagnosticNow(undefined, false)}
                className="px-2 py-1 bg-[#1C1F24] hover:bg-[#24272C] text-[10px] text-emerald-400 rounded border border-[#24272C]"
              >
                100% Online
              </button>
              <button
                onClick={() => onRunDiagnosticNow('sentiment', false)}
                className="px-2 py-1 bg-[#1C1F24] hover:bg-[#24272C] text-[10px] text-amber-400 rounded border border-amber-500/30"
              >
                Simular Desconexão Agente Sofia
              </button>
              <button
                onClick={() => onRunDiagnosticNow('market_feed', false)}
                className="px-2 py-1 bg-[#1C1F24] hover:bg-[#24272C] text-[10px] text-red-400 rounded border border-red-500/30"
              >
                Simular Desconexão Feed Binance
              </button>
              <button
                onClick={() => onRunDiagnosticNow(undefined, true)}
                className="px-2 py-1 bg-[#1C1F24] hover:bg-[#24272C] text-[10px] text-cyan-400 rounded border border-cyan-500/30"
              >
                Simular Alta Latência
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#1C1F24] border-t border-[#24272C] flex items-center justify-between text-[10px] text-[#6B7280]">
          <span>Verificação automática a cada 15 segundos em segundo plano</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#24272C] hover:bg-[#374151] text-white rounded font-bold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
