# Plano: MiroFish — Simulação de Apoio ao Comitê (Replay Determinístico)

## Objetivo
Camada de **simulação de apoio** para o comitê de 6 agentes: um replay determinístico por ativo (worlds), que **nunca decide e nunca sobrescreve** — apenas pesa a confiança exibida, emite um veredito APROVADA/REJEITADA/NEUTRO com veto visual e registra auditoria (PROV-O + grafo Semantica). Decisão final continua sempre do comitê.

## Regras de ouro (não negociação)
1. **MiroFish nunca decide**: COMPRAR/VENDER/AGUARDAR é sempre do comitê.
2. **MiroFish nunca sobrescreve**: só ajusta a confiança **exibida** em `0.7 comitê + 0.3 simulação`.
3. **Veto é visual**: REJEITADA bloqueia os botões de execução ("Entrei no Trade" e registro no diário); a decisão do comitê permanece intacta no payload.
4. **Auditável**: ensaio gravado no grafo (`category: mirofish_world`) ligado à decisão do comitê via `INFLUENCED` (comitê é a origem), e exportável em **W3C PROV-O (Turtle)**.

## Arquitetura
```
[Frontend React]
   ├─ 3º modo no Consenso: "Simulação MiroFish"  → GET /api/mirofish/replay?symbol=&seed=&price=&change24h=
   ├─ card "Revisão MiroFish" (badge, blend 0.7/0.3, veto visual)   ← swarmResult.mirofishReview
   └─ aba Knowledge: botão "Export PROV-O (.ttl)"                  → src/lib/provoExport.ts
[Express /apiApp]
   ├─ GET /api/mirofish/status | /worlds | /scenarios | /replay
   ├─ /api/swarm/analyze → recordDecision → recordMirofishDecision (INFLUENCED)
   └─ /api/swarm/stream (SSE) → evento mirofish_simulation antes do final_consensus
[mirofishService.ts] worlds em mirofish/worlds/*.json (dev, dist e Netlify)
[Semantica sidecar]  POST /decision (mirofish_world) + POST /relationship (INFLUENCED)
```

## Implementação
### Backend
- `scripts/generate-mirofish-worlds.ts` + `npm run mirofish:generate`: gera 9 worlds (BTC, ETH, SOL, SUI, NEAR, PEPE, XRP, BNB, DOGE) + `_default.json`.
- `scripts/copy-worlds.mjs`: copia `mirofish/worlds` → `dist/mirofish/worlds` no build (resolve em dev, bundle e Netlify).
- `src/server/mirofishService.ts`: `loadWorld` (cache + fallback _default), `listWorlds`, `getStatus`, PRNG `mulberry32` + `hashString`, `runReplay` (7 cenários, 6 coortes, consenso ponderado, 3 stress tests), `computeDirection`, `blendConfidence`, `computeReview`, `summarizeForPrompt`.
- `src/server/geminiService.ts`: injeta seção "MIROFISH REVIEW" no prompt (apoio; comitê decide) e `finalizeWithMirofish` aplica review + confiança blendada (gemini e fallback).
- `src/server/semanticaClient.ts`: `recordMirofishDecision` (POST /decision + INFLUENCED) com `committee_decision_id` no metadata.
- `src/lib/swarmValidator.ts`: preserva `mirofishReview` (sanitização defensiva) e aplica `blendedConfidence` na confiança exibida.
- `src/server/apiApp.ts`: rotas `/api/mirofish/*` + integração em analyze e stream.

### Frontend
- `src/components/SwarmMeetingRoom.tsx`: 3º modo "Simulação MiroFish" (seed, change24h, replay via `/api/mirofish/replay`, cenários/coortes/stress), evento SSE `mirofish_simulation`, card "Revisão MiroFish" com badge e **veto visual** nos botões de execução.
- `src/components/KnowledgeGraphPanel.tsx`: botão "Export PROV-O (.ttl)".
- `src/lib/provoExport.ts`: `buildProvODocument` + `downloadProvODocument` (Turtle, `prov:wasInfluencedBy`).

## Testes
- `src/server/mirofishService.test.ts`: determinismo (mesma seed → mesmo resultado), seed padrão = hash, worlds/fallback, `blendConfidence`, `computeReview` APROVADA/REJEITADA/NEUTRO, stress nas razões.
- `src/lib/provoExport.test.ts`: escaping Turtle, estrutura PROV-O, `prov:wasInfluencedBy` mirofish↔comitê, `includeMirofish=false`.
- Suíte total: **75 testes** (Vitest). Validação: `npm run lint`, `npm test`, `npm run build`.

## Deploy
- `npm run build` já copia os worlds para `dist/mirofish/worlds` (Netlify Functions lê via candidatos de `__dirname`).
- Nenhuma env nova: MiroFish habilita sozinho quando `mirofish/worlds/` existe.
- Verificar após deploy: `GET /api/mirofish/status` → `enabled: true`, e `final_consensus` contém `mirofishReview`.
