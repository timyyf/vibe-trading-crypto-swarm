import React from 'react';
import { TrendingUp, Users, ShieldAlert, Cpu, BookOpen, Flame, Clock, Bell, BellOff, BrainCircuit } from 'lucide-react';
import { SystemDiagnosticResult } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  topCount: number;
  activeSymbol: string;
  hasActiveSignal: boolean;
  signalCountdown: string;
  systemHealth: SystemDiagnosticResult | null;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  topCount,
  activeSymbol,
  hasActiveSignal,
  signalCountdown,
  systemHealth,
  notificationsEnabled,
  onToggleNotifications,
  onOpenDiagnostics,
}) => {
  const isHealthOk = systemHealth?.overallStatus === 'ONLINE';

  return (
    <header className="sticky top-0 z-50 bg-[#121417] border-b border-[#24272C] text-[#D1D5DB] px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('swarm')}>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isHealthOk ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
            <span className="font-mono text-sm font-bold tracking-tighter text-white uppercase">
              Vibe-Trading // Swarm-01
            </span>
          </div>
          <div className="h-4 w-px bg-[#24272C] hidden sm:block"></div>
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              TEMPO REAL (3s)
            </span>
            <span className={isHealthOk ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              ● {isHealthOk ? 'Sincronizado' : 'Modo Degradado'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#0A0B0D] p-1 rounded border border-[#24272C]">
          <button
            onClick={() => setActiveTab('swarm')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'swarm'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Comitê Swarm</span>
          </button>

          <button
            onClick={() => setActiveTab('top100')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'top100'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Top 100 ({topCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'chart'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gráfico ({activeSymbol})</span>
          </button>

          <button
            onClick={() => setActiveTab('whales')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'whales'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>Baleias</span>
          </button>

          <button
            onClick={() => setActiveTab('alpha')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'alpha'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Alpha Zoo</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'journal'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Diário</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'knowledge'
                ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
            <span>Knowledge</span>
          </button>
        </nav>

        {/* Right Status */}
        <div className="flex items-center gap-3">
          {hasActiveSignal && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold px-2.5 py-1 rounded uppercase tracking-tighter">
              <Clock className="w-3.5 h-3.5" />
              <span>VAL: {signalCountdown}</span>
            </div>
          )}

          {/* Notification Toggle */}
          <button
            onClick={onToggleNotifications}
            aria-pressed={notificationsEnabled}
            aria-label={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
            className={`text-[10px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
              notificationsEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-[#1C1F24] border-[#24272C] text-[#9CA3AF] hover:border-[#374151]'
            }`}
            title={
              notificationsEnabled
                ? 'Notificações ativas — alerta de sinal forte + re-check a cada 5min'
                : 'Ativar notificações de sinal forte'
            }
          >
            {notificationsEnabled ? (
              <Bell className="w-3.5 h-3.5" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{notificationsEnabled ? 'NOTIF: ON' : 'NOTIF: OFF'}</span>
          </button>

          {/* System Diagnostic Status Badge */}
          <button
            onClick={onOpenDiagnostics}
            className={`text-[10px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
              isHealthOk
                ? 'bg-[#1C1F24] border-[#24272C] hover:border-emerald-500/50'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse'
            }`}
            title="Clique para abrir o Painel de Autodiagnóstico dos Agentes"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthOk ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
              }`}
            ></span>
            <span className="text-[#9CA3AF]">SYS:</span>
            <span className={`font-bold ${isHealthOk ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isHealthOk ? `${systemHealth?.latencyMs ?? 14}ms OK` : 'AVISO'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex overflow-x-auto py-1.5 px-1 gap-1 border-t border-[#24272C] mt-2 bg-[#0A0B0D]">
        <button
          onClick={() => setActiveTab('swarm')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'swarm' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <Users className="w-3 h-3 text-emerald-400" />
          <span>Comitê</span>
        </button>
        <button
          onClick={() => setActiveTab('top100')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'top100' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>Top 100</span>
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'chart' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <TrendingUp className="w-3 h-3 text-cyan-400" />
          <span>Gráfico</span>
        </button>
        <button
          onClick={() => setActiveTab('whales')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'whales' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-purple-400" />
          <span>Baleias</span>
        </button>
        <button
          onClick={() => setActiveTab('alpha')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'alpha' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span>Alpha</span>
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded text-[10px] font-mono uppercase ${
            activeTab === 'knowledge' ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]' : 'text-[#9CA3AF]'
          }`}
        >
          <BrainCircuit className="w-3 h-3 text-violet-400" />
          <span>Knowledge</span>
        </button>
      </div>
    </header>
  );
};
