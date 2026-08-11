import { describe, it, expect } from 'vitest';
import { rankDefiLlamaMovers, buildDefiLlamaFlows, DefiLlamaProtocol } from './defillamaService.js';

const protocols: DefiLlamaProtocol[] = [
  { name: 'Aave', tvl: 100_000_000, change_24h: 20, chains: ['Ethereum'], category: 'Lending' },
  { name: 'Curve', tvl: 50_000_000, change_1d: -30, chains: ['Ethereum', 'Polygon'], category: 'DEX' },
  { name: 'Uniswap', tvl: 200_000_000, change_24h: 5, chains: ['Ethereum'], category: 'DEX' },
  { name: 'Bridge Irrisório', tvl: 2, change_24h: 20_000_000, chains: [], category: 'Bridge' },
  { name: 'Sem TVL', tvl: 0, change_24h: 10, chains: [], category: 'Outros' },
  { name: 'Sem variação', tvl: 300_000_000, chains: ['Ethereum'], category: 'Lending' },
];

describe('defillamaService - ranking de top movers', () => {
  it('ordena por variação absoluta, usa change_1d como fallback e aplica piso de TVL', () => {
    const movers = rankDefiLlamaMovers(protocols, 8);
    expect(movers.map((m) => m.name)).toEqual(['Curve', 'Aave', 'Uniswap']);
    expect(movers[0].changePct).toBe(-30);
    expect(movers[1].changePct).toBe(20);
  });

  it('ignora protocolos abaixo do piso de TVL ou sem variação reportada', () => {
    const movers = rankDefiLlamaMovers(protocols, 8);
    expect(movers.length).toBe(3);
    expect(movers.some((m) => m.name === 'Bridge Irrisório')).toBe(false);
    expect(movers.some((m) => m.name === 'Sem TVL')).toBe(false);
    expect(movers.some((m) => m.name === 'Sem variação')).toBe(false);
  });

  it('respeita o limite topN', () => {
    const movers = rankDefiLlamaMovers(protocols, 2);
    expect(movers.length).toBe(2);
  });
});

describe('defillamaService - agregação de fluxos', () => {
  it('calcula ganhadores, perdedores e variação média absoluta', () => {
    const flows = buildDefiLlamaFlows(protocols, 8);
    expect(flows).not.toBeNull();
    expect(flows!.aggregate.protocolsScanned).toBe(3);
    expect(flows!.aggregate.gainers24h).toBe(2);
    expect(flows!.aggregate.losers24h).toBe(1);
    expect(flows!.aggregate.avgAbsChange24h).toBeCloseTo(18.33, 2);
  });

  it('retorna null quando nenhum protocolo tem dados válidos', () => {
    const invalid = [
      { name: 'A', tvl: 0, change_24h: 5 },
      { name: 'B', chains: [] },
    ];
    expect(buildDefiLlamaFlows(invalid, 8)).toBeNull();
  });
});
