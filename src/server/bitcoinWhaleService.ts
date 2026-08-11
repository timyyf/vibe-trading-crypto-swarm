import { BitcoinWhaleMove, BitcoinWhaleOverview } from '../types.js';

const MEMPOOL_BASE = 'https://mempool.space/api';
const CACHE_TTL_MS = 60 * 1000;
const WHALE_BTC_THRESHOLD = 10; // saídas >= 10 BTC contam como movimento de baleia
const SCAN_BLOCKS = 3;
const MAX_TXS_PER_BLOCK = 400; // amostra honesta: primeiras 400 txs de cada bloco
const TXS_PER_PAGE = 25; // paginação do endpoint /txs/:index
const MAX_PAGES_PER_BLOCK = Math.ceil(MAX_TXS_PER_BLOCK / TXS_PER_PAGE);
const USER_AGENT = 'vibe-trading-crypto-swarm/1.0';

interface MempoolBlock {
  id: string;
  height: number;
  tx_count: number;
}

interface MempoolVout {
  value: number; // em BTC (float)
  scriptpubkey_address?: string;
}

interface MempoolTx {
  txid: string;
  vout: MempoolVout[];
}

let btcPriceCache: { usd: number; fetchedAt: number } = { usd: 0, fetchedAt: 0 };

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[btc-whale] HTTP ${res.status} ${res.statusText} em ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn(`[btc-whale] falha de rede (${err?.name ?? 'erro'}: ${err?.message ?? String(err)}) em ${url}`);
    return null;
  }
}

async function getBtcPriceUsd(): Promise<number | null> {
  const now = Date.now();
  if (btcPriceCache.usd > 0 && now - btcPriceCache.fetchedAt < CACHE_TTL_MS) {
    return btcPriceCache.usd;
  }
  const res = await fetchJson<{ symbol?: string; price?: string }>(
    'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    4000
  );
  const price = res?.price ? parseFloat(res.price) : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  btcPriceCache = { usd: price, fetchedAt: now };
  return price;
}

// Puro e testável: extrai movimentos-baleia (saídas >= threshold) de uma lista de txs.
export function filterWhaleMoves(txs: MempoolTx[], thresholdBtc: number, blockHeight: number): BitcoinWhaleMove[] {
  const moves: BitcoinWhaleMove[] = [];
  for (const tx of txs) {
    for (const vout of tx.vout) {
      if (vout.value >= thresholdBtc && vout.scriptpubkey_address) {
        moves.push({
          txid: tx.txid,
          blockHeight,
          amountBtc: vout.value,
          amountUsd: null, // preenchido no aggregate
          recipient: vout.scriptpubkey_address,
        });
      }
    }
  }
  return moves;
}

// Puro e testável: agrega as movimentações em um overview de baleias BTC.
export function aggregateBitcoinWhale(
  moves: BitcoinWhaleMove[],
  priceUsd: number | null,
  blocksScanned: number,
  latestBlockHeight: number
): BitcoinWhaleOverview | null {
  if (moves.length === 0) return null;

  const sorted = [...moves].sort((a, b) => b.amountBtc - a.amountBtc);
  const totalBtc = sorted.reduce((sum, m) => sum + m.amountBtc, 0);
  const recipients = new Set(sorted.map((m) => m.recipient));

  return {
    stats: {
      blocksScanned,
      latestBlockHeight,
      whaleMoves: sorted.length,
      totalMovedBtc: round2(totalBtc),
      totalMovedUsd: priceUsd ? round2(totalBtc * priceUsd) : null,
      uniqueRecipients: recipients.size,
    },
    moves: sorted.slice(0, 12).map((m) => ({ ...m, amountUsd: priceUsd ? round2(m.amountBtc * priceUsd) : null })),
    source: 'Mempool.space',
    scope: `Bitcoin on-chain — saídas ≥ ${WHALE_BTC_THRESHOLD} BTC (amostra das primeiras ${MAX_TXS_PER_BLOCK} txs dos últimos ${SCAN_BLOCKS} blocos)`,
    fetchedAt: Date.now(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Busca todas as páginas da amostra de um bloco em paralelo (páginas são indexadas).
async function fetchBlockTxSample(blockId: string, txCount: number): Promise<MempoolTx[]> {
  const pages = Math.min(Math.ceil(txCount / TXS_PER_PAGE), MAX_PAGES_PER_BLOCK);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchJson<MempoolTx[]>(`${MEMPOOL_BASE}/block/${blockId}/txs/${i * TXS_PER_PAGE}`, 6000)
    )
  );
  return results.filter((r): r is MempoolTx[] => r !== null).flat();
}

async function fetchMempoolWhaleOverview(): Promise<BitcoinWhaleOverview | null> {
  const blocks = await fetchJson<MempoolBlock[]>(`${MEMPOOL_BASE}/blocks`, 6000);
  if (!blocks || blocks.length === 0) return null;

  const selected = blocks.slice(0, SCAN_BLOCKS);
  const priceUsd = await getBtcPriceUsd();

  const blockTxSamples = await Promise.all(
    selected.map((b) => fetchBlockTxSample(b.id, b.tx_count))
  );

  const moves: BitcoinWhaleMove[] = [];
  selected.forEach((b, i) => {
    moves.push(...filterWhaleMoves(blockTxSamples[i] ?? [], WHALE_BTC_THRESHOLD, b.height));
  });

  return aggregateBitcoinWhale(moves, priceUsd, selected.length, selected[0].height);
}

let btcCache: { data: BitcoinWhaleOverview | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

/**
 * Movimentos de baleias no Bitcoin via Mempool.space (sem chave).
 * Retorna null quando a fonte está indisponível — nenhum número é fabricado.
 */
export async function getBitcoinWhaleOverview(): Promise<BitcoinWhaleOverview | null> {
  const now = Date.now();
  if (btcCache.data && now - btcCache.fetchedAt < CACHE_TTL_MS) {
    return btcCache.data;
  }

  const fresh = await fetchMempoolWhaleOverview();
  if (fresh) {
    btcCache = { data: fresh, fetchedAt: now };
    return fresh;
  }
  return btcCache.data;
}
