import React from 'react';
import { ShieldAlert, AlertTriangle, X, Activity, RefreshCw } from 'lucide-react';
import { SystemDiagnosticResult } from '../types';

interface SystemWarningToastProps {
  systemHealth: SystemDiagnosticResult | null;
  onDismiss: () => void;
  onOpenDiagnostics: () => void;
}

export const SystemWarningToast: React.FC<SystemWarningToastProps> = ({
  systemHealth,
  onDismiss,
  onOpenDiagnostics,
}) => {
  if (!systemHealth || systemHealth.overallStatus === 'ONLINE' || !systemHealth.warningMessage) {
    return null;
  }

  // Find which agents or connectors are disconnected or degraded
  const disconnectedList = systemHealth.diagnostics.filter((d) => d.status === 'DISCONNECTED');
  const degradedList = systemHealth.diagnostics.filter((d) => d.status === 'DEGRADED');

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full font-mono animate-slideUp transition-all">
      <div className="bg-[#121417] border border-amber-500/50 rounded-lg p-3.5 shadow-2xl backdrop-blur-md text-[#D1D5DB] relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

        <div className="flex items-start gap-3">
          {/* Warning Icon */}
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>

          {/* Toast Message Content */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>System Warning // Desempenho Reduzido</span>
              </span>
              <button
                onClick={onDismiss}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-[#24272C] transition-colors"
                title="Dispensar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-[#E5E7EB] leading-relaxed">
              Desconexão ou instabilidade detectada no sistema. O comitê está operando em modo de contingência.
            </p>

            {/* Affected Agent Badges */}
            <div className="flex flex-wrap gap-1 my-1.5">
              {disconnectedList.map((d) => (
                <span
                  key={d.id}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                  <span>{d.name}: Desconectado</span>
                </span>
              ))}
              {degradedList.map((d) => (
                <span
                  key={d.id}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>{d.name}: Degradado</span>
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-[#24272C] mt-2">
              <span className="text-[10px] text-[#9CA3AF]">
                {systemHealth.activeAgentsCount}/{systemHealth.totalAgentsCount} Agentes Operacionais
              </span>
              <button
                onClick={onOpenDiagnostics}
                className="text-[10px] font-bold uppercase text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
              >
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>Ver Diagnóstico Completo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
