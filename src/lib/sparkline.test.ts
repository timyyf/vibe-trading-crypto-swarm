import { describe, it, expect } from 'vitest';
import { buildSparklineGeometry } from './sparkline';

describe('buildSparklineGeometry', () => {
  it('retorna geometry vazia para lista vazia', () => {
    const geo = buildSparklineGeometry([]);
    expect(geo.points).toBe('');
    expect(geo.trendUp).toBe(true);
  });

  it('detecta tendência de alta quando o último fechamento >= primeiro', () => {
    const geo = buildSparklineGeometry([100, 101, 102, 103]);
    expect(geo.trendUp).toBe(true);
  });

  it('detecta tendência de baixa quando o último fechamento < primeiro', () => {
    const geo = buildSparklineGeometry([103, 102, 101, 100]);
    expect(geo.trendUp).toBe(false);
  });

  it('normaliza a série para dentro dos limites do viewport com padding', () => {
    const geo = buildSparklineGeometry([10, 20], 64, 28, 2);
    const [first, last] = geo.points.split(' ').map((c) => c.split(','));
    const x1 = parseFloat(first[0]);
    const y1 = parseFloat(first[1]);
    const x2 = parseFloat(last[0]);
    const y2 = parseFloat(last[1]);
    // min (10) embaixo (y=height-pad), max (20) no topo (y=pad) — y cresce para baixo no SVG
    expect(y1).toBe(26);
    expect(y2).toBe(2);
    expect(x1).toBe(2);
    expect(x2).toBe(62);
  });

  it('lida com série plana (range = 0) sem dividir por zero', () => {
    const geo = buildSparklineGeometry([50, 50, 50]);
    expect(geo.points.split(' ')).toHaveLength(3);
    expect(geo.trendUp).toBe(true);
  });
});
