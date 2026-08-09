# Plano: Corrigir lentidão da análise (A + B + C)

## Contexto (medido)
| Endpoint | Antes | Agora | Frequência |
|---|---|---|---|
| `/api/health` | ~30ms | ~5.7s | a cada 15s (App.tsx:53) |
| `/api/crypto/top` | ~350ms | ~684ms (até 5s) | a cada 3s (App.tsx:102) |
| `/api/swarm/analyze` | ~5s | ~5.1s | sob demanda |

Causas:
1. `/api/health` roda o stack inteiro (Binance + CoinGecko + klines + sentiment + depth + DBA) em cada poll de 15s.
2. `/api/crypto/top` espera CoinGecko (timeout 5s) a cada 3s.
3. `/api/swarm/analyze` busca klines -> sentiment -> orderbook -> whale em SÉRIE no `fallbackSwarmAnalysis`.

## Mudanças

### A. `/api/health` rápido de verdade — `src/server/apiApp.ts`
- Cache dos diagnósticos por 25s (retorno ~30ms nos polls seguintes; atualiza `lastChecked`).
- Sondas externas (top100, klines, sentiment, depth, whale, gemini) rodam em PARALELO, cada uma limitada a deadline global de 1.5s via `Promise.race`. Se estourar -> `DEGRADED`/`DISCONNECTED` e responde mesmo assim.
- Engines locais (technical/alpha/risk) rodam após as sondas, com tempo de execução real medido.
- `buildRealDiagnostics` passa a usar `fetchRealDepth` exportado (sonda de profundidade) em vez de rodar o engine de orderbook completo.

### B. MarketCap CoinGecko não-bloqueante — `src/server/cryptoDataService.ts`
- Timeout do CoinGecko reduzido de 5000ms para 2500ms.
- Busca do market cap em BACKGROUND (fire-and-forget, não-await): a lista Binance responde imediatamente com marketCap aproximado e enriquece com caps reais SÓ do cache.
- `getRealMarketCapMap` mantém cache de 5min; `enrichAssetsWithRealMarketCap` passa a ler apenas o cache.

### C. Swarm paralelo — `src/server/geminiService.ts` + `src/server/orderbookEngine.ts`
- `orderbookEngine.ts`: exportar `RealDepth` e `fetchRealDepth`; adicionar parâmetro opcional `depthOverride` em `runOrderBookSentinelEngine` (para não refazer o fetch).
- `geminiService.ts` (`fallbackSwarmAnalysis`): buscar em paralelo via `Promise.all`:
  - `getCryptoKlines(...).catch(() => [])`
  - `runSofiaSentimentEngine(...)`
  - `fetchRealDepth(symbol)`
  - `getWhaleOverview()`
  - Depois rodar os 6 engines (compute rápido).
- Resultado esperado: swarm de ~5.1s -> ~1.3s.

## Validação
- `npm run lint` (tsc --noEmit) sem erros.
- Subir servidor e medir de novo: health (~30ms cache / <=1.5s fill), top (~330ms), swarm (~1.3s).
- Confirmar que `engineSource`, marketCap real (via cache) e diagnóstico de latência continuam íntegros.
