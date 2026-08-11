import { WhaleOverview, WhaleOverviewStats, WhaleIndexData, WhaleIndexPoint, TopWhaleToken } from '../types.js';

const DBA_BASE = 'https://deepbluealpha.io/api/v1/public';
const CACHE_TTL_MS = 60 * 1000; // API já cacheia 60s; mantemos o mesmo

interface StatsResponse {
  data?: {
    tracked_wallets?: number;
    tracked_tokens?: number;
    transactions_total?: number;
    window_24h?: {
      buy_volume_usd?: number;
      sell_volume_usd?: number;
      distinct_buyers?: number;
    };
  };
}

interface IndexResponse {
  score?: number;
  label?: string;
  trade_sentiment?: number;
  volume_sentiment?: number;
  total_trades?: number;
  total_volume_usd?: number;
  active_wallets?: number;
  history?: { date: string; score: number }[];
}

interface TopTokensResponse {
  tokens?: {
    symbol: string;
    volume_usd: number;
    trades: number;
    buy_volume_usd: number;
    sell_volume_usd: number;
    net_flow_usd: number;
    whales: number;
  }[];
}

const USER_AGENT = 'vibe-trading-crypto-swarm/1.0';
const RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Diagnóstico + robustez: loga o status HTTP real ou a razão da falha de rede
// (DNS vs TLS vs timeout) — hoje o erro é engolido e vira só "DEGRADED".
// 1 retry curto descarta throttling transitório sem estourar o deadline da sonda.
async function fetchJson<T>(url: string, timeoutMs = 2500, retries = 1): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn(`[whale] HTTP ${res.status} ${res.statusText} em ${url}`);
        if (attempt < retries) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      return (await res.json()) as T;
    } catch (err: any) {
      clearTimeout(timeout);
      const reason =
        err?.name === 'AbortError'
          ? `timeout ${timeoutMs}ms`
          : `${err?.name ?? 'erro'}: ${err?.message ?? String(err)}`;
      console.warn(`[whale] falha de rede (${reason}) em ${url}`);
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

let overviewCache: { data: WhaleOverview | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

/**
 * Agregados on-chain reais de baleias (Deep Blue Alpha — escopo Ethereum).
 * Sem chave, 3 endpoints públicos, cache 60s. Se a fonte falhar, retorna null
 * (a UI/engines mostram estado 'indisponível' em vez de inventar números).
 */
export async function getWhaleOverview(): Promise<WhaleOverview | null> {
  const now = Date.now();
  if (overviewCache.data && now - overviewCache.fetchedAt < CACHE_TTL_MS) {
    return overviewCache.data;
  }

  const [statsRaw, indexRaw, tokensRaw] = await Promise.all([
    fetchJson<StatsResponse>(`${DBA_BASE}/stats`),
    fetchJson<IndexResponse>(`${DBA_BASE}/whale-index`),
    fetchJson<TopTokensResponse>(`${DBA_BASE}/top-tokens`),
  ]);

  if (!statsRaw && !indexRaw && !tokensRaw) {
    return null;
  }

  const w = statsRaw?.data?.window_24h;
  const stats: WhaleOverviewStats = {
    trackedWallets: statsRaw?.data?.tracked_wallets ?? 0,
    activeWallets24h: indexRaw?.active_wallets ?? 0,
    buyVolume24h: w?.buy_volume_usd ?? 0,
    sellVolume24h: w?.sell_volume_usd ?? 0,
    netFlow24h: (w?.buy_volume_usd ?? 0) - (w?.sell_volume_usd ?? 0),
    dexTrades24h: indexRaw?.total_trades ?? 0,
    exchangeFlows24h: statsRaw?.data?.transactions_total ?? 0,
    totalVolume24h: indexRaw?.total_volume_usd ?? 0,
    latestBlock: 0,
  };

  const history: WhaleIndexPoint[] = (indexRaw?.history ?? []).map((h) => ({
    date: h.date,
    value: h.score,
    classification: h.score >= 60 ? 'Compra' : h.score <= 40 ? 'Venda' : 'Misto',
  }));

  const index: WhaleIndexData = {
    current: indexRaw?.score ?? 50,
    classification: indexRaw?.label ?? 'Misto',
    buyScore: indexRaw?.trade_sentiment ?? 50,
    sellScore: Math.max(0, Math.min(100, 100 - (indexRaw?.trade_sentiment ?? 50))),
    confidence: indexRaw?.volume_sentiment ?? 50,
    history,
    fetchedAt: now,
  };

  const topTokens: TopWhaleToken[] = (tokensRaw?.tokens ?? []).slice(0, 10).map((t) => ({
    symbol: t.symbol,
    name: t.symbol,
    trades: t.trades,
    volumeUsd: t.volume_usd,
    netFlowUsd: t.net_flow_usd,
    direction: t.net_flow_usd > 0 ? 'ACUMULAÇÃO' : t.net_flow_usd < 0 ? 'DISTRIBUIÇÃO' : 'NEUTRO',
    wallets: t.whales,
  }));

  const overview: WhaleOverview = {
    stats,
    index,
    topTokens,
    source: 'Deep Blue Alpha',
    scope: 'Ethereum on-chain',
    fetchedAt: now,
  };

  overviewCache = { data: overview, fetchedAt: now };
  return overview;
}
