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

export interface KeyMetric {
  label: string;
  value: string;
  status?: 'positive' | 'negative' | 'neutral';
}

export interface AgentReport {
  agentId: 'technical' | 'sentiment' | 'whales' | 'alpha' | 'orderbook' | 'risk';
  agentName: string;
  agentRole: string;
  specialistType?: 'Técnico' | 'Analista de Sentimento' | 'Fundamentalista' | 'Quant Factor' | 'Liquidez & Orderbook' | 'Risk Manager';
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
  engineSource?: 'gemini' | 'fallback';
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
  ic: number; // Information Coefficient (referência de literatura)
  sharpe: number; // referência de literatura
  winRate: number; // referência de literatura (e.g. 64.5%)
  maxDrawdown: number; // referência de literatura (e.g. -12.4%)
  description: string;
  factorValue?: number; // valor atual calculado em tempo real
  signalDirection?: 'LONG' | 'SHORT' | 'NEUTRO';
  isReal?: boolean; // true = valor calculado em tempo real, false = referência de literatura
}

export interface TradeJournalEntry {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'COMPRA' | 'VENDA' | 'OBSERVAÇÃO';
  entryPrice?: number;
  targetPrice?: number;
  stopPrice?: number;
  status: 'EM_ANDAMENTO' | 'LUCRO' | 'PREJUÍZO' | 'CANCELADO';
  durationMinutes: number;
  expiryTimestamp: number;
  confidence: number;
  pnlPercent?: number;
  notes: string;
}

export type AgentComponentId = 'market_feed' | 'gemini_llm' | 'technical' | 'sentiment' | 'orderbook' | 'whales' | 'alpha' | 'risk' | 'semantica_kg';

export interface AgentDiagnostic {
  id: AgentComponentId;
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

// --- Deep Blue Alpha (on-chain whale aggregates, escopo Ethereum) ---

export interface WhaleIndexPoint {
  date: string; // ISO date
  value: number; // 0-100 score
  classification: string;
}

export interface WhaleIndexData {
  current: number;
  classification: string;
  buyScore: number;
  sellScore: number;
  confidence: number;
  history: WhaleIndexPoint[];
  fetchedAt: number;
}

export interface TopWhaleToken {
  symbol: string;
  name: string;
  trades: number;
  volumeUsd: number;
  netFlowUsd: number;
  direction: 'ACUMULAÇÃO' | 'DISTRIBUIÇÃO' | 'NEUTRO';
  wallets: number;
}

export interface WhaleOverviewStats {
  trackedWallets: number;
  activeWallets24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  netFlow24h: number;
  dexTrades24h: number;
  exchangeFlows24h: number;
  totalVolume24h: number;
  latestBlock: number;
}

export interface WhaleOverview {
  stats: WhaleOverviewStats;
  index: WhaleIndexData;
  topTokens: TopWhaleToken[];
  source: string; // e.g. "Deep Blue Alpha"
  scope: string; // e.g. "Ethereum on-chain"
  fetchedAt: number;
}

// --- Alpha Zoo real-time computations ---

export interface HmmRegimeResult {
  symbol: string;
  interval: string;
  dominantRegime: 'MOMENTUM' | 'MEAN_REVERSION' | 'HIGH_VOLATILITY';
  probabilities: {
    momentum: number;
    meanReversion: number;
    highVolatility: number;
  };
  confidence: number;
  stability: number;
  regimeCount: number;
  logLikelihood: number;
  computedAt: number;
  realData: boolean;
}

export interface BacktestResult {
  symbol: string;
  factorId: string;
  factorName: string;
  interval: string;
  barsUsed: number;
  netReturnPercent: number;
  sharpeRatio: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  finalEquityCurve: number[];
  feeRatePercent: number;
  computedAt: number;
  realData: boolean;
}
