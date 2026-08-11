import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MiroFishCohort,
  MiroFishReview,
  MiroFishScenarioRun,
  MiroFishSimulationSummary,
  MiroFishWorld,
  TradeDecision,
} from '../types.js';

// ---------------------------------------------------------------------------
// Resolução do diretório de worlds (dev, bundle dist e Netlify functions)
// ---------------------------------------------------------------------------

const WORLDS_DIR_CANDIDATES = (): string[] => {
  const candidates = [
    path.join(process.cwd(), 'mirofish', 'worlds'),
    path.join(process.cwd(), 'dist', 'mirofish', 'worlds'),
  ];
  // __dirname não existe em ESM; deriva do import.meta.url (indisponível em bundles cjs antigos).
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(
      path.join(dir, 'mirofish', 'worlds'),
      path.join(dir, '..', 'mirofish', 'worlds'),
      path.join(dir, '..', '..', 'mirofish', 'worlds'),
    );
  } catch {
    // import.meta.url indisponível — mantém apenas os candidatos por process.cwd().
  }
  return candidates;
};

let cachedDir: string | null | undefined = undefined;

function resolveWorldsDir(): string | null {
  if (cachedDir !== undefined) return cachedDir;
  for (const candidate of WORLDS_DIR_CANDIDATES()) {
    try {
      if (existsSync(path.join(candidate, '_default.json'))) {
        cachedDir = candidate;
        return candidate;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  cachedDir = null;
  return null;
}

export const isMiroFishEnabled = (): boolean => resolveWorldsDir() !== null;

// ---------------------------------------------------------------------------
// Cache de worlds
// ---------------------------------------------------------------------------

const worldCache = new Map<string, MiroFishWorld>();

function resetCache(): void {
  worldCache.clear();
}

export function loadWorld(symbol: string): MiroFishWorld | null {
  const dir = resolveWorldsDir();
  if (!dir) return null;

  const normalized = (symbol || '').trim().toUpperCase();
  if (worldCache.has(normalized)) return worldCache.get(normalized) ?? null;

  const file = path.join(dir, `${normalized}.json`);
  if (existsSync(file)) {
    try {
      const world = JSON.parse(readFileSync(file, 'utf8')) as MiroFishWorld;
      worldCache.set(normalized, world);
      return world;
    } catch (err) {
      console.warn(`[mirofish] world ${normalized} inválido:`, err);
    }
  }

  // Fallback: _default.json (símbolos fora da lista)
  try {
    const def = JSON.parse(readFileSync(path.join(dir, '_default.json'), 'utf8')) as MiroFishWorld;
    worldCache.set(normalized, def);
    return def;
  } catch (err) {
    console.warn('[mirofish] _default.json indisponível:', err);
    return null;
  }
}

export function listWorlds(): { symbol: string; name: string; description: string }[] {
  const dir = resolveWorldsDir();
  if (!dir) return [];
  try {
    const files = readdirSync(dir).filter((f) => /^[A-Z0-9]+\.json$/.test(f));
    return files
      .map((f) => {
        const symbol = f.replace(/\.json$/, '');
        const world = loadWorld(symbol);
        return {
          symbol,
          name: world?.name ?? symbol,
          description: world?.description ?? '',
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  } catch {
    return [];
  }
}

export function listScenarios(): { id: string; name: string; bias: TradeDecision }[] {
  const world = loadWorld('BTC');
  if (!world) return [];
  return world.scenarios.map((s) => ({ id: s.id, name: s.name, bias: s.bias }));
}

export function getStatus() {
  const dir = resolveWorldsDir();
  const defaultWorld = loadWorld('UNKNOWN_SYMBOL');
  return {
    enabled: isMiroFishEnabled(),
    dir,
    worldCount: dir ? listWorlds().length : 0,
    symbols: listWorlds().map((w) => w.symbol),
    defaultWorldAvailable: !!defaultWorld,
    defaultWorldVersion: defaultWorld?.schemaVersion ?? null,
  };
}

// ---------------------------------------------------------------------------
// PRNG determinístico (mulberry32) para replay reprodutível
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const clip = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

// ---------------------------------------------------------------------------
// Replay determinístico (Monte Carlo com seed fixa por símbolo)
// ---------------------------------------------------------------------------

interface ReplayContext {
  symbol: string;
  price?: number;
  change24h?: number;
  seed?: number;
}

export function computeDirection(score: number): TradeDecision {
  if (score >= 60) return 'COMPRAR';
  if (score <= 40) return 'VENDER';
  return 'AGUARDAR / NEUTRO';
}

function cohortScore(
  cohort: MiroFishCohort,
  finalReturnPct: number,
  rand: () => number
): number {
  const isMeanRev = cohort.id === 'mean_reversion';
  const isMomentum = cohort.id === 'momentum';
  const isLiquidator = cohort.id === 'liquidators';
  const isRiskAverse = cohort.id === 'risk_averse';

  let influence = 0;

  if (isMeanRev) {
    // Fade do movimento: sobe após quedas, cede após altas
    influence -= finalReturnPct * 5;
  } else if (isLiquidator) {
    // Stop hunters lucram com amplitude (shakeouts)
    influence += Math.abs(finalReturnPct) * 2 * (finalReturnPct < 0 ? 1 : -0.4);
  } else {
    influence += finalReturnPct * 5;
  }

  influence += cohort.bias * 32;

  if (isMomentum) influence += Math.sign(finalReturnPct) * Math.min(18, Math.abs(finalReturnPct) * 3);
  if (isRiskAverse) {
    // Aversão: amplitude alta puxa para neutro
    const volPenalty = Math.min(22, Math.abs(finalReturnPct) * 1.2);
    influence *= 1 - volPenalty / 100;
  }

  const noise = (rand() * 2 - 1) * 7 * (1 - cohort.volatilityTolerance);
  return clip(50 + influence + noise, 2, 98);
}

function runScenarioById(
  world: MiroFishWorld,
  ctx: ReplayContext,
  rand: () => number,
  scenarioId: string
): MiroFishScenarioRun | null {
  const scenario = world.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  // Regime injection: o change24h real do ativo influencia levemente o drift
  const regimeFactor = ctx.change24h != null ? 1 + (ctx.change24h / 100) * 0.15 : 1;
  const drift = scenario.drift * regimeFactor;

  const trajectory: number[] = [1];
  let peak = 1;
  let maxDrawdown = 0;
  for (let i = 0; i < scenario.horizonBars; i++) {
    const shock = drift + scenario.volatility * gaussian(rand);
    const next = trajectory[trajectory.length - 1] * (1 + shock);
    trajectory.push(next);
    if (next > peak) peak = next;
    const drawdown = ((peak - next) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalReturnPct = ((trajectory[trajectory.length - 1] - 1) / 1) * 100;

  const cohortSignals = world.cohorts.map((cohort) => {
    const score = cohortScore(cohort, finalReturnPct, rand);
    return {
      cohortId: cohort.id,
      name: cohort.name,
      count: cohort.count,
      signal: computeDirection(score),
      score: Math.round(score),
    };
  });

  const totalCount = cohortSignals.reduce((sum, c) => sum + c.count, 0) || 1;
  const weightedScore = cohortSignals.reduce((sum, c) => sum + c.score * c.count, 0) / totalCount;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    horizonBars: scenario.horizonBars,
    finalReturnPercent: +finalReturnPct.toFixed(2),
    maxDrawdownPercent: +maxDrawdown.toFixed(2),
    trajectory: trajectory.map((p) => +p.toFixed(4)),
    direction: computeDirection(weightedScore),
    intensity: Math.round(Math.abs(weightedScore - 50) * 2),
    cohortSignals,
  };
}

export function runReplay(
  symbol: string,
  ctx: Omit<ReplayContext, 'symbol'> = {}
): MiroFishSimulationSummary | null {
  const world = loadWorld(symbol);
  if (!world) return null;

  const seed = ctx.seed ?? hashString(symbol);
  const rand = mulberry32(seed);

  const scenarioRuns: MiroFishScenarioRun[] = [];
  for (const scenario of world.scenarios) {
    const run = runScenarioById(world, { symbol, ...ctx }, rand, scenario.id);
    if (run) scenarioRuns.push(run);
  }

  // Consenso ponderado por intensidade dos cenários
  const weights: Record<string, number> = { 'COMPRAR': 0, 'VENDER': 0, 'AGUARDAR / NEUTRO': 0 };
  for (const run of scenarioRuns) {
    const w = run.direction === 'AGUARDAR / NEUTRO' ? run.intensity * 0.35 : run.intensity + 1;
    weights[run.direction] += w;
  }
  const total = weights['COMPRAR'] + weights['VENDER'] + weights['AGUARDAR / NEUTRO'] || 1;

  let direction: TradeDecision = 'AGUARDAR / NEUTRO';
  if (weights['COMPRAR'] > weights['VENDER'] && weights['COMPRAR'] > weights['AGUARDAR / NEUTRO']) direction = 'COMPRAR';
  else if (weights['VENDER'] > weights['COMPRAR'] && weights['VENDER'] > weights['AGUARDAR / NEUTRO']) direction = 'VENDER';

  const aligned = scenarioRuns.filter((r) => r.direction === direction).length;
  const consensus = {
    direction,
    intensity: Math.round((Math.max(weights['COMPRAR'], weights['VENDER'], weights['AGUARDAR / NEUTRO']) / total) * 100),
    agreement: Math.round((aligned / Math.max(scenarioRuns.length, 1)) * 100),
    scenariosCount: scenarioRuns.length,
    alignedScenarios: aligned,
  };

  // Stress tests sobre o cenário dominante
  const stress = world.stressTests.map((test) => {
    const base = scenarioRuns.find((r) => r.direction === direction) ?? scenarioRuns[0];
    const shockScore = base ? base.intensity * (1 + test.shockPercent / 100) : 0;
    const postScore = clip(shockScore, 0, 100);
    const postShockDirection: TradeDecision =
      postScore < 40
        ? direction === 'COMPRAR'
          ? 'VENDER'
          : direction === 'VENDER'
          ? 'COMPRAR'
          : 'AGUARDAR / NEUTRO'
        : direction;
    const survived = postShockDirection === direction;
    return {
      id: test.id,
      name: test.name,
      shockPercent: test.shockPercent,
      survived,
      postShockDirection,
    };
  });

  return {
    symbol,
    seed,
    timestamp: Date.now(),
    scenarioRuns,
    consensus,
    stress,
    cohorts: world.cohorts,
  };
}

// ---------------------------------------------------------------------------
// Revisão do comitê (APROVADA / REJEITADA / NEUTRO) + pesagem de confiança
// ---------------------------------------------------------------------------

export const blendConfidence = (committeeConfidence: number, simulationConfidence: number): number =>
  Math.round(clip(0.7 * committeeConfidence + 0.3 * simulationConfidence, 0, 100));

function simulationConfidence(sim: MiroFishSimulationSummary): number {
  // Intensidade + acordo entre cenários → confiança 40-95
  const base = 40 + (sim.consensus.intensity / 100) * 35 + (sim.consensus.agreement / 100) * 20;
  return clip(Math.round(base), 40, 95);
}

export function computeReview(
  symbol: string,
  committeeDecision: TradeDecision,
  committeeConfidence: number,
  marketCtx: Omit<ReplayContext, 'symbol'> = {},
  precomputedSimulation?: MiroFishSimulationSummary | null
): MiroFishReview | null {
  const simulation = precomputedSimulation ?? runReplay(symbol, marketCtx);
  if (!simulation) return null;

  const simConfidence = simulationConfidence(simulation);
  const blendedConfidence = blendConfidence(committeeConfidence, simConfidence);
  const isTrade = committeeDecision === 'COMPRAR' || committeeDecision === 'VENDER';

  let verdict: MiroFishReview['verdict'] = 'NEUTRO';
  if (isTrade) {
    if (simulation.consensus.direction === committeeDecision && simulation.consensus.agreement >= 55) {
      verdict = 'APROVADA';
    } else if (
      simulation.consensus.direction !== 'AGUARDAR / NEUTRO' &&
      simulation.consensus.direction !== committeeDecision &&
      simulation.consensus.agreement >= 45
    ) {
      verdict = 'REJEITADA';
    } else {
      verdict = 'NEUTRO';
    }
  }

  const stressSurvived = simulation.stress.filter((s) => s.survived).length;
  const reasons: string[] = [
    `Simulação MiroFish: consenso ${simulation.consensus.direction} com intensidade ${simulation.consensus.intensity}/100 e acordo de ${simulation.consensus.agreement}% entre ${simulation.consensus.scenariosCount} cenários.`,
    `Fatos do world ${symbol}: ${loadWorld(symbol)?.seedFacts.length ?? 0} entradas com proveniência calibrando as coortes.`,
  ];

  if (isTrade) {
    if (verdict === 'APROVADA') {
      reasons.push(`Direção do comitê (${committeeDecision}) alinhada ao consenso da simulação.`);
    } else if (verdict === 'REJEITADA') {
      reasons.push(`A simulação sinaliza ${simulation.consensus.direction} — contrária à decisão do comitê. Execução visualmente bloqueada (decisão do comitê permanece).`);
    } else {
      reasons.push(`Simulação sem consenso claro (acordo ${simulation.consensus.agreement}%).`);
    }
  } else {
    reasons.push('Decisão neutra do comitê — a simulação não altera o veredito (apenas pondera a confiança exibida).');
  }

  if (stressSurvived < simulation.stress.length) {
    reasons.push(`${simulation.stress.length - stressSurvived}/${simulation.stress.length} testes de estresse quebraram o consenso.`);
  }

  reasons.push(`Confiança exibida: ${committeeConfidence}% comitê → ${blendedConfidence}% (0.7 comitê + 0.3 simulação).`);

  return {
    verdict,
    agreementScore: simulation.consensus.agreement,
    committeeConfidence,
    blendedConfidence,
    reasons,
    simulation,
  };
}

// Resumo em texto para injeção no prompt Gemini (apenas suporte; comitê decide).
export function summarizeForPrompt(symbol: string, marketCtx: Omit<ReplayContext, 'symbol'> = {}): string | null {
  const simulation = runReplay(symbol, marketCtx);
  if (!simulation) return null;

  const scenarioLines = simulation.scenarioRuns
    .map(
      (r) =>
        `  - ${r.scenarioName}: ${r.direction} (int ${r.intensity}/100, ret ${r.finalReturnPercent >= 0 ? '+' : ''}${r.finalReturnPercent}%, dd ${r.maxDrawdownPercent}%)`
    )
    .join('\n');

  const stressLines = simulation.stress
    .map((s) => `  - ${s.name}: ${s.survived ? 'sobreviveu' : `quebrou (${s.postShockDirection})`}`)
    .join('\n');

  const factsLines = (loadWorld(symbol)?.seedFacts ?? [])
    .slice(0, 4)
    .map((f) => `  - [${f.impact}] ${f.fact} (${f.provenance.source})`)
    .join('\n');

  return `MIROFISH REVIEW (simulação de apoio — NÃO decide; apenas suporte ao comitê):
Consenso da simulação: ${simulation.consensus.direction} (intensidade ${simulation.consensus.intensity}/100, acordo ${simulation.consensus.agreement}%).
Cenários:
${scenarioLines}
Stress:
${stressLines}
Fatos seed com proveniência:
${factsLines}`;
}

export { resetCache };
