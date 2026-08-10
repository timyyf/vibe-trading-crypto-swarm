import { describe, it, expect } from 'vitest';
import { buildProvODocument, escapeTurtle } from './provoExport';
import { ProvDecision } from './provoExport';

const committeeRecord: ProvDecision = {
  decision_id: 'dec-abc-1',
  category: 'trade_decision',
  scenario: 'Trade em BTC (Bitcoin) — decisão COMPRAR, confiança 88%.',
  reasoning: 'MACD cruzou para cima\nVolume 2x acima da média',
  outcome: 'COMPRAR',
  confidence: 0.88,
  entities: ['BTC', 'technical', 'risk'],
  decision_maker: 'gemini',
  timestamp: 1720000000000,
  recorded_at: '2024-07-03T12:00:00.000Z',
  metadata: {},
};

const mirofishRecord: ProvDecision = {
  decision_id: 'mirofish-BTC-12345-1720000001000',
  category: 'mirofish_world',
  scenario: 'Ensaio MiroFish em BTC — consenso COMPRAR (int 80/100, acordo 70%).',
  reasoning: 'Simulação MiroFish: consenso COMPRAR.',
  outcome: 'APROVADA',
  confidence: 0.7,
  entities: ['BTC', 'cohort:momentum', 'cohort:risk_averse'],
  decision_maker: 'mirofish',
  timestamp: 1720000001000,
  recorded_at: '2024-07-03T12:00:01.000Z',
  metadata: { committee_decision_id: 'dec-abc-1', seed: 12345 },
};

const journalRecord: ProvDecision = {
  decision_id: 'journal-op-1',
  category: 'trade_journal',
  scenario: 'Trade em ETH (COMPRA) — FECHADA: LUCRO.',
  reasoning: '',
  outcome: 'FECHADA: LUCRO',
  confidence: 0.6,
  entities: ['ETH'],
  decision_maker: 'journal',
  timestamp: 1720000002000,
  recorded_at: '2024-07-03T12:00:02.000Z',
  metadata: { ref_decision_id: 'dec-abc-1' },
};

describe('escapeTurtle', () => {
  it('escapa aspas, barras invertidas e quebras de linha', () => {
    expect(escapeTurtle('a"b\\c\nd')).toBe('a\\"b\\\\c\\nd');
  });

  it('trata undefined/null como string vazia', () => {
    expect(escapeTurtle(undefined)).toBe('');
    expect(escapeTurtle(null)).toBe('');
  });
});

describe('buildProvODocument', () => {
  it('declara prefixos prov, xsd e namespace ex', () => {
    const turtle = buildProvODocument([committeeRecord]);
    expect(turtle).toContain('@prefix prov: <http://www.w3.org/ns/prov#>' );
    expect(turtle).toContain('@prefix xsd: <http://www.w3.org/2001/XMLSchema#>' );
    expect(turtle).toContain('@prefix ex: <https://vibe-trading.example.org/>');
  });

  it('serializa decisão do comitê como prov:Activity com outcome e confiança', () => {
    const turtle = buildProvODocument([committeeRecord]);
    expect(turtle).toContain('ex:dec-abc-1 a prov:Activity');
    expect(turtle).toContain('ex:dec-abc-1-outcome a prov:Entity');
    expect(turtle).toContain('prov:value "COMPRAR"');
    expect(turtle).toContain('ex:dec-abc-1-confidence a prov:Entity');
    expect(turtle).toContain('"0.880"^^xsd:decimal');
    expect(turtle).toContain('ex:agent-gemini a prov:Agent');
  });

  it('liga ensaio MiroFish ao comitê via prov:wasInfluencedBy', () => {
    const turtle = buildProvODocument([committeeRecord, mirofishRecord]);
    expect(turtle).toContain('ex:mirofish-BTC-12345-1720000001000 a prov:Activity');
    expect(turtle).toContain('prov:wasInfluencedBy ex:dec-abc-1');
    expect(turtle).toContain('ex:agent-mirofish a prov:Agent');
    // coortes viram entidades próprias, não assets
    expect(turtle).toContain('ex:cohort-momentum');
    expect(turtle).not.toContain('ex:asset-cohort-momentum');
  });

  it('serializa diário e liga à decisão de referência', () => {
    const turtle = buildProvODocument([committeeRecord, journalRecord]);
    expect(turtle).toContain('ex:journal-op-1 a prov:Activity');
    expect(turtle).toContain('prov:wasInfluencedBy ex:dec-abc-1');
    expect(turtle).toContain('"FECHADA: LUCRO"');
  });

  it('includeMirofish=false exclui ensaios da simulação', () => {
    const turtle = buildProvODocument([committeeRecord, mirofishRecord], { includeMirofish: false });
    expect(turtle).not.toContain('ex:mirofish-BTC-12345-1720000001000 a prov:Activity');
    expect(turtle).toContain('ex:dec-abc-1 a prov:Activity');
  });

  it('usa namespace personalizada quando informada', () => {
    const turtle = buildProvODocument([committeeRecord], { namespace: 'https://exemplo.com.br/grafo/' });
    expect(turtle).toContain('@prefix ex: <https://exemplo.com.br/grafo/>');
    expect(turtle).toContain('ex:dec-abc-1 a prov:Activity');
  });

  it('gera Turtle estruturalmente válido (linhas de declaração terminam em ".")', () => {
    const turtle = buildProvODocument([committeeRecord, mirofishRecord, journalRecord]);
    const bodyLines = turtle.split('\n').filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
    // linhas de prefixo terminam em " ."; declarações de agente terminam em " ."
    const statements = bodyLines.filter((l) => l.trim().endsWith('.'));
    expect(statements.length).toBeGreaterThanOrEqual(3);
  });
});
