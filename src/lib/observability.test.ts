import { describe, it, expect } from 'vitest';
import { computePercentile, buildDiagnostics, ApiRequestLogEntry } from './observability';

const makeLog = (path: string, durationMs: number, status = 200, ts = 1_000_000): ApiRequestLogEntry => ({
  method: 'GET',
  path,
  status,
  durationMs,
  timestamp: ts,
});

describe('computePercentile', () => {
  it('retorna 0 para lista vazia', () => {
    expect(computePercentile([], 50)).toBe(0);
  });

  it('calcula p50 e p95 corretamente', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(computePercentile(sorted, 50)).toBe(50);
    expect(computePercentile(sorted, 95)).toBe(100);
  });
});

describe('buildDiagnostics', () => {
  const now = 1_000_000 + 60_000;

  it('filtra pela janela de tempo', () => {
    const logs = [
      makeLog('/api/health', 5, 200, now - 1000),
      makeLog('/api/health', 5, 200, now - 20 * 60 * 1000),
    ];
    const diag = buildDiagnostics(logs, now, 15 * 60 * 1000, now - 10 * 60 * 1000);
    expect(diag.totalRequests).toBe(1);
    expect(diag.uptimeSec).toBe(600);
  });

  it('agrega métricas de latência e breakdown por rota', () => {
    const logs = [
      makeLog('/api/health', 10, 200, now - 1000),
      makeLog('/api/health', 30, 200, now - 2000),
      makeLog('/api/swarm/analyze', 500, 200, now - 3000),
      makeLog('/api/swarm/analyze', 900, 429, now - 4000),
    ];
    const diag = buildDiagnostics(logs, now, 15 * 60 * 1000, now);

    expect(diag.totalRequests).toBe(4);
    expect(diag.latencyMs.avg).toBe(360);

    const healthRoute = diag.routes.find((r) => r.route === '/api/health');
    expect(healthRoute).toBeDefined();
    expect(healthRoute!.count).toBe(2);
    expect(healthRoute!.avgMs).toBe(20);

    const swarmRoute = diag.routes.find((r) => r.route === '/api/swarm/analyze');
    expect(swarmRoute!.statuses[200]).toBe(1);
    expect(swarmRoute!.statuses[429]).toBe(1);
  });
});
