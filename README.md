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

## 📜 Licença

Projeto sob licença MIT. Desenvolvido por **Thiago Diniz**.
