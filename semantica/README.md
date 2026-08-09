# Semantica Bridge (sidecar)

Bridge FastAPI que expõe o grafo de conhecimento **Semantica** (leitura + escrita)
para o backend Node/Netlify via REST. Usa apenas o `ContextGraph` do pacote
(`--no-deps`), evitando torch/transformers/spacy no free tier.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/health` | Status, `node_count`, `decision_count` |
| GET  | `/stats` | Nós, arestas, decisões, categorias, outcomes |
| POST | `/decision` | Grava `{category, scenario, reasoning, outcome, confidence, entities?, decision_maker?, metadata?}` → `{decision_id}` |
| POST | `/entity` | Adiciona nó `{id, label, node_type, metadata?}` |
| POST | `/relationship` | Adiciona aresta `{source_id, target_id, rel_type, metadata?}` |
| GET  | `/decisions?category=&symbol=&limit=` | Lista decisões |
| GET  | `/decisions/{id}` | Detalhe de uma decisão |
| GET  | `/decisions/{id}/precedents?limit=` | Precedentes similares (score) |
| GET  | `/decisions/{id}/chain?direction=&max_depth=` | Cadeia causal |
| GET  | `/precedents?scenario=&category=&limit=` | Busca de precedentes por cenário |

## Persistência

- **`DATABASE_URL` (recomendado):** tabela `semantica_decisions` (JSONB). No boot o
  bridge faz *replay* das decisões para o grafo → a memória sobrevive ao cold start
  do Render free (~50s de inatividade).
- **`SEMANTICA_KG_PATH`:** snapshot JSON best-effort dos nós/arestas (decisões ficam
  no Postgres ou apenas em memória).
- Sem Postgres: funciona em memória (perde dados no restart — documentado).

## Rodar local (sem Docker)

```bash
python -m venv .venv
.venv\Scripts\pip install --no-deps semantica==0.6.0 fastapi uvicorn "psycopg[binary]"
.venv\Scripts\python bridge.py            # ou: uvicorn bridge:app --port 8001
curl http://localhost:8001/health
```

## Rodar local (Docker)

```bash
docker compose up -d
curl http://localhost:8001/health
```

## Deploy no Render (free)

1. Crie um novo **Web Service** apontando para o repo (raiz do Dockerfile:
   `semantica/`).
2. Runtime: Docker; plano `free`.
3. Variáveis de ambiente: `DATABASE_URL` (opcional, secreta) e
   `SEMANTICA_KG_PATH=/app/kg.json`.
4. Health check: `GET /health`.
5. No painel do **Netlify**, defina:
   - `SEMANTICA_BASE_URL=https://<name>.onrender.com`
   - `SEMANTICA_ENABLED=true`
   - `SEMANTICA_PRECEDENT_INJECTION=false` (default)

O app Netlify segue 100% funcional se o sidecar cair (degradação graciosa).
