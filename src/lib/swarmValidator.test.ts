import { describe, it, expect } from 'vitest';
import { validateAndSanitizeSwarmResponse, getFallbackSwarmResult } from '../lib/swarmValidator.js';
import { SwarmAnalysisResult } from '../types.js';

function makeValidResult(): SwarmAnalysisResult {
  return {
    assetSymbol: 'BTC',
    assetName: 'Bitcoin',
    assetPrice: 50000,
    timestamp: 1700000000000,
    engineSource: 'fallback',
    finalDecision: 'AGUARDAR / NEUTRO',
    confidenceScore: 67,
    signalDurationMinutes: 0,
    recommendedDurationMinutes: 0,
    durationJustification: 'Mercado neutro',
    expiryTimestamp: 1700000000000,
    entryTarget: 50000,
    stopLoss: 49000,
    takeProfit: 52000,
    riskRewardRatio: '1:2.0',
    agents: [
      {
        agentId: 'technical',
        agentName: 'Dr Quant Graph',
        agentRole: 'Técnico Sênior',
        avatarIcon: 'TrendingUp',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Análise técnica',
        keyMetrics: [{ label: 'RSI', value: '50', status: 'neutral' }],
        signals: ['RSI neutro'],
        status: 'CONCLUÍDO',
      },
      {
        agentId: 'sentiment',
        agentName: 'Sofia Sentiment',
        agentRole: 'Sentimento',
        avatarIcon: 'MessageSquare',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Sentimento',
        keyMetrics: [],
        signals: [],
        status: 'CONCLUÍDO',
      },
      {
        agentId: 'orderbook',
        agentName: 'OrderBook Sentinel',
        agentRole: 'Microestrutura',
        avatarIcon: 'Sliders',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Depth',
        keyMetrics: [],
        signals: [],
      },
      {
        agentId: 'whales',
        agentName: 'Whale Tracker',
        agentRole: 'On-chain',
        avatarIcon: 'ShieldAlert',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Whales',
        keyMetrics: [],
        signals: [],
      },
      {
        agentId: 'alpha',
        agentName: 'Alpha Zoo',
        agentRole: 'Fatores',
        avatarIcon: 'Dna',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Alpha',
        keyMetrics: [],
        signals: [],
      },
      {
        agentId: 'risk',
        agentName: 'Risk Officer',
        agentRole: 'Risco',
        avatarIcon: 'ShieldCheck',
        opinion: 'AGUARDAR / NEUTRO',
        score: 50,
        summary: 'Risco',
        keyMetrics: [],
        signals: [],
      },
    ],
    summaryConsensus: 'Comitê neutro',
    reasoningNotes: ['Votos equilibrados'],
  };
}

describe('swarmValidator - validação e sanitização', () => {
  it('payload válido passa com valid:true', () => {
    const validation = validateAndSanitizeSwarmResponse(makeValidResult());
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.sanitized.agents).toHaveLength(6);
  });

  it('payload corrompido é curado (healed) e marcado como inválido', () => {
    const bad: any = makeValidResult();
    bad.finalDecision = 'compra'; // enum errado
    bad.confidenceScore = '75'; // string -> number
    bad.agents[0].score = 150; // fora de 0-100
    const validation = validateAndSanitizeSwarmResponse(bad);
    expect(validation.valid).toBe(false);
    expect(['COMPRAR', 'VENDER', 'AGUARDAR / NEUTRO']).toContain(validation.sanitized.finalDecision);
    expect(typeof validation.sanitized.confidenceScore).toBe('number');
    expect(validation.sanitized.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(validation.sanitized.confidenceScore).toBeLessThanOrEqual(100);
    expect(validation.sanitized.agents[0].score).toBeLessThanOrEqual(100);
  });

  it('payload ausente retorna resultado de fallback seguro', () => {
    const validation = validateAndSanitizeSwarmResponse(undefined as any);
    expect(validation.valid).toBe(false);
    expect(validation.sanitized).toBeDefined();
    expect(validation.sanitized.agents.length).toBeGreaterThan(0);
  });
});

describe('swarmValidator - fallback', () => {
  it('getFallbackSwarmResult é neutro, com 0 minutos e 6 agentes', () => {
    const fallback = getFallbackSwarmResult('BTC', 'Bitcoin', 50000);
    expect(fallback.finalDecision).toBe('AGUARDAR / NEUTRO');
    expect(fallback.signalDurationMinutes).toBe(0);
    expect(fallback.agents).toHaveLength(6);
    expect(fallback.assetSymbol).toBe('BTC');
  });
});
