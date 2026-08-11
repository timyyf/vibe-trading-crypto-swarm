import { DefiLlamaFlows, DefiLlamaMover } from '../types.js';

const CACHE_TTL_MS = 120 * 1000;
const TOP_MOVERS = 8;
// Piso de TVL: evita que protocolos de TVL irrisória (ex.: bridge com US$ 2)
// apareçam como "+20.000.000%" no ranking — foca fluxos institucionais reais.
const MIN_TVL_USD = 1_000_000;
const USER_AGENT = 'vibe-trading-crypto-swarm/1.0';

// DefiLlama tem dois hosts históricos; o primário (api.defillama.com) pode não
// resolver DNS em algumas redes, então tentamos ambos em ordem.
const HOST_ATTEMPTS: { host: string; path: string; timeoutMs: number }[] = [
  { host: 'https://api.defillama.com', path: '/v2/protocols', timeoutMs: 6000 },
  { host: 'https://api.llama.fi', path: '/protocols', timeoutMs: 10000 },
];

export interface DefiLlamaProtocol {
  name?: string;
  tvl?: number;
  chains?: string[];
  category?: string;
  change_24h?: number; // schema v2
  change_1d?: number; // schema v1 (api.llama.fi)
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[defillama] HTTP ${res.status} ${res.statusText} em ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn(`[defillama] falha de rede (${err?.name ?? 'erro'}: ${err?.message ?? String(err)}) em ${url}`);
    return null;
  }
}

async function fetchProtocols(): Promise<DefiLlamaProtocol[] | null> {
  for (const { host, path, timeoutMs } of HOST_ATTEMPTS) {
    const data = await fetchJson<DefiLlamaProtocol[]>(`${host}${path}`, timeoutMs);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  }
  return null;
}

// A variação vem como change_24h no schema v2 e change_1d no v1.
function parseChange(p: DefiLlamaProtocol): number | null {
  const c = p.change_24h ?? p.change_1d;
  return typeof c === 'number' && Number.isFinite(c) ? c : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Puro e testável: ranking dos protocolos com maior variação absoluta de TVL 24h.
export function rankDefiLlamaMovers(protocols: DefiLlamaProtocol[], topN = TOP_MOVERS): DefiLlamaMover[] {
  return protocols
    .filter((p) => typeof p.tvl === 'number' && Number.isFinite(p.tvl) && p.tvl >= MIN_TVL_USD && parseChange(p) !== null)
    .sort((a, b) => Math.abs(parseChange(b)!) - Math.abs(parseChange(a)!))
    .slice(0, topN)
    .map((p) => ({
      name: p.name ?? 'unknown',
      category: p.category ?? 'DeFi',
      tvlUsd: p.tvl!,
      changePct: round2(parseChange(p)!),
      chains: (p.chains ?? []).slice(0, 3),
    }));
}

// Puro e testável: agrega o retrato de fluxos DeFi 24h.
export function buildDefiLlamaFlows(protocols: DefiLlamaProtocol[], topN = TOP_MOVERS): DefiLlamaFlows | null {
  const withChange = protocols.filter(
    (p) => typeof p.tvl === 'number' && Number.isFinite(p.tvl) && p.tvl >= MIN_TVL_USD && parseChange(p) !== null
  );
  if (withChange.length === 0) return null;

  const gainers = withChange.filter((p) => parseChange(p)! > 0).length;
  const losers = withChange.filter((p) => parseChange(p)! < 0).length;
  const avgAbs = withChange.reduce((s, p) => s + Math.abs(parseChange(p)!), 0) / withChange.length;

  return {
    aggregate: {
      protocolsScanned: withChange.length,
      gainers24h: gainers,
      losers24h: losers,
      avgAbsChange24h: round2(avgAbs),
    },
    topMovers: rankDefiLlamaMovers(protocols, topN),
    source: 'DefiLlama',
    scope: 'Fluxos de TVL 24h por protocolo (DeFi)',
    fetchedAt: Date.now(),
  };
}

let flowsCache: { data: DefiLlamaFlows | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

/**
 * Retrato de fluxos institucionais/DeFi via DefiLlama (sem chave).
 * Retorna null quando a fonte está indisponível — nenhum número é fabricado.
 */
export async function getDefiLlamaFlows(): Promise<DefiLlamaFlows | null> {
  const now = Date.now();
  if (flowsCache.data && now - flowsCache.fetchedAt < CACHE_TTL_MS) {
    return flowsCache.data;
  }

  const protocols = await fetchProtocols();
  if (!protocols) return flowsCache.data;

  const fresh = buildDefiLlamaFlows(protocols);
  if (fresh) {
    flowsCache = { data: fresh, fetchedAt: now };
    return fresh;
  }
  return flowsCache.data;
}
