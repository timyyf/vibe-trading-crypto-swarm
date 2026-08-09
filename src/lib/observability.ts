export interface ApiRequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: number;
}

export interface RouteStats {
  route: string;
  count: number;
  avgMs: number;
  statuses: Record<number, number>;
}

export interface DiagnosticsSummary {
  uptimeSec: number;
  windowMs: number;
  totalRequests: number;
  latencyMs: { p50: number; p95: number; avg: number };
  routes: RouteStats[];
}

// Percentil sobre um array já ordenado (ascendente).
export function computePercentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return Math.round(sortedAsc[idx]);
}

export function buildDiagnostics(
  logs: ApiRequestLogEntry[],
  now: number,
  windowMs: number,
  uptimeStartTime: number
): DiagnosticsSummary {
  const recent = logs.filter((e) => now - e.timestamp <= windowMs);
  const durations = recent.map((e) => e.durationMs).sort((a, b) => a - b);

  const byRoute = new Map<string, { count: number; totalMs: number; statuses: Record<number, number> }>();
  for (const e of recent) {
    const bucket = byRoute.get(e.path) || { count: 0, totalMs: 0, statuses: {} };
    bucket.count += 1;
    bucket.totalMs += e.durationMs;
    bucket.statuses[e.status] = (bucket.statuses[e.status] || 0) + 1;
    byRoute.set(e.path, bucket);
  }

  const routes: RouteStats[] = [...byRoute.entries()]
    .map(([route, b]) => ({
      route,
      count: b.count,
      avgMs: Math.round(b.totalMs / b.count),
      statuses: b.statuses,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    uptimeSec: Math.round((now - uptimeStartTime) / 1000),
    windowMs,
    totalRequests: recent.length,
    latencyMs: {
      p50: computePercentile(durations, 50),
      p95: computePercentile(durations, 95),
      avg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    },
    routes,
  };
}
