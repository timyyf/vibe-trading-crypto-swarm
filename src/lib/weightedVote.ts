import { AgentReport, TradeDecision } from '../types';

// Peso do voto conforme o estado do agente:
//   ONLINE / CONCLUÍDO / indefinido -> 1.0 (voto pleno)
//   DEGRADADO                       -> 0.5 (voto com desconto)
export function agentVoteWeight(status: AgentReport['status'] | undefined): number {
  if (status === 'DEGRADADO') return 0.5;
  return 1;
}

export interface WeightedVoteResult {
  buyWeight: number;
  sellWeight: number;
  totalWeight: number;
  decision: TradeDecision;
  confidenceScore: number;
}

// Quórum ponderado: decisão exige >= 2/3 do peso total (equivale a 4/6 com todos ONLINE).
export function computeWeightedVote(agents: AgentReport[], vetoedByRiskOfficer: boolean): WeightedVoteResult {
  let buyWeight = 0;
  let sellWeight = 0;
  for (const a of agents) {
    const w = agentVoteWeight(a.status);
    if (a.opinion === 'COMPRAR') buyWeight += w;
    else if (a.opinion === 'VENDER') sellWeight += w;
  }
  const totalWeight = agents.reduce((sum, a) => sum + agentVoteWeight(a.status), 0);
  const threshold = totalWeight * (2 / 3);

  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (!vetoedByRiskOfficer) {
    if (buyWeight >= threshold) {
      decision = 'COMPRAR';
    } else if (sellWeight >= threshold) {
      decision = 'VENDER';
    }
  }

  const confidence = Math.min(96, Math.max(55, Math.round((Math.max(buyWeight, sellWeight) / Math.max(totalWeight, 1)) * 100)));
  return { buyWeight, sellWeight, totalWeight, decision, confidenceScore: confidence };
}

// Constrói uma AgentReport mínima para testes/demonstração de votação.
export function makeVotingAgent(opinion: TradeDecision, status?: AgentReport['status']): AgentReport {
  return {
    agentId: 'technical',
    agentName: 'Test Agent',
    agentRole: 'Teste',
    avatarIcon: 'Bot',
    opinion,
    score: status === 'DEGRADADO' ? 50 : 75,
    summary: '',
    keyMetrics: [],
    signals: [],
    status,
  };
}
