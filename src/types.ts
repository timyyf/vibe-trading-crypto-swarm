export type TradeDecision = 'COMPRAR' | 'VENDER' | 'AGUARDAR / NEUTRO';

export type RecommendationValidity = 'VALE_ENTRAR' | 'EXPIRANDO' | 'NAO_ENTRAR';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number; // in USD
  high24h: number;
  low24h: number;
  marketCap: number;
  rank: number;
  category: 'Layer 1' | 'DeFi' | 'Meme' | 'AI & Data' | 'Layer 2' | 'Infrastructure' | 'Outros';
  icon?: string;
}

export interface KlinePoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20?: number;
  sma50?: number;
  rsi?: number;
}

export interface WhaleTransaction {
  id: string;
  timestamp: number;
  symbol: string;
  amountCrypto: number;
  amountUSD: number;
  from: string;
  to: string;
  type: 'EXCHANGE_INFLOW' | 'EXCHANGE_OUTFLOW' | 'WALLET_TRANSFER';
  impactLevel: 'ALTO' | 'MÉDIO' | 'BAIXO';
  txHash: string;
}

export interface KeyMetric {
  label: string;
  value: string;
  status?: 'positive' | 'negative' | 'neutral';
}

export interface AgentReport {
  agentId: 'technical' | 'sentiment' | 'whales' | 'alpha';
  agentName: string;
  agentRole: string;
  specialistType?: 'Técnico' | 'Analista de Sentimento' | 'Fundamentalista' | 'Quant Factor';
  avatarIcon: string;
  opinion: TradeDecision;
  score: number; // 0-100
  summary: string;
  keyMetrics: KeyMetric[];
  signals: string[];
  processingTimeMs?: number;
  status?: 'ONLINE' | 'ANALISANDO' | 'CONCLUÍDO' | 'DEGRADADO';
}

export interface SwarmAnalysisResult {
  assetSymbol: string;
  assetName: string;
  assetPrice: number;
  timestamp: number;
  finalDecision: TradeDecision;
  confidenceScore: number;
  signalDurationMinutes: number;
  recommendedDurationMinutes?: number; // 5, 10, 15, 20 min
  durationJustification?: string;
  expiryTimestamp: number; // Date.now() + duration
  entryTarget: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: string;
  agents: AgentReport[];
  summaryConsensus: string;
  reasoningNotes: string[];
}

export interface AlphaFactor {
  id: string;
  name: string;
  category: 'Momentum' | 'Mean Reversion' | 'Volatilidade' | 'Volume Flow' | 'Machine Learning';
  formula: string;
  ic: number; // Information Coefficient
  sharpe: number;
  winRate: number; // e.g. 64.5%
  maxDrawdown: number; // e.g. -12.4%
  description: string;
}

export interface TradeJournalEntry {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'COMPRA' | 'VENDA';
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  status: 'EM_ANDAMENTO' | 'LUCRO' | 'PREJUÍZO' | 'CANCELADO';
  durationMinutes: number;
  expiryTimestamp: number;
  confidence: number;
  pnlPercent?: number;
  notes: string;
}

export interface AgentDiagnostic {
  id: 'market_feed' | 'gemini_llm' | 'technical' | 'sentiment' | 'whales' | 'alpha';
  name: string;
  type: 'connector' | 'agent';
  status: 'ONLINE' | 'DEGRADED' | 'DISCONNECTED';
  latencyMs: number;
  lastChecked: number;
  details: string;
}


export interface SystemDiagnosticResult {
  overallStatus: 'ONLINE' | 'DEGRADED' | 'DISCONNECTED';
  timestamp: number;
  latencyMs: number;
  activeAgentsCount: number;
  totalAgentsCount: number;
  diagnostics: AgentDiagnostic[];
  warningMessage?: string;
}

