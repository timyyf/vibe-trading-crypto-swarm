# Plano: Semantica em Netlify (sidecar no Render free) + Fixes de Latência A+B+C

## Objetivo
Memória persistente e auto-suficiência dos agentes via grafo de conhecimento **Semantica**, com o app no **Netlify** (sem mudanças estruturais) consumindo um sidecar Python publicado no **Render (free tier)**. Aplicar também os fixes de latência aprovados.

## Arquitetura (corrigida)
```
[Netlify Functions - Node/Express]  (roda normal, só JS/TS/Go)
      │  SEMANTICA_BASE_URL = https://<name>.onrender.com
      │  SEMANTICA_ENABLED  = true | false   (degrada gracioso)
      ▼  (HTTPS fetch, server-side — sem CORS envolvido)
[Render free — bridge FastAPI :8001]  ← único serviço
      │  from semantica.context import ContextGraph
      ├─ leitura: /decisions, /decisions/{id}/precedents, /decisions/{id}/chain, /stats, /health
      ├─ escrita: /decision, /entity, /relationship
      └─ persistência: save_to_file/load_from_file (JSON) + replay opcional via Postgres
```
- **Netlify Functions só executa JavaScript/TypeScript e Go.** Docker/Python não rodam no Netlify.
- O `docker-compose` NÃO é para o Netlify — é opcional para dev local (equivalente ao Render).
- No Render, o bridge é o **único** serviço: o módulo `ContextGraph` cobre leitura+escrita de decisões/precedentes/cadeia (stdlib-only), eliminando o servidor oficial `:8000` com extras pesados.

## Por que só ContextGraph (sem o servidor oficial)?
- `pyproject.toml` do Semantica: deps core incluem `torch, transformers, spacy, faiss, sentence-transformers` — **pesadas**, ruim para free tier.
- `ContextGraph.record_decision / find_precedents / find_precedents_by_scenario / get_causal_chain / get_decision_insights / save_to_file / load_from_file` usam **apenas stdlib + utils** do pacote.
- `pip install semantica --no-deps` → imagem enxuta. `advanced_analytics=False` (recursos ML exigem numpy/sklearn, ficam para depois).

---

## Fase 1 — Bridge (novo `semantica/`)

### 1.1 `semantica/bridge.py` (FastAPI, porta 8001)
- Importa `ContextGraph` (lazy, stdlib-only). Singleton com lock.
- Startup: `SEMANTICA_KG_PATH` → `load_from_file` se existir; depois replay opcional do Postgres (abaixo).
- Pós-escrita: `save_to_file` (best-effort; disco do Render é efêmero) e insert no Postgres se `DATABASE_URL` configurado.
- Endpoints (Pydantic):
  - `POST /decision` `{category, scenario, reasoning, outcome, confidence(0..1), entities?, decision_maker?, metadata?}` → `{decision_id}`
  - `POST /entity` `{id, label, node_type, metadata?}` → `{status, id}`
  - `POST /relationship` `{source_id, target_id, rel_type, metadata?}` → `{status}`
  - `GET /decisions?category=&limit=` → lista
  - `GET /decisions/{id}/precedents?limit=` → `find_precedents`
  - `GET /decisions/{id}/chain` → `get_causal_chain`
  - `GET /stats` → `{node_count, decision_count, categories}` (via `find_nodes`/`get_decision_insights`)
  - `GET /health` → `{status, node_count, decision_count}`
- **Persistência (resolver efemeridade do Render free):**
  - Se `DATABASE_URL` (Supabase/Neon free Postgres) presente: tabela `semantica_decisions` (JSONB de decisões + entities/edges). Replay no boot reconstrói o grafo → memória sobrevive a cold start (~50s inatividade).
  - Sem `DATABASE_URL`: funciona só em memória/disco efêmero (documentado).
- CORS: não necessário (chamada server-side), manter desligado.

### 1.2 `semantica/requirements.txt`
```
semantica==0.6.0
fastapi
uvicorn
psycopg[binary]   # só se DATABASE_URL for usar
```
Dockerfile usa `pip install --no-deps semantica` + `pip install fastapi uvicorn psycopg[binary]` para não puxar torch/transformers.

### 1.3 `semantica/Dockerfile` + `semantica/render.yaml`
- Imagem `python:3.12-slim`; copia `bridge.py` e `requirements.txt`; `CMD uvicorn bridge:app --host 0.0.0.0 --port $PORT` (Render injeta `PORT`).
- `render.yaml`: `type: web`, plano `free`, healthCheckPath `/health`, env `DATABASE_URL` (secret, opcional).
- `semantica/docker-compose.yml` (dev local, mesmo bridge) + `semantica/README.md` com passo-a-passo de deploy no Render.

---

## Fase 2 — Cliente Node + Rotas API

### 2.1 `src/server/semanticaClient.ts` (novo)
- `SEMANTICA_ENABLED` + `SEMANTICA_BASE_URL`. `isSemanticaEnabled()`.
- `withTimeout(fn, 3000)` — cold start do Render pode levar ~50s no 1º request; usar timeout de conexão generoso no 1º hit, cache de URL/health.
- Métodos (retornam `null`/`{ok:false}` se off/unreachable): `checkHealth()`, `recordDecision(analysis)` (monta category `trade_decision`, scenario com símbolo/preço/regime, reasoning = reasoningNotes, outcome = finalDecision, confidence = confidenceScore/100, entities = [symbol, ...agentIds], decision_maker = engineSource, metadata = entry/stop/tp/votes), `getPrecedents(symbol)`, `getDecisionChain(id)`, `listDecisions()`, `getGraphStats()`.
- Cache em memória (stats 60s).

### 2.2 Rotas em `src/server/apiApp.ts`
- `GET /api/knowledge/status` → `{enabled, health?}`
- `GET /api/knowledge/decisions?symbol=&limit=`
- `GET /api/knowledge/precedents?symbol=`
- `GET /api/knowledge/provenance?id=` (cadeia causal + decisão)
- `GET /api/knowledge/stats`
- Sempre `{success, data}` ou `{success:false, disabled:true}`; nunca `throw` para o cliente.

### 2.3 Gravação automática pós-análise
- `/api/swarm/analyze` e `/api/swarm/stream`: `void recordDecision(sanitized).catch(...)` — fire-and-forget, não adiciona latência. Incluir `semanticaDecisionId` no response quando gravado.

### 2.4 Injeção de precedentes no prompt (flag `SEMANTICA_PRECEDENT_INJECTION=true`, default off)
- Buscar precedentes antes do `analyzeCryptoWithSwarm` e incluir 1-3 casos no prompt (seção "Casos anteriores similares").

---

## Fase 3 — Frontend: aba "Knowledge Graph"

### 3.1 `src/components/KnowledgeGraphPanel.tsx` (novo)
- Pill de status (`Semantica KG: ATIVO/indisponível`), botão refresh.
- Cards de stats (nós, decisões, categorias).
- Tabela de histórico de decisões (padrão `Top100Table`/`TradeJournal`).
- Detalhe por decisão: precedentes (lista com score), cadeia causal (hops), proveniência em SVG simples.
- Estados loading/erro/disabled consistentes.

### 3.2 Wiring em `src/App.tsx` e `src/components/Header.tsx`
- Novo `activeTab 'knowledge'`, botão de aba, render condicional.

---

## Fase 4 — Fixes de latência (A+B+C) — `fix-latency.md`

Aplicar o plano já aprovado: health cache 25s + sondas paralelas deadline 1.5s + `fetchRealDepth` exportado; CoinGecko background timeout 2.5s cache 5min; `Promise.all` no `fallbackSwarmAnalysis` (klines/sentiment/depth/whale) → swarm ~1.3s.

---

## Config para Netlify (passo final)
- `netlify.toml` já aponta para `netlify/functions/api.ts` (sem mudança).
- Env vars no painel Netlify: `SEMANTICA_BASE_URL=https://<name>.onrender.com`, `SEMANTICA_ENABLED=true`, `SEMANTICA_PRECEDENT_INJECTION=false` (default).
- Se o sidecar cair, app segue 100% funcional (degradação graciosa). Frontend também pode consultar o status via `/api/knowledge/status`.

## Validação
1. `npm run lint` limpo.
2. Local: `docker compose up -d` em `semantica/`; `curl localhost:8001/health`; POST `/decision`; conferir `/decisions`, `/stats`.
3. Render: deploy via repo (Dockerfile); `curl https://<name>.onrender.com/health`; testar cold start (2º request rápido).
4. Netlify: setar envs; `/api/knowledge/status` → enabled; `/api/swarm/analyze` grava decisão (fire-and-forget).
5. `SEMANTICA_ENABLED=false` → tudo intacto.
6. Latência re-medida: health ~30ms/cache, top ~330ms, swarm ~1.3s.

## Arquivos
- **Novos**: `semantica/bridge.py`, `semantica/requirements.txt`, `semantica/Dockerfile`, `semantica/render.yaml`, `semantica/docker-compose.yml`, `semantica/README.md`, `src/server/semanticaClient.ts`, `src/components/KnowledgeGraphPanel.tsx`.
- **Editados**: `src/server/apiApp.ts`, `src/server/cryptoDataService.ts`, `src/server/geminiService.ts`, `src/server/orderbookEngine.ts`, `src/App.tsx`, `src/components/Header.tsx`, `src/types.ts`, `README.md` (seção Semantica + deploy Render/Netlify), `.env.example`.
- **Diagnóstico**: novo `AgentComponentId 'semantica_kg'` e sonda em `buildRealDiagnostics` (latência real do sidecar).
