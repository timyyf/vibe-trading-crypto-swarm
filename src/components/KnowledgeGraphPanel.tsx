import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, RefreshCw, Wifi, WifiOff, Server, GitBranch, History, Target, AlertTriangle, ChevronRight, X, Download } from 'lucide-react';
import { downloadProvODocument } from '../lib/provoExport';

interface KgHealth {
  healthy?: boolean;
  status?: string;
  nodeCount?: number;
  decisionCount?: number;
}

interface KgStatus {
  enabled: boolean;
  health: KgHealth;
}

interface GraphStats {
  node_count: number;
  edge_count: number;
  decision_count: number;
  categories: Record<string, number>;
  outcomes: Record<string, number>;
}

interface DecisionRecord {
  decision_id: string;
  category: string;
  scenario: string;
  reasoning: string;
  outcome: string;
  confidence: number;
  entities: string[];
  decision_maker: string;
  timestamp: number;
  recorded_at: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

interface ChainRecord {
  decision_id: string;
  direction: string;
  chain: DecisionRecord[];
}

interface KnowledgeGraphPanelProps {
  activeSymbol: string;
}

const outcomeColor = (outcome: string): string => {
  const o = outcome.toUpperCase();
  if (o.includes('COMPRAR')) return 'text-emerald-400';
  if (o.includes('VENDER')) return 'text-red-400';
  return 'text-amber-400';
};

const fmtTime = (ts: number): string => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtConf = (c: number): string => `${Math.round((c ?? 0) * 100)}%`;

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({ activeSymbol }) => {
  const [status, setStatus] = useState<KgStatus | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [precedents, setPrecedents] = useState<DecisionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainRecord | null>(null);
  const [symbolFilter, setSymbolFilter] = useState<string>(activeSymbol);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, statsRes, decisionsRes] = await Promise.all([
        fetch('/api/knowledge/status'),
        fetch('/api/knowledge/stats'),
        fetch(`/api/knowledge/decisions?symbol=${encodeURIComponent(symbolFilter)}&limit=30`),
      ]);
      const statusData = (await statusRes.json()) as KgStatus & { enabled?: boolean };
      setStatus(statusData);

      if (!statusData.enabled) {
        setStats(null);
        setDecisions([]);
        setPrecedents([]);
        setLoading(false);
        return;
      }

      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data as GraphStats);

      const decisionsData = await decisionsRes.json();
      if (decisionsData.success) setDecisions((decisionsData.data || []) as DecisionRecord[]);

      // Precedentes para o símbolo ativo (pesquisa semântica de cenário)
      const precRes = await fetch(`/api/knowledge/precedents?symbol=${encodeURIComponent(activeSymbol)}`);
      const precData = await precRes.json();
      if (precData.success) setPrecedents((precData.data || []) as DecisionRecord[]);
    } catch {
      setError('Falha ao consultar o Knowledge Graph.');
    } finally {
      setLoading(false);
    }
  }, [activeSymbol, symbolFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadChain = async (id: string) => {
    setSelectedId(id);
    setChain(null);
    try {
      const res = await fetch(`/api/knowledge/provenance?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success) setChain(data.data as ChainRecord);
    } catch {
      setChain(null);
    }
  };

  const disabled = !status?.enabled;
  const healthy = !!status?.enabled && status?.health?.healthy !== false;

  return (
    <div className="space-y-4">
      {/* Header de status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded bg-violet-500/10 border border-violet-500/30">
            <BrainCircuit className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Knowledge Graph — Semantica
            </h2>
            <p className="text-[11px] font-mono text-[#6B7280]">
              Memória de longo prazo do comitê: precedentes, provenance e estatísticas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {disabled ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 uppercase">
              <WifiOff className="w-3 h-3" />
              Semantica KG: indisponível
            </span>
          ) : healthy ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase">
              <Wifi className="w-3 h-3" />
              Semantica KG: ativo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400 uppercase">
              <WifiOff className="w-3 h-3" />
              Semantica KG: inacessível
            </span>
          )}
          <button
            onClick={() => void loadAll()}
            className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-[#24272C] text-[#9CA3AF] hover:border-emerald-500/50 hover:text-emerald-400 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() =>
              downloadProvODocument(
                `prov-knowledge-graph-${new Date().toISOString().slice(0, 10)}.ttl`,
                decisions,
                { namespace: 'https://vibe-trading.example.org/' }
              )
            }
            disabled={decisions.length === 0}
            title="Exporta a cadeia de proveniência (W3C PROV-O, Turtle) das decisões do comitê, ensaios MiroFish e diário"
            className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-[#24272C] text-[#9CA3AF] hover:border-violet-500/50 hover:text-violet-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            Export PROV-O (.ttl)
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {disabled ? (
        <div className="bg-[#121417] border border-[#24272C] rounded-lg p-6 text-center space-y-2">
          <Server className="w-8 h-8 text-[#4B5563] mx-auto" />
          <p className="text-xs font-mono text-[#9CA3AF]">
            A memória de longo prazo está desativada.
          </p>
          <p className="text-[11px] font-mono text-[#6B7280]">
            Configure <code className="text-violet-400">SEMANTICA_BASE_URL</code> (sidecar Render) e
            <code className="text-violet-400"> SEMANTICA_ENABLED=true</code> para ativar.
          </p>
          <p className="text-[11px] font-mono text-[#6B7280]">
            O app continua 100% funcional sem o sidecar (degradação graciosa).
          </p>
        </div>
      ) : !healthy ? (
        <div className="bg-[#121417] border border-rose-500/30 rounded-lg p-6 text-center space-y-2">
          <Server className="w-8 h-8 text-rose-400/60 mx-auto" />
          <p className="text-xs font-mono text-rose-400">
            Sidecar do Knowledge Graph inacessível.
          </p>
          <p className="text-[11px] font-mono text-[#6B7280]">
            O serviço Semantica está configurado, mas não respondeu ao health check.
            Decisões do comitê não estão sendo persistidas na memória de longo prazo.
          </p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">Nós no grafo</p>
              <p className="text-xl font-bold font-mono text-white mt-1">{stats?.node_count ?? '—'}</p>
            </div>
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">Arestas</p>
              <p className="text-xl font-bold font-mono text-white mt-1">{stats?.edge_count ?? '—'}</p>
            </div>
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">Decisões</p>
              <p className="text-xl font-bold font-mono text-violet-400 mt-1">{stats?.decision_count ?? '—'}</p>
            </div>
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">Outcomes</p>
              <div className="mt-1 space-y-0.5">
                {stats?.outcomes ? (
                  Object.entries(stats.outcomes).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10px] font-mono">
                      <span className={outcomeColor(k)}>{k}</span>
                      <span className="text-[#9CA3AF]">{v}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-[#4B5563]">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Precedentes do símbolo ativo */}
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Precedentes — {activeSymbol}
                </h3>
              </div>
              {precedents.length === 0 ? (
                <p className="text-[11px] font-mono text-[#4B5563] py-3 text-center">
                  Nenhum precedente similar registrado para {activeSymbol} ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {precedents.map((p) => (
                    <li key={p.decision_id} className="text-[11px] font-mono bg-[#0A0B0D] border border-[#24272C] rounded px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold uppercase ${outcomeColor(p.outcome)}`}>{p.outcome}</span>
                        <span className="text-[#6B7280]">
                          conf {fmtConf(p.confidence)} · sim {(p.similarity ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] mt-1 line-clamp-2">{p.scenario}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Provenance da decisão selecionada */}
            <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-3.5 h-3.5 text-violet-400" />
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Provenance / Cadeia causal
                </h3>
              </div>
              {!selectedId ? (
                <p className="text-[11px] font-mono text-[#4B5563] py-3 text-center">
                  Selecione uma decisão na tabela para ver a cadeia causal (hops) no grafo.
                </p>
              ) : chain === null ? (
                <p className="text-[11px] font-mono text-[#4B5563] py-3 text-center animate-pulse">
                  Carregando cadeia...
                </p>
              ) : chain.chain.length === 0 ? (
                <p className="text-[11px] font-mono text-[#4B5563] py-3 text-center">
                  Sem conexões causais para esta decisão.
                </p>
              ) : (
                <div className="space-y-1">
                  {chain.chain.map((c, i) => (
                    <div key={`${c.decision_id}-${i}`} className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className={`px-2 py-0.5 rounded bg-[#0A0B0D] border border-[#24272C] ${outcomeColor(c.outcome)}`}>
                        {c.outcome}
                      </span>
                      {i < chain.chain.length - 1 && <ChevronRight className="w-3 h-3 text-[#4B5563]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de histórico de decisões */}
          <div className="bg-[#121417] border border-[#24272C] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Histórico de decisões
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-[#6B7280]">Símbolo:</label>
                <input
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                  placeholder="BTC"
                  className="bg-[#0A0B0D] border border-[#24272C] rounded px-2 py-1 text-[11px] font-mono text-white w-20 focus:border-emerald-500/50 outline-none"
                />
                <button
                  onClick={() => void loadAll()}
                  className="text-[10px] font-mono px-2 py-1 rounded border border-[#24272C] text-[#9CA3AF] hover:border-emerald-500/50 cursor-pointer"
                >
                  Filtrar
                </button>
              </div>
            </div>

            {decisions.length === 0 ? (
              <p className="text-[11px] font-mono text-[#4B5563] py-3 text-center">
                Nenhuma decisão registrada. Execute uma análise do comitê para gravar no grafo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#6B7280] border-b border-[#24272C]">
                      <th className="py-2 pr-2">Decisão</th>
                      <th className="py-2 pr-2">Conf</th>
                      <th className="py-2 pr-2">Origem</th>
                      <th className="py-2 pr-2">Quando</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr
                        key={d.decision_id}
                        className={`border-b border-[#1A1D21] hover:bg-[#0A0B0D] cursor-pointer ${
                          selectedId === d.decision_id ? 'bg-violet-500/5' : ''
                        }`}
                        onClick={() => void loadChain(d.decision_id)}
                      >
                        <td className="py-2 pr-2">
                          <span className={`font-bold uppercase ${outcomeColor(d.outcome)}`}>{d.outcome}</span>
                          <span className="text-[#4B5563] ml-2 hidden sm:inline">
                            {d.entities?.[0] ?? d.metadata?.assetSymbol ?? ''}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-[#9CA3AF]">{fmtConf(d.confidence)}</td>
                        <td className="py-2 pr-2 text-[#9CA3AF]">{d.decision_maker ?? '—'}</td>
                        <td className="py-2 pr-2 text-[#6B7280]">{fmtTime(d.timestamp)}</td>
                        <td className="py-2 text-right">
                          {selectedId === d.decision_id ? (
                            <X className="w-3.5 h-3.5 text-violet-400 ml-auto" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-[#4B5563] ml-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
