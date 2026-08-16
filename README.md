# Vibe Trading // Swarm AI 🚀

Plataforma institucional de análise quantitativa e inteligência financeira multi-agente alimentada por Groq + DeepSeek.

![Vibe Trading Swarm AI](https://img.shields.io/badge/Status-Active-emerald?style=for-the-badge) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) ![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)

---

## 📌 Visão Geral

O **Vibe Trading Swarm AI** é um sistema avançado de tomada de decisão para criptoativos baseado na colaboração em enxame (Swarm Multi-Agent Architecture). Diversos agentes especializados analisam indicadores técnicos, fluxo on-chain de baleias, fatores quantitativos, sentimento do mercado de notícias/redes sociais e tomam decisões de comitê em tempo real com transparência total.

---

## 🆕 Novidades & Atualizações Recentes

### 🐠 Simulação MiroFish — Replay Determinístico de Apoio ao Comitê
- **Worlds por ativo** (`mirofish/worlds/*.json`): 9 símbolos (BTC, ETH, SOL, SUI, NEAR, PEPE, XRP, BNB, DOGE) + `_default.json` de fallback, com fatos seed de proveniência, 6 coortes, 7 cenários e 3 testes de estresse.
- **Replay determinístico**: a mesma seed reproduz exatamente o mesmo resultado (seed padrão = hash do símbolo). Endpoints `GET /api/mirofish/status`, `/worlds`, `/scenarios` e `/replay`.
- **Nunca decide, nunca sobrescreve**: a decisão final (COMPRAR/VENDER/AGUARDAR) é sempre do comitê de 6 agentes. A simulação apenas (a) pesa a **confiança exibida** em `0.7 comitê + 0.3 simulação`, (b) emite o veredito **APROVADA / REJEITADA / NEUTRO** e (c) aplica **veto visual**: decisão REJEITADA bloqueia os botões de execução ("Entrei no Trade" e registro no diário) mantendo a decisão do comitê intacta.
- Integração no fluxo SSE (`/api/swarm/stream`): novo evento `mirofish_simulation` antes do `final_consensus`; o review também chega dentro do `data` do consenso.
- Auditoria no grafo Semantica: o ensaio é registrado (`category: mirofish_world`) e ligado à decisão do comitê via **INFLUENCED** (o comitê permanece a origem).
- Nova aba no Consenso do Comitê: **Simulação MiroFish** (3º modo) para executar replays com seed escolhida e inspecionar cenários, coortes e estresse.
- **Export PROV-O**: botão **Export PROV-O (.ttl)** na aba Knowledge serializa decisões do comitê, ensaios MiroFish e diário em **W3C PROV-O (Turtle)** com a cadeia causal (`prov:wasInfluencedBy`).

### 🧠 Memória de Longo Prazo — Semantica Knowledge Graph
- O comitê agora **grava cada decisão automaticamente** em um grafo de conhecimento (`Semantica`, sidecar no Render free) e consulta **precedentes históricos**, **provenance** (cadeia causal) e estatísticas na nova aba **Knowledge**.
- Degradação graciosa: sem o sidecar, o app continua 100% funcional.
- Opcional: `SEMANTICA_PRECEDENT_INJECTION=true` injeta 1–3 casos similares no prompt do comitê para decisões informadas pela memória.

### 🗳️ Voto Ponderado do Comitê (Fase 1)
- Agentes com status `DEGRADADO` passaram a **pesar 0.5** no consenso (em vez de 1.0).
- Quórum ajustado a **2/3 do peso total** e confiança final proporcional ao peso — um agente degradado não mais desvirtua a decisão.

### 📈 Tendência 5m com Sparkline no Top 100
- Nova coluna **Tendência (5m)** com mini-gráfico SVG para cada ativo (novo endpoint `/api/crypto/sparkline` com cache e concorrência controlada).

### 🔍 Observabilidade — `/api/diagnostics`
- Dashboard com **contagem de requisições, latência p50/p95 e breakdown por rota** em uma janela de 15 minutos.

### 🧪 Suíte de Testes Automatizados (Vitest)
- **75 testes unitários** cobrindo os motores quantitativos (técnico, risco, baleias, orderbook, sentimento, alpha), validação do swarm, utilitários (sparkline, observabilidade, voto ponderado, export PROV-O) e o serviço MiroFish (determinismo do replay, worlds, blend de confiança e veredito).

### 🛡️ Validação de API & Rate Limit
- **zod**: payloads inválidos do comitê retornam `400` com a lista de erros detalhada.
- **express-rate-limit** nos endpoints do comitê contra abuso.

### 📓 Diário de Trades com Estatísticas e Persistência
- Histórico salvo no **localStorage** do navegador (sobrevive a recarregamentos).
- Painel com **Win-rate, PnL total/médio**, trades fechados, abertos e `pnlPercent` por operação (calculado ao fechar — invertido corretamente para VENDA).

### 📲 PWA + Notificações de Sinal Forte
- **Instalável** (manifest + service worker com cache-first para estáticos e network-first para `/api`).
- **Notificação push** quando o comitê emite sinal forte (≠ NEUTRO com confiança ≥ 75%), com **re-check automático a cada 5 min** e toggle NOTIF ON/OFF no header.

### 💡 "Explicar Decisão" no Consenso
- Botão que revela o **resumo do consenso e os pontos de raciocínio** (reasoningNotes) do comitê passo a passo.

### 🚀 Otimização de Latência
- Health cache (25s), sondas paralelas com deadline (1.5s) e swarm em `Promise.all` — análise do comitê caiu de ~5s para **~1.3s** em fallback.

---

## 🤖 Agentes do Comitê Swarm-01

1. **Dr. Quant Graph** *(Análise Técnica & Gráficos)*:
   - Monitora médias móveis (EMA 20, SMA 50), RSI, padrões de candlestick e níveis chave de suporte e resistência.
2. **Sofia Sentiment** *(Sentimento & Mídia)*:
   - Processa fluxo de notícias de mercado, redes sociais e Fear & Greed Index em tempo real.
3. **Whale Tracker Apex** *(On-Chain & Fluxo de Carteiras)*:
   - Rastreia movimentações de grandes baleias (Exchange Inflows, Outflows e Net Flow) com alertas de alto impacto.
4. **Alpha Zoo Engine** *(Fatores Quantitativos & Backtesting)*:
   - Rastreia taxas de financiamento (Funding Rates), métricas de derivativos, volatilidade implícita e desvios de Bollinger.
5. **Consenso do Comitê (Swarm Committee)**:
   - Agrega e pondera o veredito individual de cada agente especializado para definir ações claras: **COMPRAR**, **VENDER** ou **AGUARDAR**, acompanhado de nível de confiança (%) e contagem regressiva para renovação do sinal.

---

## ⚡ Principais Funcionalidades

- 📊 **Gráfico Interativo de Preço & Indicadores**:
  - Feed em tempo real de Klines em múltiplos tempos gráficos (**5M**, **15M**, **1H**).
- 🐋 **Rastreio de Baleias (Whale Radar)**:
  - Visualização de Exchange Inflow, Outflow, Netflow e histórico recente de transações institucionais.
- 🔥 **Top 100 Criptoativos**:
  - Monitoramento dos principais criptoativos por variação 24h, volume e preço.
- 📓 **Diário de Trades (Trade Journal)**:
  - Registro de simulações e execuções para acompanhamento de performance.
- ⚙️ **Painel Diagnóstico & Debug Swarm**:
  - Testes de ping individual por agente e logs de execução com altíssima velocidade (< 200ms por veredito via Groq/DeepSeek + fallback determinístico).

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, Tailwind CSS, Lucide Icons, Recharts, Motion (Framer Motion).
- **Backend**: Node.js, Express, ESBuild, TypeScript (tsx).
- **IA Engine**: Comitê híbrido `Groq` (gpt-oss-120b/Llama) + `DeepSeek` em paralelo, com Gemini como fallback terciário. Clientes OpenAI-compatíveis via `fetch`.
- **Build System**: Vite 6, ESBuild.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ instalado.
- Chaves de API: `GROQ_API_KEY` (gratuita, console.groq.com) e `DEEPSEEK_API_KEY`. Gemini opcional (fallback terciário).

### Instalação

```bash
# Clone o repositório
git clone https://github.com/timyyf/vibe-trading-crypto-swarm.git
cd vibe-trading-crypto-swarm

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Adicione GROQ_API_KEY e DEEPSEEK_API_KEY no arquivo .env
```

### Executando em Desenvolvimento

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

---

## ☁️ Deploy no Netlify

O app é uma SPA + Express em **Netlify Functions** (`netlify.toml` + `netlify/functions/api.ts` via `serverless-http`). Basta conectar o repositório — build e publish já estão configurados.

### Passos no dashboard

1. **New site** → importar do GitHub (`timyyf/vibe-trading-crypto-swarm`).
   - Build command `npm run build` e publish `dist` já vêm do `netlify.toml`.
2. **Site configuration → Functions → Function timeout**: alterar para **26s**
   (o `/api/swarm/analyze` híbrido Groq+DeepSeek leva ~2-13s + cold start; sem chave
   o fallback local responde em ~1.3s).
3. **Environment variables**:
   | Variável | Obrigatória? | Descrição |
   |---|---|---|
   | `GROQ_API_KEY` | recomendada | Chave gratuita da Groq (console.groq.com). Cobre 3 especialistas no modo híbrido. |
   | `DEEPSEEK_API_KEY` | recomendada | Chave DeepSeek. Cobre os outros 3 especialistas no modo híbrido. |
   | `GEMINI_API_KEY` | opcional | Fallback terciário quando Groq/DeepSeek falham ou não estão configurados. |
   | `SEMANTICA_BASE_URL` | opcional | URL do sidecar Semantica no Render (ver seção acima). |
   | `SEMANTICA_ENABLED` | opcional | `true` para ativar o knowledge graph (default `true`). |
4. **Deploy**. Verificar depois:
   - `https://<site>.netlify.app/api/health` → `ONLINE`/`DEGRADED` com 10 agentes diagnosticados
   - `https://<site>.netlify.app/api/knowledge/status` → `{"enabled": false}` sem sidecar

### Observações
- `/api/swarm/test` roda o suite de validação completo (várias análises) — use apenas em desenvolvimento local.
- O bundle da function é validado no CI local com `npx esbuild netlify/functions/api.ts --bundle --platform=node --format=cjs`.
- Se o sidecar Semantica cair, o app segue 100% funcional (degradação graciosa).

---

## 🧠 Semantica — Memória de Longo Prazo (Knowledge Graph)

O comitê grava cada decisão em um grafo de conhecimento **Semantica** (sidecar Python)
e consulta precedentes históricos, provenance (cadeia causal) e estatísticas pela aba
**Knowledge** no app.

### Arquitetura

```
[Netlify Functions - Node/Express]  SEMANTICA_BASE_URL=https://<name>.onrender.com
      ▼  (fetch HTTPS server-side)
[Render free — bridge FastAPI :8001]  ← único serviço (ContextGraph stdlib-only)
```

- A integração é **opcional**: sem `SEMANTICA_BASE_URL`, o app funciona 100% (degradação graciosa).
- `recordDecision` roda fire-and-forget pós-análise (não adiciona latência ao `/api/swarm/*`).
- `SEMANTICA_PRECEDENT_INJECTION=true` injeta 1-3 casos similares no prompt do comitê (default off).

### Rodar o bridge local (sem Docker)

```bash
cd semantica
python -m venv .venv
.venv\Scripts\pip install --no-deps semantica==0.6.0 fastapi uvicorn
.venv\Scripts\python bridge.py     # sobe em http://localhost:8001
```

> O `ContextGraph` é importado com um bypass de `__init__` (stdlib-only): a imagem do Render
> fica enxuta sem numpy/scipy/torch/transformers. Deixe `DATABASE_URL` (Postgres free) definido
> para a memória sobreviver ao cold start do Render.

### Deploy no Render + Netlify

1. **Render**: Web Service → repo → Dockerfile root `semantica/` → plano `free` → health check `/health`.
2. Variáveis no Render: `DATABASE_URL` (opcional, secreta) e `SEMANTICA_KG_PATH=/app/kg.json`.
3. **Netlify** (painel): `SEMANTICA_BASE_URL=https://<name>.onrender.com`,
   `SEMANTICA_ENABLED=true`, `SEMANTICA_PRECEDENT_INJECTION=false`.
4. Confira em produção: `GET /api/knowledge/status` → `{"enabled": true}`.

---

## 📜 Licença

Projeto sob licença MIT. Desenvolvido por **Thiago Diniz**.
