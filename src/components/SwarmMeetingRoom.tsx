import React, { useState, useEffect } from 'react';
import { CryptoAsset, SwarmAnalysisResult, TradeJournalEntry, TradeDecision, AgentReport } from '../types';
import { AgentStatusControlPanel } from './AgentStatusControlPanel';
import { SwarmDebugModal } from './SwarmDebugModal';
import {
  Users,
  Bot,
  Play,
  Clock,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Target,
  Shield,
  Zap,
  BookMarked,
  ArrowRight,
  RotateCcw,
  Activity,
  Sliders,
  Bug,
  Info,
} from 'lucide-react';

interface SwarmMeetingRoomProps {
  selectedAsset: CryptoAsset;
  assets: CryptoAsset[];
  onSelectAsset: (asset: CryptoAsset) => void;
  swarmResult: SwarmAnalysisResult | null;
  isLoading: boolean;
  onRunSwarm: (symbol: string, durationMinutes: number) => void;
  onAddToJournal: (entry: Omit<TradeJournalEntry, 'id' | 'timestamp'>) => void;
  onSwarmResultUpdated?: (result: SwarmAnalysisResult) => void;
}

const ALL_SPECIALIST_AGENTS = [
  {
    agentId: 'technical',
    agentName: 'Dr. Quant Graph',
    agentRole: 'Análise Técnica Quantitativa Multi-Timeframe',
    specialistType: 'Técnico',
    icon: TrendingUp,
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    desc: 'Análise de confluência multi-timeframe (15m, 1h, 4h, 1d) com MACD, StochRSI, ADX, Bollinger, VWAP e Candlesticks...',
  },
  {
    agentId: 'sentiment',
    agentName: 'Sofia Sentiment',
    agentRole: 'Psicologia de Mercado, FinBERT Social & Funding Rates',
    specialistType: 'Analista de Sentimento',
    icon: MessageSquare,
    badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    desc: 'Analisando Fear & Greed 30d/90d, FinBERT NLP (Reddit/X), Google Trends, Funding Rate de Perpétuos e Liquidation Heatmap...',
  },
  {
    agentId: 'orderbook',
    agentName: 'OrderBook Sentinel',
    agentRole: 'Microestrutura de Mercado, OBI L2, Volume Delta & Slippage',
    specialistType: 'Especialista em Liquidez',
    icon: Sliders,
    badgeColor: 'border-sky-500/40 text-sky-400 bg-sky-500/10',
    desc: 'Analisando Order Book Imbalance (OBI L2), Volume Profile (POC), CVD / Delta Volume Net, Paredes de Liquidez e Slippage...',
  },
  {
    agentId: 'whales',
    agentName: 'Whale Tracker Apex',
    agentRole: 'Inteligência On-Chain, Clustering de Baleias, Netflows & MVRV/SOPR',
    specialistType: 'Fundamentalista',
    icon: ShieldAlert,
    badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    desc: 'Auditando Exchange Netflow USD, Whale Ratio (>0.85), Inflows de Stablecoins, MVRV, SOPR e Clusters de Baleias (>3 dias)...',
  },
  {
    agentId: 'alpha',
    agentName: 'Alpha Zoo Engine',
    agentRole: 'GTJA-191 & Alpha101, Walk-Forward, Neutralização Beta & HMM Regime',
    specialistType: 'Quant Factor',
    icon: Cpu,
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    desc: 'Analisando GTJA-191 / Alpha101, IC 5d, Walk-Forward (90d/7d com taxas 0.1%), Beta-Hedging e Regime HMM...',
  },
  {
    agentId: 'risk',
    agentName: 'Risk Protocol Officer',
    agentRole: 'Alocação Fractional Kelly, VaR 95%, CVaR, Vol-Targeting & Poder de Veto',
    specialistType: 'Risk Manager',
    icon: Shield,
    badgeColor: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    desc: 'Auditando RRR (>= 1:2.0), ATR(14)x2 Stop Loss, Fractional Kelly (0.5x), VaR 95%, Stress Test (-15%) e Veto de Capital...',
  },
];

export const SwarmMeetingRoom: React.FC<SwarmMeetingRoomProps> = ({
  selectedAsset,
  assets,
  onSelectAsset,
  swarmResult,
  isLoading,
  onRunSwarm,
  onAddToJournal,
  onSwarmResultUpdated,
}) => {
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [tradeEntryTimestamp, setTradeEntryTimestamp] = useState<number | null>(null);
  const [extendedSeconds, setExtendedSeconds] = useState<number>(0);
  const [addedToJournal, setAddedToJournal] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('Iniciando comitê de IA...');
  const [extensionNotice, setExtensionNotice] = useState<string | null>(null);
  const [roomViewMode, setRoomViewMode] = useState<'CONTROL_PANEL' | 'CONSENSUS_ROOM'>('CONTROL_PANEL');
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Real-time Partial Streaming States
  const [streamingAgents, setStreamingAgents] = useState<AgentReport[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);

  // Fallback Loading animation if streaming is not used
  useEffect(() => {
    if (!isLoading && !isStreaming) {
      setLoadingProgress(0);
      return;
    }

    if (isLoading && !isStreaming) {
      setLoadingProgress(15);
      setCurrentStepText(`Coletando métricas e klines para ${selectedAsset.symbol}...`);

      const steps = [
        { pct: 25, text: `1/6: Dr. Quant Graph calculando EMA20, SMA50 e oscilador RSI...` },
        { pct: 40, text: `2/6: Sofia Sentiment auditando Reddit, CryptoNews e Fear & Greed...` },
        { pct: 55, text: `3/6: OrderBook Sentinel analisando profundidade e spread spot...` },
        { pct: 70, text: `4/6: Whale Tracker Apex rastreando transações em bloco >$100k...` },
        { pct: 85, text: `5/6: Alpha Zoo Engine simulando fatores quantitativos GTJA-191...` },
        { pct: 95, text: `6/6: Risk Protocol Officer calculando parâmetros de RRR e Stop Loss...` },
      ];

      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < steps.length) {
          setLoadingProgress(steps[stepIdx].pct);
          setCurrentStepText(steps[stepIdx].text);
          stepIdx++;
        }
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isLoading, isStreaming, selectedAsset.symbol]);

  const isNeutral = Boolean(
    swarmResult &&
    swarmResult.finalDecision !== 'COMPRAR' &&
    swarmResult.finalDecision !== 'VENDER'
  );

  // Countdown timer effect
  useEffect(() => {
    if (!swarmResult) return;

    const updateTimer = () => {
      if (isNeutral) {
        setRemainingSeconds(0);
        return;
      }

      const now = Date.now();
      const activeDurationMins = swarmResult.recommendedDurationMinutes || swarmResult.signalDurationMinutes;
      const baseDurationMs = (activeDurationMins * 60 * 1000) + (extendedSeconds * 1000);
      
      let targetExpiry = (swarmResult.timestamp + activeDurationMins * 60 * 1000) + (extendedSeconds * 1000);
      if (tradeEntryTimestamp) {
        targetExpiry = tradeEntryTimestamp + baseDurationMs;
      }

      const diffSec = Math.max(0, Math.floor((targetExpiry - now) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [swarmResult, tradeEntryTimestamp, extendedSeconds, isNeutral]);

  // Real-Time SSE Stream Executor for Partial Agent Conclusions
  const handleStartAnalysis = async () => {
    setAddedToJournal(false);
    setTradeEntryTimestamp(null);
    setExtendedSeconds(0);
    setExtensionNotice(null);
    setRoomViewMode('CONSENSUS_ROOM');

    setIsStreaming(true);
    setStreamingAgents([]);
    setLoadingProgress(8);
    setCurrentStepText(`Conectando transmissão do comitê para ${selectedAsset.symbol}...`);
    setActiveAgentIndex(0);

    try {
      const res = await fetch('/api/swarm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedAsset.symbol,
          name: selectedAsset.name,
          price: selectedAsset.price,
          change24h: selectedAsset.change24h,
          volume24h: selectedAsset.volume24h,
          high24h: selectedAsset.high24h,
          low24h: selectedAsset.low24h,
          signalDurationMinutes: durationMinutes,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Endpoint de streaming não retornou stream de dados.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event = JSON.parse(trimmed.slice(6));

              if (event.type === 'init') {
                setLoadingProgress(15);
                setCurrentStepText(`Comitê ativado. 6 Especialistas transmitindo análises em tempo real...`);
              } else if (event.type === 'agent_partial') {
                const partialAgent: AgentReport = event.agent;
                setStreamingAgents((prev) => {
                  const idx = prev.findIndex((a) => a.agentId === partialAgent.agentId);
                  if (idx !== -1) {
                    const copy = [...prev];
                    copy[idx] = partialAgent;
                    return copy;
                  }
                  return [...prev, partialAgent];
                });
                setActiveAgentIndex(event.agentIndex + 1);
                setCurrentStepText(`Especialista ${event.agentIndex + 1}/${event.totalAgents}: ${partialAgent.agentName} concluiu parecer parcial!`);
                setLoadingProgress(Math.min(95, Math.round(((event.agentIndex + 1) / event.totalAgents) * 80 + 15)));
              } else if (event.type === 'final_consensus') {
                setLoadingProgress(100);
                setCurrentStepText(`Consenso final do comitê sintetizado com sucesso!`);
                if (onSwarmResultUpdated) {
                  onSwarmResultUpdated(event.data);
                }
              }
            } catch (err) {
              console.error('Erro ao decodificar evento SSE:', err);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Fallback para requisição padrão:', err);
      onRunSwarm(selectedAsset.symbol, durationMinutes);
    } finally {
      setIsStreaming(false);
    }
  };

  // User explicitly clicks "Entrei no Trade Agora"
  const handleUserEnteredNow = () => {
    if (isNeutral) return;
    setTradeEntryTimestamp(Date.now());
    setExtensionNotice('Entrada confirmada! A contagem regressiva agora calcula o tempo seguro exato a partir deste instante.');
    setTimeout(() => setExtensionNotice(null), 6000);
  };

  // Auto-extend safe duration window (+5 min)
  const handleAutonomousExtend = () => {
    if (isNeutral) return;
    setExtendedSeconds((prev) => prev + 300);
    setExtensionNotice('Janela de tempo estendida autonomamente (+5 min) com base na sustentação do momentum do ativo!');
    setTimeout(() => setExtensionNotice(null), 6000);
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine validity advice
  const totalSecs = isNeutral ? 0 : (swarmResult?.signalDurationMinutes || 5) * 60;
  const pctRemaining = totalSecs > 0 ? (remainingSeconds / totalSecs) * 100 : 0;

  let validityStatus: 'VALE_ENTRAR' | 'EXPIRANDO' | 'NAO_ENTRAR' = 'VALE_ENTRAR';
  if (isNeutral || remainingSeconds <= 0) {
    validityStatus = 'NAO_ENTRAR';
  } else if (pctRemaining < 30) {
    validityStatus = 'EXPIRANDO';
  }

  const handleAddJournalClick = () => {
    if (!swarmResult) return;
    onAddToJournal({
      symbol: swarmResult.assetSymbol,
      type: swarmResult.finalDecision === 'COMPRAR' ? 'COMPRA' : 'VENDA',
      entryPrice: swarmResult.entryTarget,
      targetPrice: swarmResult.takeProfit,
      stopPrice: swarmResult.stopLoss,
      status: 'EM_ANDAMENTO',
      durationMinutes: swarmResult.signalDurationMinutes,
      expiryTimestamp: swarmResult.expiryTimestamp,
      confidence: swarmResult.confidenceScore,
      notes: swarmResult.summaryConsensus,
    });
    setAddedToJournal(true);
  };

  const renderAgentIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5 text-cyan-400" />;
      case 'MessageSquare':
        return <MessageSquare className="w-5 h-5 text-amber-400" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-purple-400" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-emerald-400" />;
      case 'Shield':
      case 'ShieldCheck':
        return <Shield className="w-5 h-5 text-rose-400" />;
      default:
        return <Bot className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Asset Picker */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#1C1F24] border border-[#24272C] flex items-center justify-center font-mono font-bold text-white text-sm">
              {selectedAsset.symbol.substring(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAsset.symbol}
                  onChange={(e) => {
                    const found = assets.find((a) => a.symbol === e.target.value);
                    if (found) onSelectAsset(found);
                  }}
                  className="bg-[#0A0B0D] text-white font-mono font-bold text-base rounded px-2 py-0.5 border border-[#24272C] focus:outline-none focus:border-emerald-500"
                >
                  {assets.slice(0, 40).map((a) => (
                    <option key={a.id} value={a.symbol}>
                      {a.symbol} - {a.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C1F24] text-[#9CA3AF] border border-[#24272C]">
                  Vol 24h: ${(selectedAsset.volume24h / 1e6).toFixed(1)}M
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 font-mono">
                Price: <span className="text-white font-bold">${selectedAsset.price.toLocaleString()}</span> (
                <span className={selectedAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {selectedAsset.change24h >= 0 ? '+' : ''}
                  {selectedAsset.change24h.toFixed(2)}%
                </span>
                )
              </p>
            </div>
          </div>

          {/* Duration Selector */}
          <div className="flex items-center gap-2 bg-[#0A0B0D] p-1.5 rounded border border-[#24272C]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">Janela Base:</span>
            <div className="flex gap-1">
              {[1, 3, 5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setDurationMinutes(mins)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase transition-all ${
                    durationMinutes === mins
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#121417]'
                  }`}
                  title={mins <= 3 ? 'Scalp rápido (baixa exposição)' : 'Operação Intraday'}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-5 py-2 rounded font-mono font-bold text-xs uppercase tracking-wider transition-all ${
              isLoading
                ? 'bg-[#1C1F24] text-[#6B7280] border border-[#24272C] cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Analisando Swarm...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Executar Reunião Swarm ({durationMinutes}m)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Swarm Room View Mode Selector (Painel de Controle vs Consenso) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#121417] border border-[#24272C] rounded-lg p-1.5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setRoomViewMode('CONTROL_PANEL')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all font-bold uppercase text-[11px] ${
              roomViewMode === 'CONTROL_PANEL'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#1C1F24]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Painel de Controle dos Agentes</span>
          </button>

          <button
            onClick={() => setRoomViewMode('CONSENSUS_ROOM')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all font-bold uppercase text-[11px] ${
              roomViewMode === 'CONSENSUS_ROOM'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#1C1F24]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Consenso do Comitê</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDebugModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1C1F24] hover:bg-[#24272C] text-emerald-400 border border-emerald-500/30 transition-all text-[11px] font-bold"
            title="Abre o validador automatizado do schema da API /api/swarm/analyze"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Testes & Depuração da API</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-[#6B7280] pl-2 border-l border-[#24272C]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>4 Agentes Ativos</span>
          </div>
        </div>
      </div>

      <SwarmDebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        lastAnalysisResult={swarmResult}
      />

      {/* Active Loading & Real-time Partial Results Streaming Banner */}
      {(isLoading || isStreaming) && (
        <div className="bg-[#121417] border border-emerald-500/40 rounded-lg p-4 space-y-4 animate-fadeIn shadow-xl shadow-emerald-500/10 relative overflow-hidden">
          {/* Scanning gradient animation line */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent animate-pulse pointer-events-none" />

          {/* Banner Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#24272C] pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>TRANSMISSÃO AO VIVO DO COMITÊ SWARM (6 ESPECIALISTAS)</span>
                </h3>
              </div>
              <p className="text-xs text-[#9CA3AF] font-mono">
                Sistemas alimentados pelo <span className="text-white font-bold">Gemini 3.6</span>. Exibindo conclusões parciais dos agentes em tempo real para <span className="text-emerald-400 font-bold">{selectedAsset.symbol}/USDT</span> (${selectedAsset.price.toLocaleString()}).
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#0A0B0D] px-3 py-1.5 rounded border border-emerald-500/30 font-mono text-xs text-emerald-400">
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span>Streaming em Andamento ({durationMinutes}m)</span>
            </div>
          </div>

          {/* Progress Bar & Current Action text */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{currentStepText}</span>
              </span>
              <span className="text-white font-bold font-mono">{loadingProgress || 15}%</span>
            </div>
            <div className="w-full bg-[#0A0B0D] h-2 rounded overflow-hidden border border-[#24272C]">
              <div
                className="bg-gradient-to-r from-emerald-600 via-cyan-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${loadingProgress || 15}%` }}
              />
            </div>
          </div>

          {/* 6 Specialist Real-Time Cards Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_SPECIALIST_AGENTS.map((spec, idx) => {
              const SpecIcon = spec.icon;
              const partialAgent = streamingAgents.find((a) => a.agentId === spec.agentId) || swarmResult?.agents.find((a) => a.agentId === spec.agentId);
              const isProcessing = (isStreaming || isLoading) && !partialAgent && (activeAgentIndex === idx || activeAgentIndex === -1);

              return (
                <div
                  key={spec.agentId}
                  className={`p-3.5 rounded-lg border transition-all space-y-2.5 relative overflow-hidden ${
                    partialAgent
                      ? 'bg-[#161A1E] border-emerald-500/50 shadow-md shadow-emerald-500/5'
                      : isProcessing
                      ? 'bg-[#1C2128] border-cyan-400/70 animate-pulse shadow-lg shadow-cyan-500/10'
                      : 'bg-[#121417] border-[#24272C] opacity-60'
                  }`}
                >
                  {/* Top Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SpecIcon className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white font-mono block">{spec.agentName}</span>
                        <span className="text-[9px] text-[#9CA3AF] font-mono block">{spec.specialistType}</span>
                      </div>
                    </div>

                    {partialAgent ? (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        CONCLUÍDO
                      </span>
                    ) : isProcessing ? (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1">
                        <div className="w-2 h-2 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        ANALISANDO...
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1C1F24] text-[#6B7280]">
                        AGUARDANDO
                      </span>
                    )}
                  </div>

                  {/* Partial Content or Processing Status */}
                  {partialAgent ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            partialAgent.opinion === 'COMPRAR'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : partialAgent.opinion === 'VENDER'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          PARECER: {partialAgent.opinion}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {partialAgent.score}% Confiança
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-200 font-mono leading-relaxed bg-[#0A0B0D] p-2 rounded border border-[#24272C]">
                        {partialAgent.summary}
                      </p>

                      {/* Key Metrics Badges */}
                      {partialAgent.keyMetrics && partialAgent.keyMetrics.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {partialAgent.keyMetrics.map((m, mIdx) => (
                            <span
                              key={mIdx}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                m.status === 'positive'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : m.status === 'negative'
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                  : 'bg-[#1C1F24] text-[#9CA3AF] border-[#24272C]'
                              }`}
                            >
                              {m.label}: {m.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#9CA3AF] font-mono leading-relaxed">
                      {spec.desc}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE VIEW MODE CONTENT */}
      {roomViewMode === 'CONTROL_PANEL' && (
        <AgentStatusControlPanel
          agents={swarmResult?.agents || []}
          isLoading={isLoading}
          assetSymbol={selectedAsset.symbol}
          onRefreshAgentStatus={handleStartAnalysis}
        />
      )}

      {/* Main Swarm Results (Consensus & Debates) */}
      {roomViewMode === 'CONSENSUS_ROOM' && swarmResult && !isLoading && (
        <div className="space-y-4">
          {/* CONSENSUS BANNER WITH LIVE COUNTDOWN */}
          <div className="bg-[#121417] border border-[#24272C] rounded-lg p-4 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Decision Badge */}
              <div className="lg:col-span-4 space-y-2 border-b lg:border-b-0 lg:border-r border-[#24272C] pb-3 lg:pb-0 lg:pr-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Swarm Consensus Engine</span>
                    {swarmResult.engineSource === 'gemini' ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold">
                        Gemini API
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        Fallback Local (sem chave Gemini)
                      </span>
                    )}
                  </div>
                  {swarmResult.recommendedDurationMinutes !== undefined && !isNeutral && (
                    <div className="flex items-center gap-1">
                      {swarmResult.recommendedDurationMinutes > swarmResult.signalDurationMinutes ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          Aumentado (+{swarmResult.recommendedDurationMinutes - swarmResult.signalDurationMinutes}m) → {swarmResult.recommendedDurationMinutes}m
                        </span>
                      ) : swarmResult.recommendedDurationMinutes < swarmResult.signalDurationMinutes ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          Reduzido (-{swarmResult.signalDurationMinutes - swarmResult.recommendedDurationMinutes}m) → {swarmResult.recommendedDurationMinutes}m
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                          Ratificado: {swarmResult.recommendedDurationMinutes}m
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`px-4 py-1.5 rounded font-mono font-black text-xl tracking-tight uppercase border ${
                      swarmResult.finalDecision === 'COMPRAR'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : swarmResult.finalDecision === 'VENDER'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {swarmResult.finalDecision}
                  </div>

                  <div>
                    <div className="text-xl font-mono font-bold text-white">{swarmResult.confidenceScore}%</div>
                    <div className="text-[9px] font-mono uppercase text-[#6B7280]">Confidence Score</div>
                  </div>
                </div>

                <p className="text-xs text-[#D1D5DB] leading-snug">{swarmResult.summaryConsensus}</p>

                {/* Justification of Dynamic Duration Window */}
                {swarmResult.durationJustification && (
                  <div className="mt-2 bg-[#0A0B0D] p-2.5 rounded border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-start gap-2 shadow-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase tracking-wider">
                          Parecer do Comitê (Permanência Segura no Trade):
                        </span>
                        {!isNeutral && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                            {swarmResult.recommendedDurationMinutes || swarmResult.signalDurationMinutes} min
                          </span>
                        )}
                      </div>
                      <p className="text-[#D1D5DB] leading-relaxed">
                        {isNeutral
                          ? 'Comitê definiu 0 minutos de permanência por considerar o mercado NEUTRO/AGUARDAR. Não é seguro abrir posições no momento.'
                          : swarmResult.durationJustification}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* COUNTDOWN & VALIDITY STATUS ALERT */}
              <div className="lg:col-span-4 space-y-2.5 bg-[#1A1D21] p-3 rounded border border-[#24272C] relative">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] uppercase">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>TEMPO SEGURO NA OPERAÇÃO:</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0A0B0D] text-emerald-400 border border-emerald-500/30">
                    {isNeutral ? 'SEM OPERAÇÃO' : tradeEntryTimestamp ? 'EM OPERAÇÃO' : 'JANELA AUTÔNOMA'}
                  </span>
                </div>

                {/* Clock Display */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-2xl font-black text-emerald-400 bg-[#0A0B0D] px-3 py-1 rounded border border-[#24272C] shadow-inner">
                    {isNeutral ? '00:00' : formatTime(remainingSeconds)}
                  </div>

                  {/* Dynamic Status Badge */}
                  <div className="text-right">
                    {isNeutral ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3" />
                        <span>FORA DO MERCADO (NEUTRO)</span>
                      </div>
                    ) : validityStatus === 'VALE_ENTRAR' ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>SINAL SEGURO</span>
                      </div>
                    ) : validityStatus === 'EXPIRANDO' ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>SAÍDA PRÓXIMA</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                        <XCircle className="w-3 h-3" />
                        <span>TEMPO FECHADO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Entry & Committee Governance Controls */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={handleUserEnteredNow}
                    disabled={isNeutral || validityStatus === 'NAO_ENTRAR'}
                    className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1 border ${
                      isNeutral || validityStatus === 'NAO_ENTRAR'
                        ? 'bg-[#0A0B0D] text-[#6B7280] border-[#24272C] cursor-not-allowed'
                        : tradeEntryTimestamp
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                        : 'bg-[#0A0B0D] hover:bg-[#24272C] text-emerald-400 border-[#24272C]'
                    }`}
                    title={isNeutral ? 'Operação não recomendada por comitê neutro' : 'Calibra a contagem regressiva a partir da sua entrada'}
                  >
                    <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                    <span>{isNeutral ? '🚫 Sem Operação' : tradeEntryTimestamp ? '✓ Entrei no Trade' : 'Entrei no Trade Agora'}</span>
                  </button>

                  <div
                    className="px-2 py-1.5 rounded text-[10px] font-mono font-semibold uppercase bg-[#0A0B0D] text-slate-400 border border-[#24272C] flex items-center justify-center gap-1 select-none"
                    title="A duração da operação é definida rigorosamente pelo Comitê de IA com base na análise de risco e fluxo."
                  >
                    <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Comitê: {isNeutral ? 0 : (swarmResult.recommendedDurationMinutes || swarmResult.signalDurationMinutes)}m</span>
                  </div>
                </div>

                {/* Extension Notice alert if triggered */}
                {extensionNotice && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded text-[10px] font-mono leading-tight animate-fadeIn">
                    {extensionNotice}
                  </div>
                )}

                {/* Validity progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-[#0A0B0D] h-1.5 rounded overflow-hidden border border-[#24272C]">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        isNeutral
                          ? 'bg-amber-500/50'
                          : pctRemaining > 40
                          ? 'bg-emerald-400'
                          : pctRemaining > 15
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${isNeutral ? 0 : pctRemaining}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] font-mono">
                    {isNeutral
                      ? '🛑 O comitê considerou o mercado NEUTRO/AGUARDAR. Não é seguro operar neste momento (Tempo seguro: 00:00).'
                      : tradeEntryTimestamp
                      ? `✓ Posição ativa. Permanência segura calculada para este trade.`
                      : validityStatus === 'VALE_ENTRAR'
                      ? '✓ Janela operacional aberta. Clique em "Entrei no Trade Agora" se executar.'
                      : validityStatus === 'EXPIRANDO'
                      ? '⚠️ Risco elevado: considere realizar lucros ou ajustar Stop Loss.'
                      : '🛑 Tempo seguro esgotado. Finalize a operação.'}
                  </p>
                </div>
              </div>

              {/* Price Targets & Action */}
              <div className="lg:col-span-4 space-y-2">
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="bg-[#1A1D21] p-2 rounded border border-[#24272C]">
                    <div className="text-[#9CA3AF] text-[9px] font-mono uppercase">Entry Target</div>
                    <div className="font-mono font-bold text-white text-xs mt-0.5">
                      ${swarmResult.entryTarget.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#1A1D21] p-2 rounded border border-[#24272C]">
                    <div className="text-[#9CA3AF] text-[9px] font-mono uppercase">Stop Loss</div>
                    <div className="font-mono font-bold text-rose-400 text-xs mt-0.5">
                      ${swarmResult.stopLoss.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#1A1D21] p-2 rounded border border-[#24272C]">
                    <div className="text-[#9CA3AF] text-[9px] font-mono uppercase">Take Profit</div>
                    <div className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
                      ${swarmResult.takeProfit.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Journal Add Action */}
                <button
                  onClick={handleAddJournalClick}
                  disabled={addedToJournal || isNeutral || validityStatus === 'NAO_ENTRAR'}
                  className={`w-full py-2 px-3 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    addedToJournal
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-default'
                      : isNeutral || validityStatus === 'NAO_ENTRAR'
                      ? 'bg-[#1C1F24] text-[#6B7280] border border-[#24272C] cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 active:scale-95'
                  }`}
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  <span>
                    {isNeutral
                      ? 'Operação Neutra (Sem Registro)'
                      : addedToJournal
                      ? '✓ Operação no Diário'
                      : 'Registrar Operação no Diário'}
                  </span>
                </button>

                {/* Explain Decision Toggle */}
                <button
                  onClick={() => setShowExplanation((prev) => !prev)}
                  className="w-full py-2 px-3 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all bg-[#0A0B0D] hover:bg-[#24272C] text-cyan-300 border border-[#24272C] hover:border-cyan-500/40 active:scale-95"
                  title="Mostra o raciocínio passo a passo que levou o comitê a esta decisão"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{showExplanation ? 'Ocultar Explicação' : 'Explicar Decisão'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* DECISION EXPLANATION PANEL */}
          {showExplanation && (
            <div className="bg-[#0E1416] border border-cyan-500/30 rounded-lg p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Por que o comitê decidiu {swarmResult.finalDecision}?
                </h3>
                <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 font-bold ml-auto">
                  Confiança {swarmResult.confidenceScore}%
                </span>
              </div>

              <p className="text-xs text-[#D1D5DB] leading-relaxed">
                {swarmResult.summaryConsensus}
              </p>

              {swarmResult.reasoningNotes && swarmResult.reasoningNotes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-[#6B7280]">Raciocínio passo a passo:</div>
                  <ol className="space-y-1">
                    {swarmResult.reasoningNotes.map((note, idx) => (
                      <li key={idx} className="text-[11px] text-[#9CA3AF] flex items-start gap-2">
                        <span className="w-4 h-4 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{note}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* INDIVIDUAL AGENT DEBATE ROOM CARDS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pareceres dos Agentes do Comitê</span>
              </h3>
              <span className="text-[10px] font-mono text-[#6B7280]">Swarm-01 Engine Log</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {swarmResult.agents.map((agent, idx) => (
                <div
                  key={`${agent.agentId}-${idx}`}
                  className="bg-[#121417] border border-[#24272C] hover:border-[#374151] rounded-lg p-3 space-y-2.5 transition-colors"
                >
                  {/* Agent Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[#1A1D21] border border-[#24272C] flex items-center justify-center">
                        {renderAgentIcon(agent.avatarIcon)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{agent.agentName}</h4>
                        <p className="text-[10px] font-mono text-[#6B7280]">{agent.agentRole}</p>
                      </div>
                    </div>

                    {/* Agent Vote Badge */}
                    <div
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${
                        agent.opinion === 'COMPRAR'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : agent.opinion === 'VENDER'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {agent.opinion} ({agent.score}%)
                    </div>
                  </div>

                  {/* Summary opinion */}
                  <p className="text-xs text-[#D1D5DB] bg-[#1A1D21] p-2 rounded border border-[#24272C]">
                    "{agent.summary}"
                  </p>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {agent.keyMetrics.map((km, i) => (
                      <div key={i} className="bg-[#0A0B0D] p-1.5 rounded border border-[#24272C]">
                        <div className="text-[9px] font-mono text-[#6B7280] uppercase">{km.label}</div>
                        <div className="font-mono font-bold text-white text-xs mt-0.5">{km.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Signals Bullet Points */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase text-[#6B7280]">Sinais Detectados:</div>
                    <ul className="space-y-0.5">
                      {agent.signals.map((sig, idx) => (
                        <li key={idx} className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Initial Empty State guidance for Consensus Room */}
      {roomViewMode === 'CONSENSUS_ROOM' && !swarmResult && !isLoading && (
        <div className="bg-[#121417] border border-dashed border-[#24272C] rounded-lg p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded bg-[#1A1D21] border border-[#24272C] flex items-center justify-center mx-auto text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-mono font-bold text-white uppercase">Swarm Meeting Room Standby</h3>
            <p className="text-xs text-[#9CA3AF]">
              Selecione o ativo e janela de tempo para acionar os 4 agentes quantitativos (Technical, Sentiment, Whale Flow & Quant Factors).
            </p>
          </div>
          <button
            onClick={handleStartAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Analisar {selectedAsset.symbol} Agora</span>
          </button>
        </div>
      )}
    </div>
  );
};

