import { SwarmAnalysisResult, MiroFishReview } from '../types';

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

// Adiciona uma relação (edge) entre dois nós existentes no grafo.
export async function addRelationship(
  sourceId: string,
  targetId: string,
  relType: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  if (!isSemanticaEnabled()) return false;
  const res = await semanticaRequest<{ status: string }>('/relationship', {
    method: 'POST',
    body: JSON.stringify({ source_id: sourceId, target_id: targetId, rel_type: relType, metadata }),
  });
  return !!res;
}

// Registra o ensaio MiroFish no grafo e liga a decisão do comitê via INFLUENCED.
// O comitê permanece a origem da decisão (o nó do comitê já existe); a simulação
// é o suporte com proveniência (best-effort, degradação graciosa).
export async function recordMirofishDecision(
  symbol: string,
  review: MiroFishReview,
  committeeDecisionId: string | null
): Promise<string | null> {
  if (!isSemanticaEnabled()) return null;

  const decisionId = `mirofish-${symbol}-${review.simulation.seed}-${Date.now()}`;
  const metadata = {
    symbol,
    verdict: review.verdict,
    agreementScore: review.agreementScore,
    simDirection: review.simulation.consensus.direction,
    simIntensity: review.simulation.consensus.intensity,
    committeeConfidence: review.committeeConfidence,
    blendedConfidence: review.blendedConfidence,
    seed: review.simulation.seed,
    timestamp: review.simulation.timestamp,
    ...(committeeDecisionId ? { committee_decision_id: committeeDecisionId } : {}),
  };

  const payload = {
    decision_id: decisionId,
    category: 'mirofish_world',
    scenario: `Ensaio MiroFish em ${symbol} — consenso ${review.simulation.consensus.direction} (int ${review.simulation.consensus.intensity}/100, acordo ${review.agreementScore}%).`,
    reasoning: review.reasons.join('\n'),
    outcome: review.verdict,
    confidence: Math.max(0, Math.min(1, review.agreementScore / 100)),
    entities: [symbol, ...review.simulation.cohorts.map((c) => `cohort:${c.id}`)],
    decision_maker: 'mirofish',
    metadata,
  };

  const res = await semanticaRequest<{ decision_id: string }>('/decision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // Link INFLUENCED: simulação → decisão do comitê (origem continua sendo o comitê).
  if (committeeDecisionId) {
    void addRelationship(decisionId, committeeDecisionId, 'INFLUENCED', metadata).catch(() => false);
  }

  return res?.decision_id ?? null;
}
