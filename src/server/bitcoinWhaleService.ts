import { BitcoinWhaleMove, BitcoinWhaleOverview } from '../types.js';

const MEMPOOL_BASE = 'https://mempool.space/api';
const CACHE_TTL_MS = 3 * 60 * 1000;
const WHALE_BTC_THRESHOLD = 10; // saídas >= 10 BTC contam como movimento de baleia
const SCAN_BLOCKS = 3;
const MAX_TXS_PER_BLOCK = 100; // amostra honesta: primeiras 100 txs de cada bloco (4 páginas)
const TXS_PER_PAGE = 25; // paginação do endpoint /txs/:index
const MAX_PAGES_PER_BLOCK = Math.ceil(MAX_TXS_PER_BLOCK / TXS_PER_PAGE);
const USER_AGENT = 'vibe-trading-crypto-swarm/1.0';

interface MempoolBlock {
  id: string;
  height: number;
  tx_count: number;
}

interface MempoolVout {
  value: number; // em SATOSHIS (inteiro) — a API do Mempool.space usa sats, não BTC
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
    if (res.status === 429 || res.status === 503) {
      const retryAfterMs = Math.min(Number(res.headers.get('retry-after') || '1') * 1000, 1000);
      await new Promise((r) => setTimeout(r, retryAfterMs));
      const res2 = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
      });
      if (!res2.ok) {
        console.warn(`[btc-whale] HTTP ${res2.status} ${res2.statusText} em ${url} (após retry)`);
        return null;
      }
      return (await res2.json()) as T;
    }
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

const SATS_PER_BTC = 1e8;

// Fontes de preço com fallback: Binance (pode bloquear IPs de datacenter) ->
// CoinGecko -> OKX. Mantém o USD calculável mesmo com a Binance inacessível.
const BTC_PRICE_SOURCES: { url: string; extract: (j: any) => number | null }[] = [
  { url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', extract: (j) => (j?.price ? parseFloat(j.price) : NaN) },
  { url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', extract: (j) => j?.bitcoin?.usd },
  { url: 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT', extract: (j) => parseFloat(j?.data?.[0]?.last) },
];

async function getBtcPriceUsd(): Promise<number | null> {
  const now = Date.now();
  if (btcPriceCache.usd > 0 && now - btcPriceCache.fetchedAt < CACHE_TTL_MS) {
    return btcPriceCache.usd;
  }
  for (const source of BTC_PRICE_SOURCES) {
    const res = await fetchJson<any>(source.url, 4000);
    const price = source.extract(res);
    if (Number.isFinite(price) && (price as number) > 0) {
      btcPriceCache = { usd: price as number, fetchedAt: now };
      return price as number;
    }
  }
  return null;
}

// Puro e testável: extrai movimentos-baleia de uma lista de txs.
// O Mempool.space reporta `vout.value` em satoshis; convertemos para BTC.
export function filterWhaleMoves(txs: MempoolTx[], thresholdBtc: number, blockHeight: number): BitcoinWhaleMove[] {
  const moves: BitcoinWhaleMove[] = [];
  for (const tx of txs) {
    for (const vout of tx.vout) {
      if (vout.value >= thresholdBtc * SATS_PER_BTC && vout.scriptpubkey_address) {
        moves.push({
          txid: tx.txid,
          blockHeight,
          amountBtc: Math.round((vout.value / SATS_PER_BTC) * 10000) / 10000,
          amountUsd: null, // preenchido no aggregate
          recipient: vout.scriptpubkey_address,
        });
      }
    }
  }
  return moves;
}

// Puro e testável: agrega as movimentações em um overview de baleias BTC.
// Retorna null apenas quando a lista de movimentos está vazia (nenhum número fabricado).
export function aggregateBitcoinWhale(
  moves: BitcoinWhaleMove[],
  priceUsd: number | null,
  blocksScanned: number,
  latestBlockHeight: number,
  txsScanned?: number
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
      ...(txsScanned !== undefined ? { txsScanned } : {}),
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

// Puro e testável: extrai movimentos-baleia de uma lista de txs e conta cobertura.
function extractMovesAndCoverage(
  samples: MempoolTx[][],
  blocks: MempoolBlock[],
  priceUsd: number | null
): { moves: BitcoinWhaleMove[]; txsScanned: number } {
  const moves: BitcoinWhaleMove[] = [];
  let txsScanned = 0;
  blocks.forEach((b, i) => {
    const blockTxs = samples[i] ?? [];
    txsScanned += blockTxs.length;
    moves.push(...filterWhaleMoves(blockTxs, WHALE_BTC_THRESHOLD, b.height));
  });
  return { moves, txsScanned };
}

async function fetchMempoolWhaleOverview(): Promise<BitcoinWhaleOverview | null> {
  const blocks = await fetchJson<MempoolBlock[]>(`${MEMPOOL_BASE}/blocks`, 6000);
  if (!blocks || blocks.length === 0) return null;

  const selected = blocks.slice(0, SCAN_BLOCKS);

  // Preço em paralelo com as páginas — a falha do preço não segura o fetch nem fabrica nada.
  const [priceUsd, blockTxSamples] = await Promise.all([
    getBtcPriceUsd(),
    Promise.all(selected.map((b) => fetchBlockTxSample(b.id, b.tx_count))),
  ]);

  const { moves, txsScanned } = extractMovesAndCoverage(blockTxSamples, selected, priceUsd);

  // Fonte respondeu (blocos + páginas), mas nenhuma saída ≥ 10 BTC na amostra:
  // é atividade nula, NÃO fonte indisponível. Retorna overview com 0 movimentos.
  const aggregated = aggregateBitcoinWhale(moves, priceUsd, selected.length, selected[0].height, txsScanned);
  if (aggregated) return aggregated;

  return {
    stats: {
      blocksScanned: selected.length,
      latestBlockHeight: selected[0].height,
      whaleMoves: 0,
      totalMovedBtc: 0,
      totalMovedUsd: 0,
      uniqueRecipients: 0,
      txsScanned,
    },
    moves: [],
    source: 'Mempool.space',
    scope: `Bitcoin on-chain — saídas ≥ ${WHALE_BTC_THRESHOLD} BTC (amostra das primeiras ${MAX_TXS_PER_BLOCK} txs dos últimos ${SCAN_BLOCKS} blocos; fonte respondendo, 0 movimentos na amostra)`,
    fetchedAt: Date.now(),
  };
}

let btcCache: { data: BitcoinWhaleOverview | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
let btcFetchInFlight: Promise<BitcoinWhaleOverview | null> | null = null;

/**
 * Movimentos de baleias no Bitcoin via Mempool.space (sem chave).
 * Deduplica fetches concorrentes (probe do health + painel) e usa stale-while-revalidate:
 * retorna cache expirado quando o refresh falha, nunca fabrica números.
 */
export async function getBitcoinWhaleOverview(): Promise<BitcoinWhaleOverview | null> {
  const now = Date.now();
  if (btcCache.data && now - btcCache.fetchedAt < CACHE_TTL_MS) {
    return btcCache.data;
  }
  if (btcFetchInFlight) return btcFetchInFlight;
  btcFetchInFlight = fetchMempoolWhaleOverview()
    .then((fresh) => {
      if (fresh) {
        btcCache = { data: fresh, fetchedAt: Date.now() };
      }
      return fresh;
    })
    .finally(() => {
      btcFetchInFlight = null;
    });
  return btcFetchInFlight;
}
