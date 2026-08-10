// Export W3C PROV-O (Turtle) do Knowledge Graph Semantica.
// Serializa decisões do comitê, ensaios MiroFish e diário como atividades
// de proveniência (prov:Activity / prov:Entity / prov:Agent) com a cadeia
// causal INFLUENCED entre simulação e comitê.

export interface ProvDecision {
  decision_id: string;
  category: string;
  scenario: string;
  reasoning: string;
  outcome: string;
  confidence: number;
  entities: string[];
  decision_maker: string;
  timestamp: number;
  recorded_at: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

export interface ProvExportOptions {
  namespace?: string;
  includeMirofish?: boolean;
}

const DEFAULT_NAMESPACE = 'https://vibe-trading.example.org/';

// Escapa strings Turtle (literais "..." com escaping de \ e ")
export function escapeTurtle(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

// Converte um id arbitrário em um nome local Turtle seguro (ex: ns:dec-btc-1)
function localId(raw: string): string {
  const safe = String(raw)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'decision';
}

// IRI com prefixo (ex:...) — Turtle compacto com a namespace declarada no topo
function iri(local: string): string {
  return `ex:${local}`;
}

function tsLiteral(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return `"${new Date().toISOString()}"^^xsd:dateTime`;
  return `"${new Date(ts).toISOString()}"^^xsd:dateTime`;
}

function confidenceLiteral(conf: number): string {
  const c = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0;
  return `"${c.toFixed(3)}"^^xsd:decimal`;
}

function agentIri(maker: string): string {
  const name = maker === 'mirofish' ? 'mirofish' : localId(maker);
  return iri(`agent-${name}`);
}

/**
 * Constrói um documento PROV-O em Turtle a partir dos registros do grafo.
 * - trade_decision  → prov:Activity do comitê (+ outcome como prov:Entity gerado).
 * - mirofish_world  → prov:Activity de ensaio com prov:wasInfluencedBy do comitê.
 * - trade_journal   → prov:Activity de execução com prov:wasInfluencedBy da decisão.
 */
export function buildProvODocument(records: ProvDecision[], options: ProvExportOptions = {}): string {
  const ns = options.namespace ?? DEFAULT_NAMESPACE;
  const includeMirofish = options.includeMirofish !== false;

  const lines: string[] = [];
  lines.push('# Exported from Vibe Trading — Swarm Committee Knowledge Graph (W3C PROV-O)');
  lines.push(`# Exported at: ${new Date().toISOString()}`);
  lines.push(`# ${records.length} records`);
  lines.push('');
  lines.push('@prefix prov: <http://www.w3.org/ns/prov#> .');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
  lines.push(`@prefix ex: <${ns}> .`);
  lines.push('');

  const filtered = records.filter((r) => includeMirofish || r.category !== 'mirofish_world');

  for (const r of filtered) {
    const id = localId(r.decision_id);
    const isMirofish = r.category === 'mirofish_world';
    const isJournal = r.category === 'trade_journal';

    // Atividade principal
    const activity = [
      `${iri(id)} a prov:Activity`,
      `prov:endedAtTime ${tsLiteral(r.timestamp)}`,
      `prov:wasAssociatedWith ${agentIri(r.decision_maker)}`,
      `prov:label "${escapeTurtle(r.scenario)}"`,
      `prov:description "${escapeTurtle(r.reasoning)}"`,
    ];

    // Entidades envolvidas (ativos, coortes, agentes do comitê)
    for (const ent of r.entities ?? []) {
      if (isMirofish && ent.startsWith('cohort:')) {
        activity.push(`prov:used ${iri(`cohort-${localId(ent.replace(/^cohort:/, ''))}`)}`);
      } else {
        activity.push(`prov:used ${iri(`asset-${localId(ent)}`)}`);
      }
    }

    // Influências causais: mirofish ← comitê; journal ← decisão
    if (isMirofish) {
      const committeeId = (r.metadata?.committee_decision_id as string) || '';
      if (committeeId) activity.push(`prov:wasInfluencedBy ${iri(localId(committeeId))}`);
    } else if (isJournal) {
      const refDecision = (r.metadata?.ref_decision_id as string) || (r.metadata?.decision_id as string) || '';
      if (refDecision) activity.push(`prov:wasInfluencedBy ${iri(localId(refDecision))}`);
    }

    lines.push(`${iri(id)} ${activity.join(' ;\n    ')} .`);
    lines.push('');

    // Outcome como entidade gerada pela atividade
    lines.push(`${iri(`${id}-outcome`)} a prov:Entity ;`);
    lines.push(`    prov:value "${escapeTurtle(r.outcome)}" ;`);
    lines.push(`    prov:wasGeneratedBy ${iri(id)} .`);
    lines.push('');

    // Confiança como atributo (prov:Entity com atribuição à atividade)
    lines.push(`${iri(`${id}-confidence`)} a prov:Entity ;`);
    lines.push(`    prov:value ${confidenceLiteral(r.confidence)} ;`);
    lines.push(`    prov:wasGeneratedBy ${iri(id)} .`);
    lines.push('');

    // Revisão MiroFish: declara o veredito como prov:Entity ligado à simulação
    if (isMirofish) {
      const verdict = r.outcome || 'NEUTRO';
      const seed = r.metadata?.seed;
      lines.push(`${iri(`${id}-verdict`)} a prov:Entity ;`);
      lines.push(`    prov:value "${escapeTurtle(verdict)}" ;`);
      if (seed !== undefined) lines.push(`    prov:atLocation "${escapeTurtle(String(seed))}" ;`);
      lines.push(`    prov:wasGeneratedBy ${iri(id)} .`);
      lines.push('');
    }
  }

  // Agentes declarados uma única vez
  const makers = [...new Set(filtered.map((r) => r.decision_maker))];
  for (const maker of makers) {
    lines.push(`${agentIri(maker)} a prov:Agent ;`);
    lines.push(`    prov:label "${escapeTurtle(maker)}" .`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Dispara o download do documento Turtle no navegador.
 */
export function downloadProvODocument(
  filename: string,
  records: ProvDecision[],
  options: ProvExportOptions = {}
): void {
  const turtle = buildProvODocument(records, options);
  const blob = new Blob([turtle], { type: 'text/turtle;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
