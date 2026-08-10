/**
 * Gerador dos mundos MiroFish (simulação de apoio ao comitê).
 *
 * Cria mirofish/worlds/*.json a partir de um template determinístico:
 *   - 1 world por ativo (BTC, ETH, SOL, SUI, NEAR, PEPE, XRP, BNB, DOGE)
 *   - 1 _default.json usado como fallback para símbolos desconhecidos
 *   - cada world carrega um bloco "seed" de fatos reais com proveniência
 *
 * Uso: npm run mirofish:generate  (tsx scripts/generate-mirofish-worlds.ts)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MiroFishScenario, MiroFishWorld } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'mirofish', 'worlds');

const VERSION = 1;

// --- Template global de coortes / cenários / stress -----------------------

const COHORTS = [
  { id: 'momentum', name: 'Seguidores de Momentum', count: 400, bias: 0.6, volatilityTolerance: 0.4, icon: 'TrendingUp' },
  { id: 'mean_reversion', name: 'Reversores de Média', count: 300, bias: -0.2, volatilityTolerance: 0.6, icon: 'GitCompareArrows' },
  { id: 'sentiment_drift', name: 'Drift de Sentimento', count: 250, bias: 0.3, volatilityTolerance: 0.5, icon: 'MessageSquare' },
  { id: 'whale_follower', name: 'Seguidores de Baleias', count: 200, bias: 0.4, volatilityTolerance: 0.3, icon: 'ShieldAlert' },
  { id: 'liquidators', name: 'Liquidadores (Stop Hunt)', count: 150, bias: -0.4, volatilityTolerance: 0.8, icon: 'Zap' },
  { id: 'risk_averse', name: 'Aversos a Risco', count: 100, bias: 0.1, volatilityTolerance: 0.2, icon: 'Shield' },
] as const;

interface ScenarioTemplate {
  id: string;
  name: string;
  drift: number;
  volatility: number;
  horizonBars: number;
  bias: MiroFishScenario['bias'];
}

const SCENARIOS: ScenarioTemplate[] = [
  { id: 'momentum_continuation', name: 'Continuação de Momentum', drift: 0.0012, volatility: 0.004, horizonBars: 60, bias: 'COMPRAR' },
  { id: 'breakout_liquidity_sweep', name: 'Breakout com Sweep de Liquidez', drift: 0.0018, volatility: 0.006, horizonBars: 30, bias: 'COMPRAR' },
  { id: 'fomo_rally', name: 'Rally de FOMO (Retail)', drift: 0.0025, volatility: 0.01, horizonBars: 20, bias: 'COMPRAR' },
  { id: 'range_bound', name: 'Range Lateral sem Direção', drift: 0.0001, volatility: 0.002, horizonBars: 60, bias: 'AGUARDAR / NEUTRO' },
  { id: 'mean_reversion_rally', name: 'Reversão à Média Pós-Queda', drift: 0.0004, volatility: 0.005, horizonBars: 40, bias: 'AGUARDAR / NEUTRO' },
  { id: 'flash_crash_dip_buy', name: 'Flash Crash com Compra da Queda', drift: -0.0015, volatility: 0.008, horizonBars: 30, bias: 'VENDER' },
  { id: 'capitulation_climax', name: 'Clímax de Capitulação', drift: -0.0025, volatility: 0.012, horizonBars: 20, bias: 'VENDER' },
];

const STRESS_TESTS = [
  { id: 'flash_crash', name: 'Flash Crash (-15% em 1h)', shockPercent: -15, recoveryBars: 8, liquidityGap: true },
  { id: 'liquidity_gap', name: 'Gap de Liquidez L2', shockPercent: -8, recoveryBars: 12, liquidityGap: true },
  { id: 'funding_drain', name: 'Funding Drain (Shorts Squeeze)', shockPercent: -5, recoveryBars: 20, liquidityGap: false },
];

interface CoinProfile {
  symbol: string;
  name: string;
  description: string;
  volatilityMultiplier: number;
  driftMultiplier: number;
  facts: { id: string; fact: string; impact: 'bullish' | 'bearish' | 'neutral'; weight: number; source: string; url?: string; date?: string }[];
}

const PROFILES: CoinProfile[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    description: 'Maior criptomoeda por capitalização — reserva de valor digital e referência de regime de risco para todo o mercado.',
    volatilityMultiplier: 1.0,
    driftMultiplier: 1.0,
    facts: [
      { id: 'btc-halving-2024', fact: 'Quarto halving (abril/2024) reduziu a emissão para 3,125 BTC por bloco (~450 BTC/dia).', impact: 'bullish', weight: 1.0, source: 'Bitcoin Core / mempool.space', url: 'https://mempool.space', date: '2024-04' },
      { id: 'btc-etf-flows', fact: 'ETFs spot de Bitcoin nos EUA acumularam centenas de milhares de BTC sob gestão em 2024, mudando o balanço oferta/demanda do spot.', impact: 'bullish', weight: 0.9, source: 'Sosovalue / Farside Investors', url: 'https://sosovalue.com', date: '2024' },
      { id: 'btc-miner-position', fact: 'Miner Position Index (MPI) perto de 1 indica venda neutra de mineradores; picos acima de 3 historicamente marcaram topos locais.', impact: 'neutral', weight: 0.4, source: 'CryptoQuant', url: 'https://cryptoquant.com', date: '2024' },
    ],
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    description: 'Maior plataforma de contratos inteligentes — camada de liquidez do DeFi e ecossistema de staking via Beacon Chain.',
    volatilityMultiplier: 1.25,
    driftMultiplier: 1.05,
    facts: [
      { id: 'eth-merge-staking', fact: 'Pós-Merge, o Ethereum tem emissão líquida negativa em períodos de alta atividade (burn via EIP-1559 > emissão).', impact: 'bullish', weight: 0.8, source: 'ultrasound.money', url: 'https://ultrasound.money', date: '2023' },
      { id: 'eth-etf-flows', fact: 'ETFs spot de ETH nos EUA listados em julho/2024 abriram demanda regulada institucional para o ativo.', impact: 'bullish', weight: 0.8, source: 'SEC filings / Farside Investors', url: 'https://farside.co.uk', date: '2024-07' },
      { id: 'eth-l2-share', fact: 'Share de blocos processados fora da mainnet (L2s) cresce trimestre a trimestre, reduzindo pressão de congestionamento na L1.', impact: 'neutral', weight: 0.5, source: 'L2BEAT', url: 'https://l2beat.com', date: '2024' },
    ],
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    description: 'L1 de alta performance (TPS) com ecossistema agressivo de memecoins, DeFi e infraestrutura de pagamentos.',
    volatilityMultiplier: 1.7,
    driftMultiplier: 1.3,
    facts: [
      { id: 'sol-meme-ecosystem', fact: 'Lançamentos de memecoins (BONK, WIF) e plataformas de lançamento impulsionam volume on-chain recorde em períodos de alta.', impact: 'bullish', weight: 0.8, source: 'SolanaFM / Dune Analytics', url: 'https://solana.fm', date: '2024' },
      { id: 'sol-outages', fact: 'Outages históricos da rede (interrupções multi-hora em 2022/2023) rebaixam a percepção de confiabilidade institucional.', impact: 'bearish', weight: 0.7, source: 'Status da rede / comunicações oficiais', date: '2023' },
      { id: 'sol-liquid-staking', fact: 'Liquid staking e airdrops de protocolos geram pressão de venda recorrente dos yields', impact: 'neutral', weight: 0.4, source: 'Solana Foundation / DefiLlama', url: 'https://defillama.com', date: '2024' },
    ],
  },
  {
    symbol: 'SUI',
    name: 'Sui',
    description: 'L1 em Move da Mysten Labs — alta escalabilidade com objeto-centric data model; foco em jogos e pagamentos.',
    volatilityMultiplier: 1.9,
    driftMultiplier: 1.4,
    facts: [
      { id: 'sui-mysten', fact: 'Desenvolvida pela Mysten Labs (fundada por ex-funcionários do Meta/Diem) — avaliação de venture elevada nos rounds.', impact: 'bullish', weight: 0.6, source: 'Crunchbase / Mysten Labs', url: 'https://mystenlabs.com', date: '2023' },
      { id: 'sui-lockups', fact: 'Supply schedule com desbloqueios (token unlock) periódicos exerce pressão de venda em fases de alta emissão.', impact: 'bearish', weight: 0.8, source: 'Tokenomika / SUI Foundation', url: 'https://tokenomika.com', date: '2024' },
      { id: 'sui-payments', fact: 'Parcerias com carteiras e empresas de pagamento (ex.: integrações com credenciadoras) ampliam casos de uso real.', impact: 'bullish', weight: 0.5, source: 'Comunicados da SUI Foundation', date: '2024' },
    ],
  },
  {
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    description: 'L1 sharded focada em usabilidade (Chain Signatures, NEAR AI) — narrativa de web3 orientada ao usuário e IA.',
    volatilityMultiplier: 1.6,
    driftMultiplier: 1.2,
    facts: [
      { id: 'near-ai-hub', fact: 'NEAR AI Hub e agentes on-chain posicionam a rede na narrativa de IA + cripto em 2024/2025.', impact: 'bullish', weight: 0.8, source: 'NEAR Foundation', url: 'https://near.org', date: '2024' },
      { id: 'near-chain-abstraction', fact: 'Chain Signatures permitem contas NEAR controlarem carteiras em outras redes — caso de uso real de abstração de cadeia.', impact: 'bullish', weight: 0.6, source: 'NEAR Docs', url: 'https://docs.near.org', date: '2024' },
      { id: 'near-low-liquidity', fact: 'Liquidez relativamente menor vs. L1s top-5 torna o ativo mais suscetível a movimentos de fluxo.', impact: 'bearish', weight: 0.5, source: 'CoinGecko / CoinMarketCap', url: 'https://coingecko.com', date: '2024' },
    ],
  },
  {
    symbol: 'PEPE',
    name: 'Pepe',
    description: 'Memecoin ERC-20 sem equipe — dinâmica puramente de fluxo, listagens e narrativa social (alta correlação com varejo).',
    volatilityMultiplier: 2.6,
    driftMultiplier: 1.8,
    facts: [
      { id: 'pepe-top-listing', fact: 'Listagens em corretoras top e derivativos (perpetual futures) ampliaram o acesso de varejo e alavancagem.', impact: 'bullish', weight: 0.7, source: 'Binance / CME anúncios', date: '2023' },
      { id: 'pepe-zero-tvl', fact: 'Sem TVL, sem utilidade intrínseca — a precificação depende exclusivamente de fluxo especulativo e atenção social.', impact: 'bearish', weight: 0.9, source: 'DefiLlama (TVL ~0)', url: 'https://defillama.com', date: '2024' },
      { id: 'pepe-etf-narrative', fact: 'Tentativas de proposta de memecoin index (ex.: Buzz index) geram ondas de FOMO especulativo em fases de alta.', impact: 'neutral', weight: 0.5, source: 'NYSE Arca / SEC filings', date: '2025' },
    ],
  },
  {
    symbol: 'XRP',
    name: 'XRP',
    description: 'Token da Ripple para pagamentos transfronteiriços (xRapid/ODL) — sensível a disputas regulatórias nos EUA.',
    volatilityMultiplier: 1.35,
    driftMultiplier: 1.1,
    facts: [
      { id: 'xrp-sec-ruling', fact: 'Sentença de julho/2023 no caso SEC vs. Ripple definiu que vendas programáticas no mercado secundário não são valores mobiliários.', impact: 'bullish', weight: 0.9, source: 'Tribunal Distrital de NY (SDNY)', url: 'https://www.govinfo.gov', date: '2023-07' },
      { id: 'xrp-odl-corridors', fact: 'Ripple expande corredores de pagamento (ODL) e parcerias bancárias em mercados emergentes.', impact: 'bullish', weight: 0.6, source: 'Ripple blog / parcerias anunciadas', url: 'https://ripple.com', date: '2024' },
      { id: 'xrp-escrow-release', fact: 'Escrow mensal da Ripple libera bilhões de XRP para o tesouro — venda gradual cria oferta recorrente no mercado.', impact: 'bearish', weight: 0.7, source: 'XRPLedger explorers', url: 'https://xrpscan.com', date: '2024' },
    ],
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    description: 'Token utilitário do ecossistema Binance (BNB Chain + exchange) — queimas trimestrais e casos de uso em taxas.',
    volatilityMultiplier: 1.1,
    driftMultiplier: 1.0,
    facts: [
      { id: 'bnb-burn', fact: 'Queima trimestral (auto-burn proporcional ao preço) reduz a oferta circulante de forma recorrente.', impact: 'bullish', weight: 0.9, source: 'BNB Chain / BNB Auto-Burn', url: 'https://www.bnbchain.org', date: '2024' },
      { id: 'bnb-regulatory', fact: 'Acordos regulatórios da Binance (2023/2024) e multas pesadas criam cauda de risco institucional.', impact: 'bearish', weight: 0.7, source: 'DOJ / CFTC / FinCEN acordos', date: '2023-11' },
      { id: 'bnb-launchpool', fact: 'Launchpool e airdrops de novos projetos na BNB Chain geram demanda de staking (BNB locked).', impact: 'bullish', weight: 0.6, source: 'Binance Launchpool', url: 'https://www.binance.com', date: '2024' },
    ],
  },
  {
    symbol: 'DOGE',
    name: 'Dogecoin',
    description: 'Memecoin pioneira (PoW) com comunidade massiva — forte dependência de narrativa social e de influenciadores.',
    volatilityMultiplier: 2.2,
    driftMultiplier: 1.5,
    facts: [
      { id: 'doge-institutional', fact: 'Menções institucionais (inclusive no governo dos EUA em 2025) e adoção de pagamentos por varejistas geram ondas de demanda.', impact: 'bullish', weight: 0.8, source: 'Notícias / comunicações oficiais', date: '2025' },
      { id: 'doge-infinite-supply', fact: 'Emissão sem teto (~10k DOGE/min como recompensa de mineração) dilui de forma contínua a oferta.', impact: 'bearish', weight: 0.6, source: 'GitHub dogecoin / DOGECOIN core', url: 'https://github.com/dogecoin', date: '2024' },
      { id: 'doge-community', fact: 'Comunidade entre as maiores do setor — memes e influência social movem volumes mesmo sem utilidade técnica.', impact: 'neutral', weight: 0.5, source: 'Análises de social volume / Santiment', url: 'https://santiment.net', date: '2024' },
    ],
  },
];

function buildWorld(profile: CoinProfile): MiroFishWorld {
  return {
    schemaVersion: VERSION,
    symbol: profile.symbol,
    name: profile.name,
    description: profile.description,
    seedFacts: profile.facts.map((f) => ({
      id: f.id,
      fact: f.fact,
      impact: f.impact,
      weight: f.weight,
      provenance: { source: f.source, url: f.url, date: f.date },
    })),
    cohorts: COHORTS.map((c) => ({ ...c })),
    scenarios: SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      drift: +(s.drift * profile.driftMultiplier).toFixed(6),
      volatility: +(s.volatility * profile.volatilityMultiplier).toFixed(6),
      horizonBars: s.horizonBars,
      bias: s.bias,
    })),
    stressTests: STRESS_TESTS.map((s) => ({ ...s })),
  };
}

function buildDefaultWorld(): MiroFishWorld {
  return {
    schemaVersion: VERSION,
    symbol: 'DEFAULT',
    name: 'World Genérico',
    description: 'World fallback para símbolos sem configuração própria — parâmetros de cenário no perfil neutro.',
    seedFacts: [
      {
        id: 'default-real-data',
        fact: 'World genérico: usa apenas klines reais de mercado para calibrar a simulação (sem fatos fabricados).',
        impact: 'neutral',
        weight: 0.5,
        provenance: { source: 'Binance Spot', url: 'https://www.binance.com', date: '2024' },
      },
    ],
    cohorts: COHORTS.map((c) => ({ ...c })),
    scenarios: SCENARIOS.map((s) => ({ ...s })),
    stressTests: STRESS_TESTS.map((s) => ({ ...s })),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const worlds = [buildDefaultWorld(), ...PROFILES.map(buildWorld)];
  for (const world of worlds) {
    const file = world.symbol === 'DEFAULT' ? '_default.json' : `${world.symbol}.json`;
    const target = path.join(OUT_DIR, file);
    await writeFile(target, JSON.stringify(world, null, 2) + '\n', 'utf8');
    console.log(`[mirofish] gerado ${target}`);
  }

  console.log(`\n[mirofish] ${worlds.length} worlds em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('[mirofish] falha ao gerar worlds:', err);
  process.exit(1);
});
