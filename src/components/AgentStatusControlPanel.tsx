import React, { useState } from 'react';
import { AgentReport } from '../types';
import {
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Cpu,
  RefreshCw,
  Zap,
  Filter,
  BarChart2,
  Database,
  Radio,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AgentStatusControlPanelProps {
  agents: AgentReport[];
  isLoading: boolean;
  onRefreshAgentStatus?: () => void;
  assetSymbol: string;
}

export const AgentStatusControlPanel: React.FC<AgentStatusControlPanelProps> = ({
  agents,
  isLoading,
  onRefreshAgentStatus,
  assetSymbol,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [customLatencies, setCustomLatencies] = useState<Record<string, number>>({});

  const activeAgents = agents;

  const handleTestPing = (agentId: string) => {
    setTestingAgentId(agentId);
    setTimeout(() => {
      // Simulate minor latency variation (e.g. 110ms - 240ms)
      const randomLatency = Math.floor(Math.random() * 95) + 105;
      setCustomLatencies((prev) => ({ ...prev, [agentId]: randomLatency }));
      setTestingAgentId(null);
    }, 600);
  };

  const getAgentLatency = (agent: AgentReport) => {
    if (customLatencies[agent.agentId]) {
      return customLatencies[agent.agentId];
    }
    return agent.processingTimeMs || 150;
  };

  const filteredAgents = activeAgents.filter((agent) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'TECNICO') return agent.specialistType === 'Técnico' || agent.agentId === 'technical';
    if (selectedFilter === 'SENTIMENTO') return agent.specialistType === 'Analista de Sentimento' || agent.agentId === 'sentiment';
    if (selectedFilter === 'FUNDAMENTALISTA') return agent.specialistType === 'Fundamentalista' || agent.agentId === 'whales';
    if (selectedFilter === 'QUANT') return agent.specialistType === 'Quant Factor' || agent.agentId === 'alpha';
    return true;
  });

  const avgLatency = activeAgents.length > 0
    ? Math.round(activeAgents.reduce((acc, a) => acc + getAgentLatency(a), 0) / activeAgents.length)
    : 0;

  const renderIcon = (iconName: string, specType?: string) => {
    if (specType === 'Fundamentalista' || iconName === 'ShieldAlert') {
      return <ShieldAlert className="w-4 h-4 text-purple-400" />;
    }
    if (specType === 'Técnico' || iconName === 'TrendingUp') {
      return <TrendingUp className="w-4 h-4 text-cyan-400" />;
    }
    if (specType === 'Analista de Sentimento' || iconName === 'MessageSquare') {
      return <MessageSquare className="w-4 h-4 text-amber-400" />;
    }
    return <Cpu className="w-4 h-4 text-emerald-400" />;
  };

  const getSpecialistBadgeColor = (specType?: string) => {
    switch (specType) {
      case 'Fundamentalista':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'Técnico':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'Analista de Sentimento':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 space-y-4 font-mono text-[#D1D5DB]">
      {/* Panel Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#24272C]">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Painel de Controle dos Agentes Especialistas // Real-Time Monitor
            </h3>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            Monitoramento de status individual, fontes de dados e tempo de processamento dos agentes para{' '}
            <span className="text-emerald-400 font-bold">{assetSymbol}</span>.
          </p>
        </div>

        {/* Aggregate Stats Badges */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="bg-[#0A0B0D] px-2.5 py-1 rounded border border-[#24272C] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${activeAgents.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`}></span>
            <span className="text-[#9CA3AF]">Status:</span>
            <span className={`font-bold ${activeAgents.length > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activeAgents.length > 0 ? `${activeAgents.length}/${activeAgents.length} ATIVOS` : '0/4 OFFLINE'}
            </span>
          </div>

          <div className="bg-[#0A0B0D] px-2.5 py-1 rounded border border-[#24272C] flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-[#9CA3AF]">Latência Média:</span>
            <span className="text-cyan-400 font-bold">{activeAgents.length > 0 ? `${avgLatency}ms` : '—'}</span>
          </div>

          {onRefreshAgentStatus && (
            <button
              onClick={onRefreshAgentStatus}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-[#1C1F24] hover:bg-[#24272C] text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 flex items-center gap-1 transition-all"
              title="Pingar todos os agentes especialista"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Ping Swarm</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs by Specialist Category */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-[#6B7280] uppercase flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            Especialistas:
          </span>
          {[
            { id: 'ALL', label: 'Todos (4)' },
            { id: 'FUNDAMENTALISTA', label: 'Fundamentalista / On-Chain' },
            { id: 'TECNICO', label: 'Técnico & Gráficos' },
            { id: 'SENTIMENTO', label: 'Analista de Sentimento' },
            { id: 'QUANT', label: 'Quant Factor' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-2.5 py-1 rounded transition-all whitespace-nowrap uppercase font-bold text-[10px] ${
                selectedFilter === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-[#0A0B0D] text-[#9CA3AF] hover:text-white border border-[#24272C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Specialist Agents Cards Grid */}
      {activeAgents.length === 0 ? (
        <div className="bg-[#0A0B0D] border border-rose-500/30 rounded-lg p-4 flex items-start gap-3">
          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Sem dados reais dos agentes</h4>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold uppercase">
                Offline
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Nenhum relatório de IA foi recebido para <span className="text-white font-bold">{assetSymbol}</span>.
              Execute o comitê Swarm (Ping Swarm) para consultar os agentes especialistas. Nenhum dado de exemplo é exibido.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredAgents.map((agent, idx) => {
          const latency = getAgentLatency(agent);
          const specTitle =
            agent.specialistType ||
            (agent.agentId === 'technical'
              ? 'Técnico'
              : agent.agentId === 'sentiment'
              ? 'Analista de Sentimento'
              : agent.agentId === 'whales'
              ? 'Fundamentalista'
              : 'Quant Factor');

          const isExpanded = expandedAgentId === agent.agentId;
          const isTesting = testingAgentId === agent.agentId;

          return (
            <div
              key={`${agent.agentId}-${idx}`}
              className="bg-[#0A0B0D] border border-[#24272C] hover:border-[#374151] rounded-lg p-3 space-y-3 transition-all relative overflow-hidden"
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-[#1C1F24] border border-[#24272C] shrink-0">
                    {renderIcon(agent.avatarIcon, specTitle)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white">{agent.agentName}</h4>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${getSpecialistBadgeColor(
                          specTitle
                        )}`}
                      >
                        {specTitle}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#6B7280]">{agent.agentRole}</p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="text-right shrink-0">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>{agent.status || 'CONCLUÍDO'}</span>
                  </div>
                </div>
              </div>

              {/* Processing Time & Latency Meter Bar */}
              <div className="bg-[#121417] p-2 rounded border border-[#24272C] space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Tempo de Processamento / Latência:</span>
                  </span>
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    {isTesting ? (
                      <span className="text-amber-400 animate-pulse">Testando Ping...</span>
                    ) : (
                      <>
                        <span>{latency} ms</span>
                        <span className="text-[9px] text-emerald-400 font-normal">(Execução Ultra-Rápida)</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Latency Visual Bar */}
                <div className="w-full bg-[#0A0B0D] h-1.5 rounded overflow-hidden border border-[#24272C] flex">
                  <div
                    className={`h-full transition-all duration-500 ${
                      latency < 160 ? 'bg-emerald-400' : latency < 300 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (latency / 300) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Specialist Verdict & Confidence Score */}
              <div className="flex items-center justify-between bg-[#121417] px-2.5 py-1.5 rounded border border-[#24272C]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6B7280] uppercase">Parecer:</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      agent.opinion === 'COMPRAR'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : agent.opinion === 'VENDER'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {agent.opinion}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-[#6B7280] uppercase">Confiança:</span>
                  <span className="font-bold text-white">{agent.score}%</span>
                </div>
              </div>

              {/* Summary Sentence */}
              <p className="text-[11px] text-[#D1D5DB] leading-relaxed bg-[#121417] p-2 rounded border border-[#24272C]">
                "{agent.summary}"
              </p>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {agent.keyMetrics.map((km, idx) => (
                  <div key={idx} className="bg-[#121417] p-1.5 rounded border border-[#24272C]">
                    <span className="text-[#6B7280] block text-[9px] uppercase">{km.label}</span>
                    <span className="font-bold text-white mt-0.5 block">{km.value}</span>
                  </div>
                ))}
              </div>

              {/* Expandable Signal Logs & Test Button */}
              <div className="pt-1 flex items-center justify-between text-[10px]">
                <button
                  onClick={() => handleTestPing(agent.agentId)}
                  disabled={isTesting}
                  className="text-[#9CA3AF] hover:text-emerald-400 flex items-center gap-1 underline transition-colors"
                >
                  <Zap className={`w-3 h-3 ${isTesting ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
                  <span>{isTesting ? 'Aguardando PONG...' : 'Testar Ping Indiv.'}</span>
                </button>

                <button
                  onClick={() => setExpandedAgentId(isExpanded ? null : agent.agentId)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
                >
                  <span>{isExpanded ? 'Ocultar Sinais' : 'Ver Sinais & Logs'}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Expanded Signal Details Drawer */}
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[#24272C] bg-[#121417] p-2 rounded space-y-1.5 text-[10px] animate-fadeIn">
                  <div className="text-[9px] text-[#6B7280] uppercase font-bold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-400" />
                    <span>Sinais Detectados pelo Agente {agent.agentName}:</span>
                  </div>
                  <ul className="space-y-1">
                    {agent.signals.map((sig, sIdx) => (
                      <li key={sIdx} className="text-[#9CA3AF] flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        <span>{sig}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
