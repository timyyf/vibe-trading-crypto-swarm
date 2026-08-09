import { SwarmAnalysisResult } from '../types';

const SEMANTICA_BASE_URL = process.env.SEMANTICA_BASE_URL || '';
const SEMANTICA_ENABLED = process.env.SEMANTICA_ENABLED !== 'false';
const SEMANTICA_PRECEDENT_INJECTION = process.env.SEMANTICA_PRECEDENT_INJECTION === 'true';

const REQUEST_TIMEOUT_MS = 3500;
const HEALTH_CACHE_TTL_MS = 60 * 1000;

export const isSemanticaEnabled = (): boolean => !!SEMANTICA_BASE_URL && SEMANTICA_ENABLED;
export const isPrecedentInjectionEnabled = (): boolean => isSemanticaEnabled() && SEMANTICA_PRECEDENT_INJECTION;

interface HealthStatus {
  status?: string;
  node_count?: number;
  decision_count?: number;
}

export interface DecisionRecord {
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

export interface GraphStats {
  node_count: number;
  edge_count: number;
  decision_count: number;
  categories: Record<string, number>;
  outcomes: Record<string, number>;
}

export interface DecisionChain {
  decision_id: string;
  direction: string;
  chain: DecisionRecord[];
}

let healthCache: { healthy: boolean; checkedAt: number } | null = null;

async function semanticaRequest<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!isSemanticaEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SEMANTICA_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSemanticaHealth(): Promise<{ healthy: boolean; status?: string; nodeCount?: number; decisionCount?: number }> {
  const now = Date.now();
  if (healthCache && now - healthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
    return { healthy: healthCache.healthy };
  }
  const res = await semanticaRequest<HealthStatus>('/health');
  const healthy = !!res;
  healthCache = { healthy, checkedAt: Date.now() };
  return { healthy, status: res?.status, nodeCount: res?.node_count, decisionCount: res?.decision_count };
}

// Grava a decisão do comitê no grafo (fire-and-forget; retorna id quando persistida).
export async function recordDecision(analysis: SwarmAnalysisResult): Promise<string | null> {
  if (!isSemanticaEnabled()) return null;
  const payload = {
    category: 'trade_decision',
    scenario: `Trade em ${analysis.assetSymbol} (${analysis.assetName}) — preço ${analysis.assetPrice}, decisão ${analysis.finalDecision}, confiança ${analysis.confidenceScore}%.`,
    reasoning: analysis.reasoningNotes.join('\n'),
    outcome: analysis.finalDecision,
    confidence: Math.max(0, Math.min(1, analysis.confidenceScore / 100)),
    entities: [analysis.assetSymbol, ...analysis.agents.map((a) => a.agentId)],
    decision_maker: analysis.engineSource || 'fallback',
    metadata: {
      assetSymbol: analysis.assetSymbol,
      assetName: analysis.assetName,
      assetPrice: analysis.assetPrice,
      entryTarget: analysis.entryTarget,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit,
      riskRewardRatio: analysis.riskRewardRatio,
      timestamp: analysis.timestamp,
    },
  };
  const res = await semanticaRequest<{ decision_id: string }>('/decision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res?.decision_id ?? null;
}

export interface JournalRecordInput {
  entryId: string;
  symbol: string;
  type: string;
  status: string;
  entryPrice?: number;
  targetPrice?: number;
  stopPrice?: number;
  confidence?: number;
  notes?: string;
  timestamp: number;
  pnlPercent?: number;
}

// Grava (ou atualiza via upsert) um registro do diário de trades no grafo.
// Id determinístico (journal-<entryId>) permite sobrescrever o resultado
// quando a operação fecha (LUCRO/PREJUÍZO) sem duplicar nós.
export async function recordJournalEntry(entry: JournalRecordInput): Promise<string | null> {
  if (!isSemanticaEnabled()) return null;
  const confidence = Math.max(0, Math.min(1, (entry.confidence ?? 50) / 100));
  const outcome =
    entry.status === 'LUCRO' || entry.status === 'PREJUÍZO' || entry.status === 'CANCELADO'
      ? `FECHADA: ${entry.status}`
      : 'EM_ANDAMENTO';
  const payload = {
    decision_id: `journal-${entry.entryId}`,
    category: 'trade_journal',
    scenario: `Trade em ${entry.symbol} (${entry.type}) — ${outcome}${entry.notes ? `. ${entry.notes}` : ''}`,
    reasoning: entry.notes ?? '',
    outcome,
    confidence,
    entities: [entry.symbol],
    decision_maker: 'journal',
    metadata: {
      entryId: entry.entryId,
      type: entry.type,
      status: entry.status,
      entryPrice: entry.entryPrice,
      targetPrice: entry.targetPrice,
      stopPrice: entry.stopPrice,
      pnlPercent: entry.pnlPercent,
      timestamp: entry.timestamp,
    },
  };
  const res = await semanticaRequest<{ decision_id: string }>('/decision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res?.decision_id ?? null;
}

export async function getPrecedents(scenario: string, limit = 5): Promise<DecisionRecord[] | null> {
  if (!isSemanticaEnabled()) return null;
  return semanticaRequest<DecisionRecord[]>(
    `/precedents?scenario=${encodeURIComponent(scenario)}&limit=${limit}`
  );
}

export async function getDecisionChain(decisionId: string, direction = 'upstream', maxDepth = 10): Promise<DecisionChain | null> {
  if (!isSemanticaEnabled()) return null;
  return semanticaRequest<DecisionChain>(
    `/decisions/${encodeURIComponent(decisionId)}/chain?direction=${direction}&max_depth=${maxDepth}`
  );
}

export async function listDecisions(symbol?: string, limit = 50): Promise<DecisionRecord[] | null> {
  if (!isSemanticaEnabled()) return null;
  const params = new URLSearchParams({ limit: String(limit) });
  if (symbol) params.set('symbol', symbol);
  return semanticaRequest<DecisionRecord[]>(`/decisions?${params.toString()}`);
}

let statsCache: { stats: GraphStats | null; cachedAt: number } | null = null;

export async function getGraphStats(): Promise<GraphStats | null> {
  if (!isSemanticaEnabled()) return null;
  const now = Date.now();
  if (statsCache && now - statsCache.cachedAt < HEALTH_CACHE_TTL_MS) {
    return statsCache.stats;
  }
  const stats = await semanticaRequest<GraphStats>('/stats');
  statsCache = { stats, cachedAt: Date.now() };
  return stats;
}
