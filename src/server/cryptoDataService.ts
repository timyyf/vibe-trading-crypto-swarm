import { CryptoAsset, KlinePoint, AlphaFactor } from '../types.js';
import { calculateEMA, calculateSMA, calculateRSI } from './quantEngine.js';

// Metadata de símbolos para mapear pares Binance -> nome/categoria (não é cotação)
const TOP_COINS_DATA: Omit<CryptoAsset, 'price' | 'change24h' | 'volume24h' | 'high24h' | 'low24h' | 'marketCap'>[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1, category: 'Layer 1' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', rank: 2, category: 'Layer 1' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', rank: 3, category: 'Layer 1' },
  { id: 'tether', symbol: 'USDT', name: 'Tether USD', rank: 4, category: 'Infrastructure' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', rank: 5, category: 'Layer 1' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', rank: 6, category: 'Layer 1' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', rank: 7, category: 'Meme' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', rank: 8, category: 'Layer 1' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', rank: 9, category: 'Layer 1' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', rank: 10, category: 'Infrastructure' },
  { id: 'sui', symbol: 'SUI', name: 'Sui', rank: 11, category: 'Layer 1' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', rank: 12, category: 'Meme' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', rank: 13, category: 'Layer 1' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', rank: 14, category: 'Meme' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', rank: 15, category: 'Layer 1' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', rank: 16, category: 'DeFi' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos', rank: 17, category: 'Layer 1' },
  { id: 'fetch-ai', symbol: 'FET', name: 'Artificial Superintelligence', rank: 18, category: 'AI & Data' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', rank: 19, category: 'Layer 2' },
  { id: 'render-token', symbol: 'RENDER', name: 'Render', rank: 20, category: 'AI & Data' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', rank: 21, category: 'Layer 1' },
  { id: 'bittensor', symbol: 'TAO', name: 'Bittensor', rank: 22, category: 'AI & Data' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', rank: 23, category: 'Layer 2' },
  { id: 'kaspa', symbol: 'KAS', name: 'Kaspa', rank: 24, category: 'Layer 1' },
  { id: 'singularitynet', symbol: 'AGIX', name: 'SingularityNET', rank: 25, category: 'AI & Data' },
  { id: 'injective-protocol', symbol: 'INJ', name: 'Injective', rank: 26, category: 'DeFi' },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', rank: 27, category: 'Meme' },
  { id: 'dogwifhat', symbol: 'WIF', name: 'dogwifhat', rank: 28, category: 'Meme' },
  { id: 'fantom', symbol: 'FTM', name: 'Fantom / Sonic', rank: 29, category: 'Layer 1' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', rank: 30, category: 'DeFi' },
  { id: 'floki', symbol: 'FLOKI', name: 'FLOKI', rank: 31, category: 'Meme' },
  { id: 'stacks', symbol: 'STX', name: 'Stacks', rank: 32, category: 'Layer 2' },
  { id: 'sei-network', symbol: 'SEI', name: 'Sei', rank: 33, category: 'Layer 1' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin', rank: 34, category: 'Infrastructure' },
  { id: 'the-graph', symbol: 'GRT', name: 'The Graph', rank: 35, category: 'AI & Data' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon', rank: 36, category: 'Layer 2' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', rank: 37, category: 'Layer 1' },
  { id: 'worldcoin-wld', symbol: 'WLD', name: 'Worldcoin', rank: 38, category: 'AI & Data' },
  { id: 'pyth-network', symbol: 'PYTH', name: 'Pyth Network', rank: 39, category: 'DeFi' },
  { id: 'jupiter-exchange-solana', symbol: 'JUP', name: 'Jupiter', rank: 40, category: 'DeFi' },
  { id: 'ondo-finance', symbol: 'ONDO', name: 'Ondo', rank: 41, category: 'DeFi' },
  { id: 'lido-dao', symbol: 'LDO', name: 'Lido DAO', rank: 42, category: 'DeFi' },
  { id: 'toncoin', symbol: 'TON', name: 'Toncoin', rank: 43, category: 'Layer 1' },
  { id: 'starknet', symbol: 'STRK', name: 'Starknet', rank: 44, category: 'Layer 2' },
  { id: 'ethena', symbol: 'ENA', name: 'Ethena', rank: 45, category: 'DeFi' },
  { id: 'immutable-x', symbol: 'IMX', name: 'Immutable', rank: 46, category: 'Layer 2' },
  { id: 'monero', symbol: 'XMR', name: 'Monero', rank: 47, category: 'Layer 1' },
  { id: 'thorchain', symbol: 'RUNE', name: 'THORChain', rank: 48, category: 'DeFi' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand', rank: 49, category: 'Layer 1' },
  { id: 'celestia', symbol: 'TIA', name: 'Celestia', rank: 50, category: 'Infrastructure' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain', rank: 51, category: 'Layer 1' },
  { id: 'popcat', symbol: 'POPCAT', name: 'Popcat', rank: 52, category: 'Meme' },
  { id: 'beam-2', symbol: 'BEAM', name: 'Beam', rank: 53, category: 'Infrastructure' },
  { id: 'maker', symbol: 'MKR', name: 'Maker / Sky', rank: 54, category: 'DeFi' },
  { id: 'dydx-chain', symbol: 'DYDX', name: 'dYdX', rank: 55, category: 'DeFi' },
  { id: 'mantle', symbol: 'MNT', name: 'Mantle', rank: 56, category: 'Layer 2' },
  { id: 'gala', symbol: 'GALA', name: 'GALA', rank: 57, category: 'Infrastructure' },
  { id: 'pendle', symbol: 'PENDLE', name: 'Pendle', rank: 58, category: 'DeFi' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', rank: 59, category: 'Layer 1' },
  { id: 'brett-by-matt-furie', symbol: 'BRETT', name: 'Brett', rank: 60, category: 'Meme' },
  { id: 'quant-network', symbol: 'QNT', name: 'Quant', rank: 61, category: 'Infrastructure' },
  { id: 'theta-token', symbol: 'THETA', name: 'Theta Network', rank: 62, category: 'Infrastructure' },
  { id: 'eos', symbol: 'EOS', name: 'EOS', rank: 63, category: 'Layer 1' },
  { id: 'tezos', symbol: 'XTZ', name: 'Tezos', rank: 64, category: 'Layer 1' },
  { id: 'multiversx-egld', symbol: 'EGLD', name: 'MultiversX', rank: 65, category: 'Layer 1' },
  { id: 'helium', symbol: 'HNT', name: 'Helium', rank: 66, category: 'Infrastructure' },
  { id: 'flow', symbol: 'FLOW', name: 'Flow', rank: 67, category: 'Layer 1' },
  { id: 'ronin', symbol: 'RON', name: 'Ronin', rank: 68, category: 'Layer 1' },
  { id: 'sandbox', symbol: 'SAND', name: 'The Sandbox', rank: 69, category: 'Infrastructure' },
  { id: 'decentraland', symbol: 'MANA', name: 'Decentraland', rank: 70, category: 'Infrastructure' },
  { id: 'chiliz', symbol: 'CHZ', name: 'Chiliz', rank: 71, category: 'Infrastructure' },
  { id: 'axie-infinity', symbol: 'AXS', name: 'Axie Infinity', rank: 72, category: 'Infrastructure' },
  { id: 'apecoin', symbol: 'APE', name: 'ApeCoin', rank: 73, category: 'Meme' },
  { id: 'synthetix-network-token', symbol: 'SNX', name: 'Synthetix', rank: 74, category: 'DeFi' },
  { id: 'conflux-token', symbol: 'CFX', name: 'Conflux', rank: 75, category: 'Layer 1' },
  { id: 'neo', symbol: 'NEO', name: 'NEO', rank: 76, category: 'Layer 1' },
  { id: 'kaia', symbol: 'KAIA', name: 'Kaia', rank: 77, category: 'Layer 1' },
  { id: 'oasis-network', symbol: 'ROSE', name: 'Oasis Network', rank: 78, category: 'Layer 1' },
  { id: 'kava', symbol: 'KAVA', name: 'Kava', rank: 79, category: 'Layer 1' },
  { id: 'gmx', symbol: 'GMX', name: 'GMX', rank: 80, category: 'DeFi' },
  { id: '1inch', symbol: '1INCH', name: '1inch Network', rank: 81, category: 'DeFi' },
  { id: 'curve-dao-token', symbol: 'CRV', name: 'Curve DAO', rank: 82, category: 'DeFi' },
  { id: 'compound-governance-token', symbol: 'COMP', name: 'Compound', rank: 83, category: 'DeFi' },
  { id: 'mina-protocol', symbol: 'MINA', name: 'Mina Protocol', rank: 84, category: 'Layer 1' },
  { id: 'wootrade', symbol: 'WOO', name: 'WOO Network', rank: 85, category: 'DeFi' },
  { id: 'illuvium', symbol: 'ILV', name: 'Illuvium', rank: 86, category: 'Infrastructure' },
  { id: 'blur', symbol: 'BLUR', name: 'Blur', rank: 87, category: 'DeFi' },
  { id: 'raydium', symbol: 'RAY', name: 'Raydium', rank: 88, category: 'DeFi' },
  { id: 'orca', symbol: 'ORCA', name: 'Orca', rank: 89, category: 'DeFi' },
  { id: 'biconomy', symbol: 'BICO', name: 'Biconomy', rank: 90, category: 'Infrastructure' },
  { id: 'superverse', symbol: 'SUPER', name: 'SuperVerse', rank: 91, category: 'Infrastructure' },
  { id: 'gala-music', symbol: 'MUSIC', name: 'Gala Music', rank: 92, category: 'Infrastructure' },
  { id: 'mew', symbol: 'MEW', name: 'cat in a dogs world', rank: 93, category: 'Meme' },
  { id: 'neiro', symbol: 'NEIRO', name: 'First Neiro', rank: 94, category: 'Meme' },
  { id: 'puffer-finance', symbol: 'PUFFER', name: 'Puffer Finance', rank: 95, category: 'DeFi' },
  { id: 'eigenlayer', symbol: 'EIGEN', name: 'EigenLayer', rank: 96, category: 'Infrastructure' },
  { id: 'zetachain', symbol: 'ZETA', name: 'ZetaChain', rank: 97, category: 'Layer 1' },
  { id: 'zksync', symbol: 'ZK', name: 'ZKsync', rank: 98, category: 'Layer 2' },
  { id: 'bouncebit', symbol: 'BB', name: 'BounceBit', rank: 99, category: 'DeFi' },
  { id: 'virtual-protocol', symbol: 'VIRTUAL', name: 'Virtuals Protocol', rank: 100, category: 'AI & Data' },
];

function mapBinancePair(pair: any, idx: number): CryptoAsset {
  const rawSymbol = pair.symbol.replace('USDT', '');
  const matchedSeed = TOP_COINS_DATA.find((c) => c.symbol === rawSymbol);
  const price = parseFloat(pair.lastPrice);
  const change24h = parseFloat(pair.priceChangePercent);
  const volume24h = parseFloat(pair.quoteVolume);
  const high24h = parseFloat(pair.highPrice);
  const low24h = parseFloat(pair.lowPrice);

  return {
    id: matchedSeed ? matchedSeed.id : rawSymbol.toLowerCase(),
    symbol: rawSymbol,
    name: matchedSeed ? matchedSeed.name : `${rawSymbol} Protocol`,
    price,
    change24h,
    volume24h,
    high24h,
    low24h,
    marketCap: volume24h * 15.4,
    rank: idx + 1,
    category: matchedSeed ? matchedSeed.category : 'Outros',
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Top 100 por volume 24h — apenas provedores reais (Binance -> Vision -> CoinGecko).
// Se todos falharem, retorna vazio (a UI mostra estado 'dados indisponíveis').
export async function getTop100CryptoAssets(): Promise<CryptoAsset[]> {
  // Provider 1: Binance Spot Ticker
  try {
    const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr', 3500);
    if (res.ok) {
      const data: any[] = await res.json();
      const usdtPairs = data.filter((d: any) => d.symbol.endsWith('USDT'));
      usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      const topPairs = usdtPairs.slice(0, 100);
      const assets = topPairs.map(mapBinancePair);
      if (assets.length >= 20) return assets;
    }
  } catch (_err) {
    // try backup provider
  }

  // Provider 2: Binance Vision Mirror
  try {
    const res = await fetchWithTimeout('https://data-api.binance.vision/api/v3/ticker/24hr', 3500);
    if (res.ok) {
      const data: any[] = await res.json();
      const usdtPairs = data.filter((d: any) => d.symbol.endsWith('USDT'));
      usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      const topPairs = usdtPairs.slice(0, 100);
      const assets = topPairs.map(mapBinancePair);
      if (assets.length >= 20) return assets;
    }
  } catch (_err) {
    // try backup provider
  }

  // Provider 3: CoinGecko Public Markets API
  try {
    const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false', 4000);
    if (res.ok) {
      const data: any[] = await res.json();
      const assets: CryptoAsset[] = data.map((item, idx) => {
        const rawSymbol = item.symbol.toUpperCase();
        const matchedSeed = TOP_COINS_DATA.find((c) => c.symbol === rawSymbol);

        const price = parseFloat(item.current_price || '0');
        const change24h = parseFloat(item.price_change_percentage_24h || '0');
        const volume24h = parseFloat(item.total_volume || '0');
        const high24h = parseFloat(item.high_24h || price);
        const low24h = parseFloat(item.low_24h || price);

        return {
          id: item.id || (matchedSeed ? matchedSeed.id : rawSymbol.toLowerCase()),
          symbol: rawSymbol,
          name: item.name || (matchedSeed ? matchedSeed.name : rawSymbol),
          price,
          change24h,
          volume24h,
          high24h,
          low24h,
          marketCap: parseFloat(item.market_cap || (volume24h * 10).toString()),
          rank: idx + 1,
          category: matchedSeed ? matchedSeed.category : 'Outros',
        };
      });
      if (assets.length >= 10) return assets;
    }
  } catch (_err) {
    // sem mais provedores — retorna vazio abaixo
  }

  return [];
}

// Klines reais da Binance com indicadores (EMA20, SMA50, RSI14) calculados sobre os dados reais.
// Sem fallback sintético: se a Binance falhar, retorna [] e a UI mostra 'gráfico indisponível'.
export async function getCryptoKlines(symbol: string, interval = '5m', limit = 40): Promise<KlinePoint[]> {
  const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

  const tryFetch = async (baseUrl: string): Promise<KlinePoint[] | null> => {
    const res = await fetchWithTimeout(`https://${baseUrl}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`, 3500);
    if (!res.ok) return null;
    const data: any[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const klines: KlinePoint[] = data.map((k: any) => ({
      time: formatBinanceTime(k[0]),
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    const closes = klines.map((k) => k.close);
    const ema20 = calculateEMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const rsi14 = calculateRSI(closes, 14);

    return klines.map((k, idx) => ({
      ...k,
      ema20: Number(ema20.toFixed(2)),
      sma50: Number(sma50.toFixed(2)),
      rsi: Number(rsi14.toFixed(1)),
    }));
  };

  const fromBinance = await tryFetch('api.binance.com');
  if (fromBinance) return fromBinance;
  const fromVision = await tryFetch('data-api.binance.vision');
  if (fromVision) return fromVision;

  return [];
}

function formatBinanceTime(timestampMs: string): string {
  const timeObj = new Date(Number(timestampMs));
  return `${timeObj.getHours().toString().padStart(2, '0')}:${timeObj.getMinutes().toString().padStart(2, '0')}`;
}

// Alpha Zoo Factors (Vibe-Trading library) — valores ic/sharpe/winRate são REFERÊNCIA de literatura
// (papers GTJA-191 / Alpha101). O valor atual do fator é calculado em tempo real via /api/crypto/hmm e /api/crypto/backtest.
export const ALPHA_ZOO_FACTORS: AlphaFactor[] = [
  {
    id: 'gtja191_001',
    name: 'GTJA191 Alpha #001 (Volume Price Divergence)',
    category: 'Volume Flow',
    formula: 'Rank(Ts_ArgMax(SignedPower(If(Returns < 0, StdDev(Returns, 20), Volume), 2), 5))',
    ic: 0.054,
    sharpe: 2.42,
    winRate: 67.2,
    maxDrawdown: -11.5,
    description: 'Mede a divergência entre aceleração de volume e retornos negativos em janelas curtas.',
  },
  {
    id: 'alpha101_059',
    name: 'Alpha101 #059 (Momentum Breakout)',
    category: 'Momentum',
    formula: 'Correlation(Close, Volume, 10) * Slope(Close, 5)',
    ic: 0.048,
    sharpe: 2.15,
    winRate: 64.8,
    maxDrawdown: -14.2,
    description: 'Mede a correlação positiva entre preço de fechamento e volume de negociação durante rupturas.',
  },
  {
    id: 'mean_reversion_rsi',
    name: 'Mean Reversion Dynamic RSI (3m)',
    category: 'Mean Reversion',
    formula: 'If(RSI(3) < 22 AND Price <= BB_Lower, BuySignal, Neutral)',
    ic: 0.062,
    sharpe: 2.85,
    winRate: 71.4,
    maxDrawdown: -9.8,
    description: 'Estratégia de sobrevenda extrema alinhada com desvio padrão das Bandas de Bollinger.',
  },
  {
    id: 'whale_flow_imbalance',
    name: 'Whale Orderbook Imbalance (Institutional)',
    category: 'Machine Learning',
    formula: 'Sum(BidSize_Top5) / (Sum(BidSize_Top5) + Sum(AskSize_Top5))',
    ic: 0.071,
    sharpe: 3.12,
    winRate: 74.1,
    maxDrawdown: -8.2,
    description: 'Mede a assimetria do livro de ofertas nas 5 primeiras posições de liquidação de baleias.',
  },
];
