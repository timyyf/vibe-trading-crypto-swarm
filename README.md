# Vibe Trading // Swarm AI 🚀

Plataforma institucional de análise quantitativa e inteligência financeira multi-agente alimentada por Google Gemini.

![Vibe Trading Swarm AI](https://img.shields.io/badge/Status-Active-emerald?style=for-the-badge) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) ![Gemini 2.5](https://img.shields.io/badge/Gemini_2.5-8E75FF?style=for-the-badge&logo=google&logoColor=white)

---

## 📌 Visão Geral

O **Vibe Trading Swarm AI** é um sistema avançado de tomada de decisão para criptoativos baseado na colaboração em enxame (Swarm Multi-Agent Architecture). Diversos agentes especializados analisam indicadores técnicos, fluxo on-chain de baleias, fatores quantitativos, sentimento do mercado de notícias/redes sociais e tomam decisões de comitê em tempo real com transparência total.

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
  - Testes de ping individual por agente e logs de execução com altíssima velocidade (< 200ms por veredito via modelo quântico fallback + Gemini API).

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, Tailwind CSS, Lucide Icons, Recharts, Motion (Framer Motion).
- **Backend**: Node.js, Express, ESBuild, TypeScript (tsx).
- **IA Engine**: `@google/genai` (Google Gemini API).
- **Build System**: Vite 6, ESBuild.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ instalado.
- Chave de API do Gemini (`GEMINI_API_KEY`).

### Instalação

```bash
# Clone o repositório
git clone https://github.com/timyyf/vibe-trading-crypto-swarm.git
cd vibe-trading-crypto-swarm

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Adicione sua GEMINI_API_KEY no arquivo .env
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
   (o `/api/swarm/analyze` com Gemini pode levar até ~18s + cold start; sem chave
   o fallback local responde em ~1.3s).
3. **Environment variables**:
   | Variável | Obrigatória? | Descrição |
   |---|---|---|
   | `GEMINI_API_KEY` | opcional | Chave do Gemini 2.5 Flash. Sem ela o comitê roda em fallback determinístico com dados reais. |
   | `SEMANTICA_BASE_URL` | opcional | URL do sidecar Semantica no Render (ver seção acima). |
   | `SEMANTICA_ENABLED` | opcional | `true` para ativar o knowledge graph (default `true`). |
4. **Deploy**. Verificar depois:
   - `https://<site>.netlify.app/api/health` → `ONLINE`/`DEGRADED` com 9 agentes diagnosticados
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
