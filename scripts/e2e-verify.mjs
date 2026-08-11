// Verificação ponta-a-ponta em comando único.
// Uso: node scripts/e2e-verify.mjs
// 1. Aguarda o servidor no ar (GET /api/health, bounded ~30s)
// 2. Faz um POST /api/swarm/analyze com dados de exemplo
// 3. Imprime engineSource, nº de agentes, provedores, tempos e encerra com exit code
import { argv } from 'node:process';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SYMBOL = argv[2] || 'BTC';
const TIMEOUT_MS = 45000;

function fail(msg) {
  console.error(`[e2e-verify] FALHOU: ${msg}`);
  process.exit(1);
}

async function waitForHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch { /* servidor ainda subindo */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail('servidor não respondeu /api/health em 30s');
}

async function runAnalyze() {
  const body = {
    symbol: SYMBOL,
    name: SYMBOL === 'BTC' ? 'Bitcoin' : SYMBOL,
    price: 67000,
    change24h: 2.35,
    volume24h: 28500000000,
    high24h: 68100,
    low24h: 65200,
    signalDurationMinutes: 5,
  };

  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/swarm/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - t0;
    const json = await res.json();
    if (!res.ok) fail(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);

    const data = json?.data ?? json;
    const agents = Array.isArray(data?.agents) ? data.agents : [];
    const byProvider = {};
    const byStatus = {};
    for (const a of agents) {
      byProvider[a.provider || '?'] = (byProvider[a.provider || '?'] || 0) + 1;
      byStatus[a.status || '?'] = (byStatus[a.status || '?'] || 0) + 1;
    }

    console.log('=== RESULTADO DO SWARM ===');
    console.log(`symbol          : ${data?.symbol ?? SYMBOL}`);
    console.log(`engineSource    : ${data?.engineSource}`);
    console.log(`tempo total     : ${elapsedMs}ms`);
    console.log(`agentes         : ${agents.length}`);
    console.log(`por provedor    : ${JSON.stringify(byProvider)}`);
    console.log(`por status      : ${JSON.stringify(byStatus)}`);
    console.log(`decisão final   : ${data?.finalDecision}`);
    console.log(`confiança       : ${data?.confidenceScore}`);
    const degraded = agents.filter((a) => a.status === 'DEGRADADO');
    if (degraded.length) {
      console.log('--- agentes degradados ---');
      for (const d of degraded) {
        console.log(`  ${d.agentName} (${d.provider}): ${d.reason || d.status}`);
      }
    }
    console.log('===========================');

    if (!agents.length) fail('resposta sem agentes');
    if (!data?.engineSource) fail('resposta sem engineSource');
    console.log('[e2e-verify] OK');
  } catch (err) {
    if (err?.name === 'AbortError') fail(`timeout após ${TIMEOUT_MS}ms`);
    fail(err?.message || String(err));
  } finally {
    clearTimeout(timer);
  }
}

await waitForHealth();
await runAnalyze();
