export interface SparklineGeometry {
  points: string;
  trendUp: boolean;
}

// Normaliza uma série de preços para coordenadas de um polyline SVG (w x h, com padding).
export function buildSparklineGeometry(
  prices: number[],
  width = 64,
  height = 28,
  pad = 2
): SparklineGeometry {
  if (!prices || prices.length === 0) {
    return { points: '', trendUp: true };
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = prices.length > 1 ? (width - pad * 2) / (prices.length - 1) : 0;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = prices.map((p, i) => {
    const x = prices.length > 1 ? pad + i * stepX : width / 2;
    const y = pad + innerH * (1 - (p - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return {
    points: coords.join(' '),
    trendUp: prices[prices.length - 1] >= prices[0],
  };
}
