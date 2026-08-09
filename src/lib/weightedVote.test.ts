import { describe, it, expect } from 'vitest';
import { agentVoteWeight, computeWeightedVote, makeVotingAgent } from './weightedVote';

describe('agentVoteWeight', () => {
  it('peso 1 para ONLINE, CONCLUÍDO e status indefinido', () => {
    expect(agentVoteWeight('ONLINE')).toBe(1);
    expect(agentVoteWeight('CONCLUÍDO')).toBe(1);
    expect(agentVoteWeight(undefined)).toBe(1);
  });

  it('peso 0.5 para DEGRADADO', () => {
    expect(agentVoteWeight('DEGRADADO')).toBe(0.5);
  });
});

describe('computeWeightedVote', () => {
  it('mantém quórum 4/6 com todos os agentes ONLINE', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('AGUARDAR / NEUTRO'),
      makeVotingAgent('AGUARDAR / NEUTRO'),
    ];
    const result = computeWeightedVote(agents, false);
    expect(result.decision).toBe('COMPRAR');
    expect(result.buyWeight).toBe(4);
    expect(result.totalWeight).toBe(6);
  });

  it('não decide com apenas 3/6 (abaixo do quórum)', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('VENDER'),
      makeVotingAgent('VENDER'),
      makeVotingAgent('AGUARDAR / NEUTRO'),
    ];
    const result = computeWeightedVote(agents, false);
    expect(result.decision).toBe('AGUARDAR / NEUTRO');
  });

  it('voto DEGRADADO pesa 0.5: 4 votos sendo 1 degradado ainda aprovam', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR', 'DEGRADADO'),
      makeVotingAgent('VENDER'),
      makeVotingAgent('VENDER'),
    ];
    const result = computeWeightedVote(agents, false);
    // buyWeight = 3.5, totalWeight = 5.5, threshold = 3.67 -> 3.5 < 3.67 -> neutro
    expect(result.buyWeight).toBe(3.5);
    expect(result.totalWeight).toBe(5.5);
    expect(result.decision).toBe('AGUARDAR / NEUTRO');
  });

  it('agentes degradados reduzem o quórum proporcionalmente (3 buys + 1 deg + 2 deg neutros)', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR', 'DEGRADADO'),
      makeVotingAgent('AGUARDAR / NEUTRO', 'DEGRADADO'),
      makeVotingAgent('AGUARDAR / NEUTRO', 'DEGRADADO'),
    ];
    const result = computeWeightedVote(agents, false);
    // buyWeight = 3.5, totalWeight = 4.5, threshold = 3.0 -> decisão COMPRAR
    expect(result.buyWeight).toBe(3.5);
    expect(result.totalWeight).toBe(4.5);
    expect(result.decision).toBe('COMPRAR');
  });

  it('veto do Risk Officer bloqueia qualquer decisão', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('VENDER'),
      makeVotingAgent('VENDER'),
    ];
    const result = computeWeightedVote(agents, true);
    expect(result.decision).toBe('AGUARDAR / NEUTRO');
  });

  it('calibra confidenceScore entre 55 e 96', () => {
    const agents = [
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
      makeVotingAgent('COMPRAR'),
    ];
    const result = computeWeightedVote(agents, false);
    expect(result.confidenceScore).toBe(96);
  });
});
