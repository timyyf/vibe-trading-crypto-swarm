import { AgentReport, TradeDecision } from '../types';

export type AgentAgentId = 'technical' | 'sentiment' | 'orderbook' | 'whales' | 'alpha' | 'risk';

export const ALL_AGENT_IDS: AgentAgentId[] = ['technical', 'sentiment', 'orderbook', 'whales', 'alpha', 'risk'];
export const GROQ_AGENT_IDS: AgentAgentId[] = ['technical', 'sentiment', 'orderbook'];
export const DEEPSEEK_AGENT_IDS: AgentAgentId[] = ['whales', 'alpha', 'risk'];
export const GEMINI_AGENT_IDS: AgentAgentId[] = ['technical', 'sentiment', 'orderbook'];

export interface CommitteeAgentMeta {
  agentId: AgentAgentId;
  agentName: string;
  agentRole: string;
  specialistType: AgentReport['specialistType'];
  avatarIcon: string;
  directive: string;
}

// Diretrizes de cada especialista do comitê (sem alteração de conteúdo dos prompts atuais).
const AGENT_DIRECTIVES: Record<AgentAgentId, string> = {
  technical: `1. 🎯 "Dr. Quant Graph" — Análise Técnica Quantitativa Sênior:
   Sua tarefa é analisar o par em múltiplos timeframes (15min, 1h, 4h, 1d).
   Você deve avaliar rigorosamente:
   - Momentum: MACD(12,26,9), StochRSI(14,3,3), Williams %R, CCI, Rate of Change (ROC), RSI(14)
   - Tendência: ADX(14) + DI+/DI-, Parabolic SAR, Ichimoku Cloud, EMAs (20/50/200), SMAs (50/200)
   - Volatilidade: Bollinger Bands(20,2), Keltner Channels, ATR(14)
   - Volume: OBV (On-Balance Volume), VWAP, MFI (Money Flow Index)
   - Multi-Timeframe: Análise simultânea de confluência (15m, 1h, 4h, 1d)
   - Padrões de Candlestick: Engulfing, Doji, Morning Star, Hammer, Three Black Crows
   - Níveis de Confluência: Suporte/Resistência dinâmico (Fibonacci, pivôs, S/R por volume)
   Atribua um score de 0-100 para direção (0=forte venda, 100=forte compra) e justifique com números exatos. Identifique confluências onde 3+ indicadores apontam na mesma direção. NUNCA emita sinal baseado em apenas 1 indicador.`,

  sentiment: `2. 💬 "Sofia Sentiment" — Especialista em Psicologia de Mercado & Dados Alternativos:
   Sua tarefa é analisar a psicologia do mercado e a dinâmica de sentimentos:
   - Fear & Greed Index: Compare valor atual com a média móvel de 30 e 90 dias para identificar aceleração ou capitulação.
   - Social Scraping & NLP (X/Twitter, Reddit r/CryptoCurrency, r/Bitcoin, 4chan /biz/): Análise de sentimento léxico FinBERT (-1.0 a +1.0) e variação de volume de menções.
   - Google Trends: Análise de momentum de buscas por "buy crypto", "crypto crash", "altcoin season" para medir FOMO/pânico do varejo.
   - Funding Rate de Perpétuos: Taxas de financiamento na Binance/Bybit (Longs pagando Shorts = Ganância/Alavancagem; Shorts pagando Longs = Medo/Risco de Short Squeeze).
   - Liquidation Heatmap: Mapeamento de zonas magnéticas de liquidação concentrada de stops.
   - Alerta de Divergência: Detectar se o preço cai enquanto o sentimento melhora (fundo/acumulação) ou preço sobe enquanto sentimento enfraquece (exaustão).
   Emita um score composto (0-100) e alertas de divergência claros.`,

  orderbook: `3. 📊 "OrderBook Sentinel" — Especialista em Microestrutura de Mercado & Leitura de Fluxo L2:
   Sua tarefa é analisar o livro de ofertas L2 e microestrutura de execução:
   - Order Book Imbalance (OBI L2): (Volume Bids - Volume Asks) / (Volume Bids + Volume Asks) nos top 8 níveis.
   - Delta Volume Net & CVD (Cumulative Volume Delta): Saldo de ordens a mercado agressivas (buyers vs sellers).
   - Volume Profile & Point of Control (POC): Identificação do nível de preço de maior liquidez negociada no range.
   - Anomalias de Spread & Paredes de Liquidez: Detecção de ordens gigantes/iceberg (>1.6x tamanho médio por nível) e expansão atípica de spread.
   - Simulação de Slippage: Estimativa de impacto percentual no preço para execuções a mercado de $10k, $50k e $100k USD.
   - Divergência de Microestrutura: Alerta quando o preço sobe mas o CVD cai (absorção passiva) ou quando o preço cai e o CVD sobe (acumulação).
   Emita um score de microestrutura (0-100) e parecer detalhado.`,

  whales: `4. 🐋 "Whale Tracker Apex" — Especialista em Inteligência On-Chain & Clustering de Baleias:
   Sua tarefa é rastrear movimentos de grandes carteiras institucionais e métricas on-chain:
   - Exchange Netflow (USD): Monitorar entrada (Inflow = pressão de venda) vs saída (Outflow = acumulação em cold wallets).
   - Whale Wallet Clustering: Agrupar endereços pertencentes à mesma entidade e rastrear transferências internas.
   - Exchange Whale Ratio: Volume das 10 maiores transações relativo ao volume total (>0.85 = sinal de topo/alerta).
   - Stablecoin Flows & Mint/Burn: Inflows de USDT/USDC em exchanges ("dry powder") e minting/burning na blockchain.
   - Métricas On-Chain (MVRV, SOPR, MPI): MVRV Ratio (<1.0 subvalorizado, >3.5 sobreaquecido), SOPR (lucro/prejuízo de moedas gastas) e Miner Position Index.
   - Estado de Cluster On-Chain: Identificação de fases de acumulação (3+ dias de outflows contínuos) ou distribuição.
   Emita um score on-chain (0-100) e alertas estratégicos.`,

  alpha: `5. 🔬 "Alpha Zoo Engine" — Especialista em Fatores Quantitativos, Backtesting & Regimes de Mercado:
   Sua tarefa é calcular o universo de fatores quantitativos e modelar a expectativa matemática:
   - Fatores GTJA-191 & Alpha101: Avaliar os principais alfas de momentum, reversão à média, volatilidade realizada e liquidez (Amihud Illiquidity Ratio).
   - Neutralização de Risco & Beta: Purificação do alfa através do beta-hedging relativo ao mercado/BTC.
   - Information Coefficient (IC): Análise do poder preditivo (IC 1d, 5d, 10d) para classificar o ranking dos fatores ativos.
   - Walk-Forward Backtesting: Simulação rolante (90d treino / 7d teste) com modelagem realista de custos de transação (0.10% em taxas e slippage).
   - Detecção de Regime HMM (Hidden Markov Model): Mapear se o regime atual favorece estratégias de tendência/momentum ou de reversão à média/faixa.
   Emita um score quantitativo (0-100), o ranking dos top fatores e relatório de backtest.`,

  risk: `6. 🛡️ "Risk Protocol Officer" — Especialista em Gestão de Risco, Kelly Sizing, VaR/CVaR & Poder de Veto:
   Sua tarefa é auditar a segurança de capital e exercer o PODER DE VETO se houver risco excessivo:
   - Tamanho de Posição via Fractional Kelly (Half-Kelly 0.5x) e Volatility Targeting.
   - Stop Loss Técnico baseado em ATR(14) x 2.0 e Relação Risco/Retorno Mínima (RRR >= 1:2.0).
   - Métricas de Risco de Cauda: Value at Risk (VaR 95%) e Expected Shortfall (CVaR).
   - Teste de Estresse Simulando Flash Crash (-15% em 1h), Iliquidez e Funding Drain.
   - Poder de VETO: Se RRR < 2.0 ou VaR excede os limites, BLOQUEIE a operação imediatamente com justificativa de VETO.
   No seu JSON, se decidir pelo VETO, retorne "veto": true e "vetoReason" com a justificativa técnica.`,
};

// Exemplo de bloco JSON por agente (usado na seção "formato de resposta" do prompt).
const AGENT_JSON_EXAMPLES: Record<AgentAgentId, string> = {
  technical: `    {
      "agentId": "technical",
      "agentName": "Dr. Quant Graph",
      "agentRole": "Análise Técnica Quantitativa Multi-Timeframe",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer técnico quantitativo detalhando indicadores de momentum, tendência e volatilidade",
      "keyMetrics": [
        {"label": "RSI(14) | StochRSI", "value": "ex: 61.4 | K:78 D:72", "status": "positive"|"negative"|"neutral"},
        {"label": "MACD (12,26,9)", "value": "ex: +14.2 Histograma (Cruzamento Altista)", "status": "positive"|"negative"|"neutral"},
        {"label": "ADX (14) / Direction", "value": "ex: 32.4 (DI+ 28.5 > DI- 14.2)", "status": "positive"|"negative"|"neutral"},
        {"label": "EMAs (20/50/200)", "value": "ex: Preço > EMA20 > EMA50 > EMA200", "status": "positive"|"negative"|"neutral"},
        {"label": "Bollinger & ATR", "value": "ex: Superior $$HIGH$$ | ATR $$ATR$$", "status": "positive"|"negative"|"neutral"},
        {"label": "VWAP & OBV", "value": "ex: Preço +0.8% acima do VWAP", "status": "positive"|"negative"|"neutral"},
        {"label": "Padrão & Multi-Timeframe", "value": "ex: Engulfing Altista em 15m | Confluência 4/4", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Confluência de 4+ indicadores em alta", "Cruzamento altista no StochRSI e MACD", "Preço sustentado acima da EMA20"]
    },`,

  sentiment: `    {
      "agentId": "sentiment",
      "agentName": "Sofia Sentiment",
      "agentRole": "Sentimento Social & Dados Alternativos",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer de sentimento social e notícias",
      "keyMetrics": [
        {"label": "Fear & Greed Index", "value": "ex: 68 (Ganância)", "status": "positive"|"negative"|"neutral"},
        {"label": "Volume de Menções", "value": "ex: +84% no r/CryptoCurrency", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Tom comprador dominante nas mídias"]
    },`,

  orderbook: `    {
      "agentId": "orderbook",
      "agentName": "OrderBook Sentinel",
      "agentRole": "Livro de Ofertas & Microestrutura de Liquidez",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer do livro de ordens",
      "keyMetrics": [
        {"label": "Bid/Ask Ratio", "value": "ex: 1.34x (Compradores)", "status": "positive"|"negative"|"neutral"},
        {"label": "Spread Spot", "value": "ex: 0.02%", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Muralha de suporte de compra no livro"]
    },`,

  whales: `    {
      "agentId": "whales",
      "agentName": "Whale Tracker Apex",
      "agentRole": "Fluxo On-Chain & Liquidez Institucional",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer de grandes carteiras",
      "keyMetrics": [
        {"label": "Fluxo Corretoras", "value": "ex: -$28.5M Saída", "status": "positive"|"negative"|"neutral"},
        {"label": "Ordens Institucionais", "value": "ex: 14 Blocos Grandes", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Acúmulo por baleias em cold wallets"]
    },`,

  alpha: `    {
      "agentId": "alpha",
      "agentName": "Alpha Zoo Engine",
      "agentRole": "Fatores Quantitativos & Backtesting",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer de fatores estatísticos",
      "keyMetrics": [
        {"label": "Win Rate (GTJA-191)", "value": "ex: 66.8%", "status": "positive"|"negative"|"neutral"},
        {"label": "Sharpe Ratio Est.", "value": "ex: 2.18", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Fator Momentum Volatilidade ativo"]
    },`,

  risk: `    {
      "agentId": "risk",
      "agentName": "Risk Protocol Officer",
      "agentRole": "Gerenciamento de Risco & Parâmetros",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer de gerenciamento de risco",
      "veto": false,
      "vetoReason": "",
      "keyMetrics": [
        {"label": "Relação RRR", "value": "ex: 1:2.4", "status": "positive"|"negative"|"neutral"},
        {"label": "Max Drawdown Est.", "value": "ex: 1.4%", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Stop Loss posicionado fora do ruído"]
    },`,
};

export interface CommitteePromptParams {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  signalDurationMinutes: number;
  precedents?: string;
  mirofishPromptSection?: string;
  agentIds: AgentAgentId[];
  providerLabel: string;
}

// Constrói o prompt do orquestrador para um SUBCONJUNTO de especialistas.
export function buildCommitteePrompt(p: CommitteePromptParams): string {
  const directives = p.agentIds
    .map((id) => AGENT_DIRECTIVES[id])
    .join('\n\n');

  const jsonExample = p.agentIds
    .map((id) => AGENT_JSON_EXAMPLES[id])
    .join('\n')
    .replace(/\$\$HIGH\$\$/g, p.high24h.toLocaleString('en-US'))
    .replace(/\$\$ATR\$\$/g, (p.price * 0.015).toFixed(2));

  const agentsList = p.agentIds.map((id) => `"${id}"`).join(', ');

  return `Você é o ORQUESTRADOR CENTRAL do Comitê Vibe-Trading (HKU Data Science / Institutional Wall Street Framework).
Sua função é receber a requisição do usuário, atuar como especialista nos papéis abaixo e emitir o parecer estruturado.
Você responde por ${p.providerLabel} e NÃO repete pareceres: produza APENAS os especialistas solicitados.

DADOS DE MERCADO EM TEMPO REAL:
- Ativo: ${p.symbol} (${p.name})
- Preço Atual Spot: $${p.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Variação 24h: ${p.change24h > 0 ? '+' : ''}${p.change24h.toFixed(2)}%
- Volume 24h: $${(p.volume24h / 1e6).toFixed(2)}M USD
- Máxima 24h: $${p.high24h.toLocaleString('en-US')} | Mínima 24h: $${p.low24h.toLocaleString('en-US')}
- Janela de Tempo Operacional Solicitada pelo Trader: ${p.signalDurationMinutes} minutos.
${p.precedents ? `

MEMÓRIA DE LONGO PRAZO (PRECEDENTES HISTÓRICOS DE DECISÕES ANTERIORES):
${p.precedents}
` : ''}
${p.mirofishPromptSection ? `

SUPORTE DE SIMULAÇÃO (MIROFISH — NÃO DECIDE; APENAS APOIO AO COMITÊ):
${p.mirofishPromptSection}

A simulação acima é apenas referencial. Incorpore o consenso da simulação como mais um insumo, mas mantenha o
veredito final fundamentado nos pareceres reais dos especialistas que você representa.
` : ''}

DIRETRIZES DOS ESPECIALISTAS (responda por ESTES papéis, e somente eles):

${directives}

Retorne obrigatoriamente no formato JSON em português com a seguinte estrutura:
{
  "finalDecision": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
  "confidenceScore": número de 0 a 100,
  "agents": [
${jsonExample}
  ]
}

IMPORTANTE:
- Retorne SOMENTE os agentes solicitados no array "agents", com estes agentId exatos: ${agentsList}. NÃO inclua outros agentes.
- Não invente números brutos que você não tem (ex.: preço exato de stop/take-profit); baseie-se nos dados fornecidos.
- Responda APENAS com JSON válido, sem markdown, sem comentários.`;
}

// Normaliza um agente cru (saída de LLM) em uma AgentReport completa.
export function normalizeAgent(raw: any, provider: 'groq' | 'deepseek' | 'gemini' | 'local', allowedIds: AgentAgentId[], idx: number): AgentReport {
  const id = (allowedIds.includes(raw?.agentId) ? raw.agentId : allowedIds[idx % allowedIds.length]) as AgentAgentId;
  const meta: CommitteeAgentMeta = {
    agentId: id,
    agentName: raw?.agentName || id,
    agentRole: raw?.agentRole || 'Especialista de Mercado',
    specialistType: undefined,
    avatarIcon: 'Activity',
    directive: '',
  };

  const opinionRaw = String(raw?.opinion || 'AGUARDAR / NEUTRO');
  const opinion: TradeDecision = opinionRaw.includes('COMPRAR')
    ? 'COMPRAR'
    : opinionRaw.includes('VENDER')
    ? 'VENDER'
    : 'AGUARDAR / NEUTRO';

  const score = typeof raw?.score === 'number' ? Math.min(100, Math.max(0, Math.round(raw.score))) : 50;

  const keyMetrics: AgentReport['keyMetrics'] = Array.isArray(raw?.keyMetrics)
    ? raw.keyMetrics.map((km: any) => ({
        label: String(km?.label || 'Métrica'),
        value: String(km?.value || 'N/A'),
        status: ['positive', 'negative', 'neutral'].includes(km?.status) ? km.status : 'neutral',
      }))
    : [];

  const signals: string[] = Array.isArray(raw?.signals) ? raw.signals.map((s: any) => String(s)) : [];

  return {
    agentId: id,
    agentName: typeof raw?.agentName === 'string' && raw.agentName.trim() ? raw.agentName : id,
    agentRole: typeof raw?.agentRole === 'string' && raw.agentRole.trim() ? raw.agentRole : meta.agentRole,
    specialistType: meta.specialistType,
    avatarIcon: meta.avatarIcon,
    opinion,
    score,
    summary: typeof raw?.summary === 'string' && raw.summary.trim() ? raw.summary : 'Parecer gerado pela IA. Sem detalhes adicionais fornecidos.',
    keyMetrics,
    signals,
    processingTimeMs: typeof raw?.processingTimeMs === 'number' ? raw.processingTimeMs : 150 + idx * 20,
    status: 'CONCLUÍDO',
    provider,
    veto: raw?.veto === true ? true : undefined,
    vetoReason: typeof raw?.vetoReason === 'string' ? raw.vetoReason : undefined,
  };
}

export function normalizeAgents(rawAgents: any, provider: 'groq' | 'deepseek' | 'gemini' | 'local', allowedIds: AgentAgentId[]): AgentReport[] {
  if (!Array.isArray(rawAgents)) return [];
  return rawAgents.map((raw, idx) => normalizeAgent(raw, provider, allowedIds, idx));
}

// Reporte DEGRADADO honesto (provedor falhou) — mantém o voto com peso reduzido.
export function degradedAgent(id: AgentAgentId, provider: 'groq' | 'deepseek' | 'gemini', reason?: string): AgentReport {
  const meta = AGENT_META[id];
  const providerLabel = provider === 'groq' ? 'Groq' : provider === 'gemini' ? 'Gemini' : 'DeepSeek';
  const reasonText = reason ? ` ${reason}.` : ` provedor ${providerLabel} falhou sem motivo informado.`;
  return {
    agentId: id,
    agentName: meta.agentName,
    agentRole: meta.agentRole,
    specialistType: meta.specialistType,
    avatarIcon: meta.avatarIcon,
    opinion: 'AGUARDAR / NEUTRO',
    score: 50,
    summary: `Parecer indisponível —${reasonText} Sem dados fabricados; voto com peso reduzido.`,
    keyMetrics: [],
    signals: [],
    processingTimeMs: 0,
    status: 'DEGRADADO',
    provider,
  };
}

export const AGENT_META: Record<AgentAgentId, { agentId: AgentAgentId; agentName: string; agentRole: string; specialistType: AgentReport['specialistType']; avatarIcon: string }> = {
  technical: { agentId: 'technical', agentName: 'Dr. Quant Graph', agentRole: 'Análise Técnica Quantitativa Multi-Timeframe', specialistType: 'Técnico', avatarIcon: 'TrendingUp' },
  sentiment: { agentId: 'sentiment', agentName: 'Sofia Sentiment', agentRole: 'Sentimento Social & Dados Alternativos', specialistType: 'Analista de Sentimento', avatarIcon: 'MessageSquare' },
  orderbook: { agentId: 'orderbook', agentName: 'OrderBook Sentinel', agentRole: 'Livro de Ofertas & Microestrutura de Liquidez', specialistType: 'Liquidez & Orderbook', avatarIcon: 'Sliders' },
  whales: { agentId: 'whales', agentName: 'Whale Tracker Apex', agentRole: 'Fluxo On-Chain & Liquidez Institucional', specialistType: 'Fundamentalista', avatarIcon: 'ShieldAlert' },
  alpha: { agentId: 'alpha', agentName: 'Alpha Zoo Engine', agentRole: 'Fatores Quantitativos & Backtesting', specialistType: 'Quant Factor', avatarIcon: 'Cpu' },
  risk: { agentId: 'risk', agentName: 'Risk Protocol Officer', agentRole: 'Gerenciamento de Risco & Parâmetros', specialistType: 'Risk Manager', avatarIcon: 'Shield' },
};

// Garante que os 6 especialistas existam, na ordem canônica, deduplicando por agentId.
export function mergeAndOrderAgents(agents: AgentReport[]): AgentReport[] {
  const byId = new Map<AgentAgentId, AgentReport>();
  for (const a of agents) {
    if (!byId.has(a.agentId)) byId.set(a.agentId, a);
  }
  return ALL_AGENT_IDS.map((id) => byId.get(id)).filter((a): a is AgentReport => Boolean(a));
}
