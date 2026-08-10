import { describe, it, expect } from 'vitest';
import {
  runReplay,
  computeReview,
  blendConfidence,
  getStatus,
  hashString,
  resetCache,
} from './mirofishService.js';
import { MiroFishSimulationSummary, TradeDecision } from '../types.js';

// Fixture determinística de simulação para testar computeReview sem depender do PRNG
function simFixture(overrides: { direction?: TradeDecision; agreement?: number } = {}): MiroFishSimulationSummary {
  const direction = overrides.direction ?? 'COMPRAR';
  const agreement = overrides.agreement ?? 70;
  return {
    symbol: 'BTC',
    seed: 42,
    timestamp: 0,
    scenarioRuns: [
      {
        scenarioId: 's1',
        scenarioName: 'Cenário 1',
        horizonBars: 12,
        finalReturnPercent: 5,
        maxDrawdownPercent: 2,
        trajectory: [1],
        direction,
        intensity: 80,
        cohortSignals: [],
      },
    ],
    consensus: {
      direction,
      intensity: 80,
      agreement,
      scenariosCount: 1,
      alignedScenarios: 1,
    },
    stress: [
      {
        id: 'st1',
        name: 'Flash Crash',
        shockPercent: 15,
        survived: true,
        postShockDirection: direction,
      },
    ],
    cohorts: [],
  };
}

describe('mirofishService - worlds', () => {
  it('integração habilitada com worlds gerados no repositório', () => {
    const status = getStatus();
    expect(status.enabled).toBe(true);
    expect(status.worldCount).toBe(9); // 9 símbolos específicos (BTC..DOGE); _default fica de fora do índice
    expect(status.symbols).toContain('BTC');
    expect(status.defaultWorldAvailable).toBe(true);
  });

  it('replay do BTC produz os 7 cenários do world com consenso válido', () => {
    const sim = runReplay('BTC');
    expect(sim).not.toBeNull();
    expect(sim?.scenarioRuns.length).toBe(7);
    expect(['COMPRAR', 'VENDER', 'AGUARDAR / NEUTRO']).toContain(sim?.consensus.direction);
    expect(sim?.consensus.scenariosCount).toBe(7);
    expect(sim?.stress.length).toBeGreaterThan(0);
    // consenso dentro de 0..100
    expect(sim?.consensus.intensity).toBeGreaterThanOrEqual(0);
    expect(sim?.consensus.intensity).toBeLessThanOrEqual(100);
    expect(sim?.consensus.agreement).toBeLessThanOrEqual(100);
  });

  it('replay é determinístico: mesma seed → resultado idêntico', () => {
    const strip = (sim: MiroFishSimulationSummary | null) => {
      if (!sim) return sim;
      const { timestamp, ...rest } = sim;
      return rest;
    };
    const a = runReplay('BTC', { seed: 12345 });
    const b = runReplay('BTC', { seed: 12345 });
    expect(JSON.stringify(strip(a))).toBe(JSON.stringify(strip(b)));
  });

  it('seed padrão = hashString(símbolo) e reproduz o mesmo resultado', () => {
    const strip = (sim: MiroFishSimulationSummary | null) => {
      if (!sim) return sim;
      const { timestamp, ...rest } = sim;
      return rest;
    };
    const defaultSim = runReplay('BTC');
    const explicitSim = runReplay('BTC', { seed: hashString('BTC') });
    expect(defaultSim?.seed).toBe(hashString('BTC'));
    expect(JSON.stringify(strip(defaultSim))).toBe(JSON.stringify(strip(explicitSim)));
  });

  it('seeds diferentes produzem simulações diferentes', () => {
    const a = runReplay('BTC', { seed: 1 });
    const b = runReplay('BTC', { seed: 42 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('símbolo sem world usa o fallback _default', () => {
    const sim = runReplay('UNKNOWN_SYMBOL_XYZ');
    expect(sim).not.toBeNull();
    expect(sim?.symbol).toBe('UNKNOWN_SYMBOL_XYZ');
  });

  it('resetCache recarrega worlds sem quebrar replays seguintes', () => {
    resetCache();
    const sim = runReplay('ETH');
    expect(sim).not.toBeNull();
    expect(sim?.scenarioRuns.length).toBeGreaterThan(0);
  });
});

describe('mirofishService - blendConfidence', () => {
  it('calcula 0.7 comitê + 0.3 simulação', () => {
    expect(blendConfidence(80, 60)).toBe(74); // round(56 + 18)
    expect(blendConfidence(100, 100)).toBe(100);
    expect(blendConfidence(0, 0)).toBe(0);
  });

  it('mantém o comitê dominante (0.7) mesmo com simulação divergente', () => {
    expect(blendConfidence(90, 40)).toBe(75); // round(63 + 12)
  });
});

describe('mirofishService - computeReview', () => {
  it('APROVADA quando a direção do comitê alinha ao consenso da simulação', () => {
    const review = computeReview('BTC', 'COMPRAR', 80, {}, simFixture({ direction: 'COMPRAR', agreement: 70 }));
    expect(review?.verdict).toBe('APROVADA');
    expect(review?.agreementScore).toBe(70);
    expect(review?.committeeConfidence).toBe(80);
    // simConfidence(80, 70) = 40 + 28 + 14 = 82 → blended = round(56 + 24.6) = 81
    expect(review?.blendedConfidence).toBe(81);
    expect(review?.reasons.some((r) => r.includes('Confiança exibida'))).toBe(true);
  });

  it('REJEITADA quando a simulação sinaliza direção contrária', () => {
    const review = computeReview('BTC', 'COMPRAR', 80, {}, simFixture({ direction: 'VENDER', agreement: 60 }));
    expect(review?.verdict).toBe('REJEITADA');
    expect(review?.reasons.some((r) => r.includes('bloqueada'))).toBe(true);
  });

  it('NEUTRO quando a simulação não tem consenso claro', () => {
    const review = computeReview('BTC', 'COMPRAR', 80, {}, simFixture({ direction: 'AGUARDAR / NEUTRO', agreement: 50 }));
    expect(review?.verdict).toBe('NEUTRO');
  });

  it('comitê NEUTRO nunca é alterado pela simulação', () => {
    const review = computeReview('BTC', 'AGUARDAR / NEUTRO', 75, {}, simFixture({ direction: 'COMPRAR', agreement: 90 }));
    expect(review?.verdict).toBe('NEUTRO');
    expect(review?.reasons.some((r) => r.includes('Decisão neutra'))).toBe(true);
  });

  it('reporta estresse quebrado nas razões', () => {
    const fixture = simFixture({ direction: 'COMPRAR', agreement: 70 });
    fixture.stress = [
      { id: 'st1', name: 'Flash Crash', shockPercent: 15, survived: false, postShockDirection: 'VENDER' },
    ];
    const review = computeReview('BTC', 'COMPRAR', 80, {}, fixture);
    expect(review?.reasons.some((r) => r.includes('1/1 testes de estresse quebraram'))).toBe(true);
  });
});
