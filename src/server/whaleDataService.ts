import { WhaleOverview, WhaleOverviewStats, WhaleIndexData, WhaleIndexPoint, TopWhaleToken } from '../types.js';

const DBA_BASE = 'https://deepbluealpha.io/api/v1/public';
const ETH_API = 'https://api.etherscan.io/v2/api';
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
 * Agregados on-chain reais de baleias (escopo Ethereum).
 *
 * 1º: Deep Blue Alpha (sem chave, 3 endpoints públicos).
 * 2º: GetBlock RPC (GETBLOCK_ETH_URL) — varre os últimos blocos atrás de
 *     transferências grandes de ETH e infere a direção do fluxo comparando com
 *     endereços públicos conhecidos de exchanges.
 * 3º: Etherscan (ETHEREUM_API_KEY) — mesma heurística de varredura de blocos.
 *
 * Nenhum número é fabricado: se todas as fontes falharem, retorna null (DEGRADADO).
 */
export async function getWhaleOverview(): Promise<WhaleOverview | null> {
  const now = Date.now();
  if (overviewCache.data && now - overviewCache.fetchedAt < CACHE_TTL_MS) {
    return overviewCache.data;
  }

  const dba = await fetchDeepBlueAlphaOverview(now);
  if (dba) {
    overviewCache = { data: dba, fetchedAt: now };
    return dba;
  }

  const getblock = await fetchGetBlockWhaleOverview(now);
  if (getblock) {
    overviewCache = { data: getblock, fetchedAt: now };
    return getblock;
  }

  const fallback = await fetchEtherscanWhaleOverview(now);
  if (fallback) {
    overviewCache = { data: fallback, fetchedAt: now };
    return fallback;
  }

  return null;
}

async function fetchDeepBlueAlphaOverview(now: number): Promise<WhaleOverview | null> {
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

  return {
    stats,
    index,
    topTokens,
    source: 'Deep Blue Alpha',
    scope: 'Ethereum on-chain',
    fetchedAt: now,
  };
}

// --- Fallbacks on-chain (GetBlock RPC + Etherscan): varredura de blocos ---

const ETHEREUM_API_KEY = process.env.ETHEREUM_API_KEY || '';
const GETBLOCK_ETH_URL = process.env.GETBLOCK_ETH_URL || '';
const WHALE_ETH_THRESHOLD = BigInt(50_000_000_000_000_000_000n); // 50 ETH (em wei)
const FALLBACK_BLOCKS_SCAN = 5;
const MAX_TXS_PER_BLOCK = 400;

// Endereços públicos de depósito de exchanges (lista curta e bem conhecida).
// Movimento PARA a exchange = depósito (pressão de venda); DA exchange = saque (pressão de compra).
const EXCHANGE_ADDRESSES = new Set(
  [
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', // Binance 2
    '0x21a31ee1afc51d94c2efcca2092ad1028285549', // Binance 3
    '0x4976a4a02f38326660d17bf34b431dc6e2eb2327', // Binance 4
    '0x503828976d22510aad0201ac7ec88293211d23da', // Coinbase
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase 2
    '0x5a52e96bacdabb82fd05763e25335261b270efcb', // Coinbase 3
    '0x2910543af39aba0cd09dbb2d50200b3e800a63d2', // Kraken
    '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', // OKX
    '0xf89d7b9c864f589bbf53a82105107622b35eaa40', // Bybit
    '0x876eabfb441b2ee5b5b0554fd502a8e0600950cfa', // Bitfinex
  ].map((a) => a.toLowerCase())
);

interface EtherscanTx {
  hash?: string;
  from?: string;
  to?: string;
  value?: string; // wei em hex
}

interface EtherscanBlock {
  number?: string;
  transactions?: EtherscanTx[];
}

interface EtherscanBlockResponse {
  result?: EtherscanBlock | string;
}

interface WhaleScanResult {
  wallets: Set<string>;
  buyEth: bigint;
  sellEth: bigint;
  neutralEth: bigint;
  whaleTransfers: number;
  latestBlock: bigint;
}

let ethPriceCache: { usd: number; fetchedAt: number } = { usd: 0, fetchedAt: 0 };

async function getEthPriceUsd(): Promise<number | null> {
  const now = Date.now();
  if (ethPriceCache.usd > 0 && now - ethPriceCache.fetchedAt < CACHE_TTL_MS) {
    return ethPriceCache.usd;
  }
  const res = await fetchJson<{ symbol?: string; price?: string }>(
    'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    4000,
    1
  );
  const price = res?.price ? parseFloat(res.price) : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  ethPriceCache = { usd: price, fetchedAt: now };
  return price;
}

function hexToBigInt(hex: string | undefined): bigint {
  if (!hex) return 0n;
  const clean = hex.startsWith('0x') ? hex : `0x${hex}`;
  try {
    return BigInt(clean);
  } catch {
    return 0n;
  }
}

// Scan compartilhado entre GetBlock e Etherscan: agregação idêntica, só muda a fonte.
// Blocos são varridos EM PARALELO (5 blocos de uma vez) para caber no deadline da sonda.
async function scanWhaleBlocks(
  getTxs: (blockNumber: bigint) => Promise<EtherscanTx[] | null>,
  latestBlock: bigint
): Promise<WhaleScanResult | null> {
  const blockNumbers = Array.from({ length: FALLBACK_BLOCKS_SCAN }, (_, i) => latestBlock - BigInt(i));
  const results = await Promise.all(blockNumbers.map((bn) => getTxs(bn)));

  const wallets = new Set<string>();
  let buyEth = 0n;
  let sellEth = 0n;
  let neutralEth = 0n;
  let whaleTransfers = 0;

  for (const txs of results) {
    if (!txs) continue;
    for (const tx of txs.slice(0, MAX_TXS_PER_BLOCK)) {
      const value = hexToBigInt(tx.value);
      if (value < WHALE_ETH_THRESHOLD) continue;
      whaleTransfers++;
      const from = (tx.from ?? '').toLowerCase();
      const to = (tx.to ?? '').toLowerCase();
      if (from) wallets.add(from);
      if (to) wallets.add(to);
      if (EXCHANGE_ADDRESSES.has(to)) sellEth += value;
      else if (EXCHANGE_ADDRESSES.has(from)) buyEth += value;
      else neutralEth += value;
    }
  }

  if (whaleTransfers === 0) return null;
  return { wallets, buyEth, sellEth, neutralEth, whaleTransfers, latestBlock };
}

function buildWhaleOverviewFromScan(
  scan: WhaleScanResult,
  ethPriceUsd: number,
  now: number,
  source: string,
  scope: string
): WhaleOverview {
  const { wallets, buyEth, sellEth, neutralEth, whaleTransfers } = scan;
  const totalEth = buyEth + sellEth + neutralEth;
  const netEth = buyEth - sellEth;
  const totalUsd = (Number(totalEth) / 1e18) * ethPriceUsd;
  const buyUsd = (Number(buyEth) / 1e18) * ethPriceUsd;
  const sellUsd = (Number(sellEth) / 1e18) * ethPriceUsd;
  const netUsd = (Number(netEth) / 1e18) * ethPriceUsd;

  const buyShare = buyEth + sellEth > 0n ? Number(buyEth) / Number(buyEth + sellEth) : 0.5;
  const indexScore = Math.max(5, Math.min(95, Math.round(20 + buyShare * 60)));
  const classification = indexScore >= 60 ? 'Compra' : indexScore <= 40 ? 'Venda' : 'Misto';

  const stats: WhaleOverviewStats = {
    trackedWallets: wallets.size,
    activeWallets24h: wallets.size,
    buyVolume24h: buyUsd,
    sellVolume24h: sellUsd,
    netFlow24h: netUsd,
    dexTrades24h: whaleTransfers,
    exchangeFlows24h: whaleTransfers,
    totalVolume24h: totalUsd,
    latestBlock: Number(scan.latestBlock ?? 0),
  };

  const index: WhaleIndexData = {
    current: indexScore,
    classification,
    buyScore: Math.round(buyShare * 100),
    sellScore: Math.round((1 - buyShare) * 100),
    confidence: 60,
    history: [],
    fetchedAt: now,
  };

  const topTokens: TopWhaleToken[] = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      trades: whaleTransfers,
      volumeUsd: totalUsd,
      netFlowUsd: netUsd,
      direction: netUsd > 0 ? 'ACUMULAÇÃO' : netUsd < 0 ? 'DISTRIBUIÇÃO' : 'NEUTRO',
      wallets: wallets.size,
    },
  ];

  return {
    stats,
    index,
    topTokens,
    source,
    scope,
    fetchedAt: now,
  };
}

// --- Fallback GetBlock (JSON-RPC via GETBLOCK_ETH_URL) ---

async function rpcFetch<T>(method: string, params: unknown[], timeoutMs = 4000): Promise<T | null> {
  if (!GETBLOCK_ETH_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GETBLOCK_ETH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[whale] GetBlock HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeout);
    const reason = err?.name === 'AbortError'
      ? `timeout ${timeoutMs}ms`
      : `${err?.name ?? 'erro'}: ${err?.message ?? String(err)}`;
    console.warn(`[whale] GetBlock falha de rede (${reason})`);
    return null;
  }
}

async function fetchGetBlockWhaleOverview(now: number): Promise<WhaleOverview | null> {
  if (!GETBLOCK_ETH_URL) return null;

  const [ethPriceUsd, latestHex] = await Promise.all([
    getEthPriceUsd(),
    rpcFetch<{ result?: string }>('eth_blockNumber', []),
  ]);
  const latestBlock = latestHex?.result ? hexToBigInt(latestHex.result) : null;
  if (!ethPriceUsd || latestBlock === null || latestBlock <= 0n) return null;

  const scan = await scanWhaleBlocks(async (bn) => {
    const res = await rpcFetch<{ result?: { transactions?: EtherscanTx[] } }>(
      'eth_getBlockByNumber',
      [`0x${bn.toString(16)}`, true],
      5000
    );
    return res?.result?.transactions ?? null;
  }, latestBlock);
  if (!scan) return null;

  const overview = buildWhaleOverviewFromScan(
    scan,
    ethPriceUsd,
    now,
    'GetBlock RPC (fallback)',
    `Ethereum on-chain — transferências ≥ ${WHALE_ETH_THRESHOLD / 1_000_000_000_000_000_000n} ETH nos últimos ${FALLBACK_BLOCKS_SCAN} blocos`
  );
  console.info(`[whale] fallback GetBlock ativo (bloco ${overview.stats.latestBlock}, ${scan.wallets.size} carteiras-baleia)`);
  return overview;
}

// --- Fallback Etherscan ---

function ethUrl(params: string): string {
  return `${ETH_API}?chainid=1&${params}&apikey=${ETHEREUM_API_KEY}`;
}

async function getLatestBlockNumber(): Promise<bigint | null> {
  const res = await fetchJson<{ result?: string }>(ethUrl('module=proxy&action=eth_blockNumber'), 4000, 1);
  if (!res?.result) return null;
  const bn = hexToBigInt(res.result);
  return bn > 0n ? bn : null;
}

async function getBlockTransactions(blockNumber: bigint): Promise<EtherscanTx[] | null> {
  const res = await fetchJson<EtherscanBlockResponse>(
    ethUrl(`module=proxy&action=eth_getBlockByNumber&tag=0x${blockNumber.toString(16)}&boolean=false`),
    4000,
    1
  );
  const block = typeof res?.result === 'object' ? res.result : undefined;
  return block?.transactions ?? null;
}

async function fetchEtherscanWhaleOverview(now: number): Promise<WhaleOverview | null> {
  if (!ETHEREUM_API_KEY) return null;

  const [ethPriceUsd, latestBlock] = await Promise.all([getEthPriceUsd(), getLatestBlockNumber()]);
  if (!ethPriceUsd || latestBlock === null) return null;

  const scan = await scanWhaleBlocks((bn) => getBlockTransactions(bn), latestBlock);
  if (!scan) return null;

  const overview = buildWhaleOverviewFromScan(
    scan,
    ethPriceUsd,
    now,
    'Etherscan (fallback)',
    `Ethereum on-chain — transferências ≥ ${WHALE_ETH_THRESHOLD / 1_000_000_000_000_000_000n} ETH nos últimos ${FALLBACK_BLOCKS_SCAN} blocos`
  );
  console.info(`[whale] fallback Etherscan ativo (bloco ${overview.stats.latestBlock}, ${scan.wallets.size} carteiras-baleia)`);
  return overview;
}
