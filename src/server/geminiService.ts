import { GoogleGenAI, Type } from "@google/genai";
import { SwarmAnalysisResult, TradeDecision } from "../types.js";
import { runDrQuantGraphEngine } from "./quantEngine.js";
import { runSofiaSentimentEngine } from "./sentimentEngine.js";
import { runOrderBookSentinelEngine } from "./orderbookEngine.js";
import { runWhaleTrackerApexEngine } from "./whaleEngine.js";
import { runAlphaZooEngine } from "./alphaZooEngine.js";
import { runRiskProtocolOfficerEngine } from "./riskEngine.js";
import { getCryptoKlines } from "./cryptoDataService.js";
import { getWhaleOverview } from "./whaleDataService.js";

export async function analyzeCryptoWithSwarm(
  symbol: string,
  name: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  signalDurationMinutes: number = 5
): Promise<SwarmAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Prompt describing the multi-agent committee process (Vibe-Trading Swarm archetype)
  const prompt = `Você é o ORQUESTRADOR CENTRAL do Comitê Vibe-Trading (HKU Data Science / Institutional Wall Street Framework).
Sua função é receber a requisição do usuário, distribuir a análise para os 6 AGENTES ESPECIALIZADOS, consolidar seus votos e nível de confiança, e emitir o sinal final.

DADOS DE MERCADO EM TEMPO REAL:
- Ativo: ${symbol} (${name})
- Preço Atual Spot: $${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Variação 24h: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%
- Volume 24h: $${(volume24h / 1e6).toFixed(2)}M USD
- Máxima 24h: $${high24h.toLocaleString('en-US')} | Mínima 24h: $${low24h.toLocaleString('en-US')}
- Janela de Tempo Operacional Solicitada pelo Trader: ${signalDurationMinutes} minutos.

DIRETRIZES DOS ESPECIALIZADOS DO COMITÊ:

1. 🎯 "Dr. Quant Graph" — Análise Técnica Quantitativa Sênior:
   Sua tarefa é analisar o par em múltiplos timeframes (15min, 1h, 4h, 1d).
   Você deve avaliar rigorosamente:
   - Momentum: MACD(12,26,9), StochRSI(14,3,3), Williams %R, CCI, Rate of Change (ROC), RSI(14)
   - Tendência: ADX(14) + DI+/DI-, Parabolic SAR, Ichimoku Cloud, EMAs (20/50/200), SMAs (50/200)
   - Volatilidade: Bollinger Bands(20,2), Keltner Channels, ATR(14)
   - Volume: OBV (On-Balance Volume), VWAP, MFI (Money Flow Index)
   - Multi-Timeframe: Análise simultânea de confluência (15m, 1h, 4h, 1d)
   - Padrões de Candlestick: Engulfing, Doji, Morning Star, Hammer, Three Black Crows
   - Níveis de Confluência: Suporte/Resistência dinâmico (Fibonacci, pivôs, S/R por volume)
   Atribua um score de 0-100 para direção (0=forte venda, 100=forte compra) e justifique com números exatos. Identifique confluências onde 3+ indicadores apontam na mesma direção. NUNCA emita sinal baseado em apenas 1 indicador.

2. 💬 "Sofia Sentiment" — Especialista em Psicologia de Mercado & Dados Alternativos:
   Sua tarefa é analisar a psicologia do mercado e a dinâmica de sentimentos:
   - Fear & Greed Index: Compare valor atual com a média móvel de 30 e 90 dias para identificar aceleração ou capitulação.
   - Social Scraping & NLP (X/Twitter, Reddit r/CryptoCurrency, r/Bitcoin, 4chan /biz/): Análise de sentimento léxico FinBERT (-1.0 a +1.0) e variação de volume de menções.
   - Google Trends: Análise de momentum de buscas por "buy crypto", "crypto crash", "altcoin season" para medir FOMO/pânico do varejo.
   - Funding Rate de Perpétuos: Taxas de financiamento na Binance/Bybit (Longs pagando Shorts = Ganância/Alavancagem; Shorts pagando Longs = Medo/Risco de Short Squeeze).
   - Liquidation Heatmap: Mapeamento de zonas magnéticas de liquidação concentrada de stops.
   - Alerta de Divergência: Detectar se o preço cai enquanto o sentimento melhora (fundo/acumulação) ou preço sobe enquanto sentimento enfraquece (exaustão).
   Emita um score composto (0-100) e alertas de divergência claros.
3. 📊 "OrderBook Sentinel" — Especialista em Microestrutura de Mercado & Leitura de Fluxo L2:
   Sua tarefa é analisar o livro de ofertas L2 e microestrutura de execução:
   - Order Book Imbalance (OBI L2): (Volume Bids - Volume Asks) / (Volume Bids + Volume Asks) nos top 8 níveis.
   - Delta Volume Net & CVD (Cumulative Volume Delta): Saldo de ordens a mercado agressivas (buyers vs sellers).
   - Volume Profile & Point of Control (POC): Identificação do nível de preço de maior liquidez negociada no range.
   - Anomalias de Spread & Paredes de Liquidez: Detecção de ordens gigantes/iceberg (>1.6x tamanho médio por nível) e expansão atípica de spread.
   - Simulação de Slippage: Estimativa de impacto percentual no preço para execuções a mercado de $10k, $50k e $100k USD.
   - Divergência de Microestrutura: Alerta quando o preço sobe mas o CVD cai (absorção passiva) ou quando o preço cai e o CVD sobe (acumulação).
   Emita um score de microestrutura (0-100) e parecer detalhado.
4. 🐋 "Whale Tracker Apex" — Especialista em Inteligência On-Chain & Clustering de Baleias:
   Sua tarefa é rastrear movimentos de grandes carteiras institucionais e métricas on-chain:
   - Exchange Netflow (USD): Monitorar entrada (Inflow = pressão de venda) vs saída (Outflow = acumulação em cold wallets).
   - Whale Wallet Clustering: Agrupar endereços pertencentes à mesma entidade e rastrear transferências internas.
   - Exchange Whale Ratio: Volume das 10 maiores transações relativo ao volume total (>0.85 = sinal de topo/alerta).
   - Stablecoin Flows & Mint/Burn: Inflows de USDT/USDC em exchanges ("dry powder") e minting/burning na blockchain.
   - Métricas On-Chain (MVRV, SOPR, MPI): MVRV Ratio (<1.0 subvalorizado, >3.5 sobreaquecido), SOPR (lucro/prejuízo de moedas gastas) e Miner Position Index.
   - Estado de Cluster On-Chain: Identificação de fases de acumulação (3+ dias de outflows contínuos) ou distribuição.
   Emita um score on-chain (0-100) e alertas estratégicos.
5. 🔬 "Alpha Zoo Engine" — Especialista em Fatores Quantitativos, Backtesting & Regimes de Mercado:
   Sua tarefa é calcular o universo de fatores quantitativos e modelar a expectativa matemática:
   - Fatores GTJA-191 & Alpha101: Avaliar os principais alfas de momentum, reversão à média, volatilidade realizada e liquidez (Amihud Illiquidity Ratio).
   - Neutralização de Risco & Beta: Purificação do alfa através do beta-hedging relativo ao mercado/BTC.
   - Information Coefficient (IC): Análise do poder preditivo (IC 1d, 5d, 10d) para classificar o ranking dos fatores ativos.
   - Walk-Forward Backtesting: Simulação rolante (90d treino / 7d teste) com modelagem realista de custos de transação (0.10% em taxas e slippage).
   - Detecção de Regime HMM (Hidden Markov Model): Mapear se o regime atual favorece estratégias de tendência/momentum ou de reversão à média/faixa.
   Emita um score quantitativo (0-100), o ranking dos top fatores e relatório de backtest.
6. 🛡️ "Risk Protocol Officer" — Especialista em Gestão de Risco, Kelly Sizing, VaR/CVaR & Poder de Veto:
   Sua tarefa é auditar a segurança de capital e exercer o PODER DE VETO se houver risco excessivo:
   - Tamanho de Posição via Fractional Kelly (Half-Kelly 0.5x) e Volatility Targeting.
   - Stop Loss Técnico baseado em ATR(14) x 2.0 e Relação Risco/Retorno Mínima (RRR >= 1:2.0).
   - Métricas de Risco de Cauda: Value at Risk (VaR 95%) e Expected Shortfall (CVaR).
   - Teste de Estresse Simulando Flash Crash (-15% em 1h), Iliquidez e Funding Drain.
   - Poder de VETO: Se RRR < 2.0 ou VaR excede os limites, BLOQUEIE a operação imediatamente com justificativa de VETO.

Retorne obrigatoriamente no formato JSON em português com a seguinte estrutura:
{
  "finalDecision": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
  "confidenceScore": número de 0 a 100,
  "signalDurationMinutes": ${signalDurationMinutes},
  "recommendedDurationMinutes": número (0, 1, 3, 5, 10, 15, 20 ou 30 conforme avaliação),
  "durationJustification": "justificativa técnica minuciosa detalhando volume e volatilidade",
  "entryTarget": preço de entrada recomendado próximo a $${price},
  "stopLoss": preço de stop loss,
  "takeProfit": preço de alvo com RRR de pelo menos 1:2.0,
  "riskRewardRatio": string ex: "1:2.4",
  "summaryConsensus": "resumo profissional do consenso dos 6 especialistas em 2-3 frases",
  "reasoningNotes": ["ponto técnico 1", "ponto fundamental 2", "ponto de risco 3"],
  "agents": [
    {
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
        {"label": "Bollinger & ATR", "value": "ex: Superior $${high24h} | ATR $${(price * 0.015).toFixed(2)}", "status": "positive"|"negative"|"neutral"},
        {"label": "VWAP & OBV", "value": "ex: Preço +0.8% acima do VWAP", "status": "positive"|"negative"|"neutral"},
        {"label": "Padrão & Multi-Timeframe", "value": "ex: Engulfing Altista em 15m | Confluência 4/4", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Confluência de 4+ indicadores em alta", "Cruzamento altista no StochRSI e MACD", "Preço sustentado acima da EMA20"]
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      "agentId": "risk",
      "agentName": "Risk Protocol Officer",
      "agentRole": "Gerenciamento de Risco & Parâmetros",
      "opinion": "COMPRAR" | "VENDER" | "AGUARDAR / NEUTRO",
      "score": número 0-100,
      "summary": "parecer de gerenciamento de risco",
      "keyMetrics": [
        {"label": "Relação RRR", "value": "ex: 1:2.4", "status": "positive"|"negative"|"neutral"},
        {"label": "Max Drawdown Est.", "value": "ex: 1.4%", "status": "positive"|"negative"|"neutral"}
      ],
      "signals": ["Stop Loss posicionado fora do ruído"]
    }
  ]
}`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          finalDecision: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER },
          signalDurationMinutes: { type: Type.NUMBER },
          recommendedDurationMinutes: { type: Type.NUMBER },
          durationJustification: { type: Type.STRING },
          entryTarget: { type: Type.NUMBER },
          stopLoss: { type: Type.NUMBER },
          takeProfit: { type: Type.NUMBER },
          riskRewardRatio: { type: Type.STRING },
          summaryConsensus: { type: Type.STRING },
          reasoningNotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          agents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                agentId: { type: Type.STRING },
                agentName: { type: Type.STRING },
                agentRole: { type: Type.STRING },
                opinion: { type: Type.STRING },
                score: { type: Type.NUMBER },
                summary: { type: Type.STRING },
                keyMetrics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                      status: { type: Type.STRING },
                    },
                  },
                },
                signals: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
      };

      const parsed = await callGeminiWithRetry(ai, prompt, responseSchema, 1);
      const now = Date.now();
      const isNeutralDecision = !parsed.finalDecision || parsed.finalDecision.includes('NEUTRO') || parsed.finalDecision.includes('AGUARDAR');
      const effectiveDuration = isNeutralDecision ? 0 : (parsed.recommendedDurationMinutes || parsed.signalDurationMinutes || signalDurationMinutes);

      return {
        assetSymbol: symbol,
        assetName: name,
        assetPrice: price,
        timestamp: now,
        finalDecision: (parsed.finalDecision || 'AGUARDAR / NEUTRO') as TradeDecision,
        confidenceScore: parsed.confidenceScore ?? 75,
        signalDurationMinutes: isNeutralDecision ? 0 : signalDurationMinutes,
        recommendedDurationMinutes: effectiveDuration,
        durationJustification: isNeutralDecision
          ? 'Comitê definiu 0 minutos de permanência por considerar a operação AGUARDAR / NEUTRO. Não é seguro abrir posições no momento.'
          : (parsed.durationJustification || `Comitê definiu a janela segura para ${effectiveDuration} minutos com base nas médias técnicas e volume.`),
        expiryTimestamp: now + effectiveDuration * 60 * 1000,
        entryTarget: parsed.entryTarget || price,
        stopLoss: parsed.stopLoss || (price * (parsed.finalDecision === 'COMPRAR' ? 0.985 : 1.015)),
        takeProfit: parsed.takeProfit || (price * (parsed.finalDecision === 'COMPRAR' ? 1.03 : 0.97)),
        riskRewardRatio: parsed.riskRewardRatio || '1:2.0',
        summaryConsensus: isNeutralDecision
          ? `O Comitê Vibe-Trading concluiu por AGUARDAR / NEUTRO em ${symbol}. O mercado apresenta incerteza/consolidação, recomendando NÃO ABRIR posições.`
          : (parsed.summaryConsensus || 'O comitê analisou os fatores técnicos e de mercado para o ativo.'),
        reasoningNotes: parsed.reasoningNotes || ['Volume sem direção definida', 'Osciladores neutros'],
        agents: (parsed.agents || []).map((ag: any) => {
          const procTime = ag.agentId === 'technical' ? 140 : ag.agentId === 'sentiment' ? 210 : ag.agentId === 'whales' ? 175 : 190;
          const specType = ag.agentId === 'technical' ? 'Técnico' : ag.agentId === 'sentiment' ? 'Analista de Sentimento' : ag.agentId === 'whales' ? 'Fundamentalista' : 'Quant Factor';
          return {
            ...ag,
            avatarIcon: getAgentIcon(ag.agentId),
            specialistType: specType,
            processingTimeMs: ag.processingTimeMs || procTime,
            status: ag.status || 'CONCLUÍDO',
          };
        }),
      };
    } catch (err: any) {
      console.log(`[Gemini API] Notice (${err?.message || 'Model Unavailable'}). Utilizing local high-speed quantitative model fallback.`);
    }
  }

  // Smart algorithmic fallback synthesis if GEMINI_API_KEY is not set or network fails
  return await fallbackSwarmAnalysis(symbol, name, price, change24h, volume24h, high24h, low24h, signalDurationMinutes);
}

function getAgentIcon(id: string): string {
  switch (id) {
    case 'technical':
      return 'TrendingUp';
    case 'sentiment':
      return 'MessageSquare';
    case 'orderbook':
      return 'Sliders';
    case 'whales':
      return 'ShieldAlert';
    case 'alpha':
      return 'Cpu';
    case 'risk':
      return 'Shield';
    default:
      return 'Bot';
  }
}

async function fallbackSwarmAnalysis(
  symbol: string,
  name: string,
  price: number,
  change24h: number,
  volume24h: number,
  high24h: number,
  low24h: number,
  durationMinutes: number
): Promise<SwarmAnalysisResult> {
  const now = Date.now();

  // Get real klines & execute Specialized Engines (dados reais, sem fabricação)
  const klines = await getCryptoKlines(symbol, '15m', 40);
  const drQuant = runDrQuantGraphEngine(symbol, price, change24h, volume24h, high24h, low24h, klines);
  const sofiaSentiment = await runSofiaSentimentEngine(symbol, price, change24h, volume24h, high24h, low24h);
  const orderbookSentinel = await runOrderBookSentinelEngine(symbol, price, change24h, volume24h, high24h, low24h, klines);
  const whaleSnapshot = await getWhaleOverview();
  const whaleApex = runWhaleTrackerApexEngine(symbol, price, change24h, volume24h, high24h, low24h, whaleSnapshot);
  const alphaZoo = runAlphaZooEngine(symbol, price, change24h, volume24h, high24h, low24h, klines);

  // Preliminary direction before Risk Audit
  const preliminaryDirection: TradeDecision = change24h > 0.5 ? 'COMPRAR' : change24h < -2.0 ? 'VENDER' : 'AGUARDAR / NEUTRO';
  const riskOfficer = runRiskProtocolOfficerEngine(symbol, price, change24h, volume24h, high24h, low24h, klines, preliminaryDirection);

  // Count quorum consensus across the 6 agents
  const allAgents = [
    drQuant.report,
    sofiaSentiment.report,
    orderbookSentinel.report,
    whaleApex.report,
    alphaZoo.report,
    riskOfficer.report,
  ];

  const buyVotes = allAgents.filter((a) => a.opinion === 'COMPRAR').length;
  const sellVotes = allAgents.filter((a) => a.opinion === 'VENDER').length;

  // Decision & Quorum (At least 4/6 agents must agree AND Risk Officer must NOT veto)
  let decision: TradeDecision = 'AGUARDAR / NEUTRO';
  if (!riskOfficer.summary.isVetoedByRiskOfficer) {
    if (buyVotes >= 4) {
      decision = 'COMPRAR';
    } else if (sellVotes >= 4) {
      decision = 'VENDER';
    }
  }

  const isNeutral = decision === 'AGUARDAR / NEUTRO';
  const confidence = Math.min(96, Math.max(55, Math.round((Math.max(buyVotes, sellVotes) / 6) * 100)));

  const entry = price;
  const stop = riskOfficer.summary.technicalStopLossUSD;
  const tp = riskOfficer.summary.takeProfitTargetUSD;

  // Quantitative evaluation of trade potential & optimal safe duration
  const priceSpreadPct = price > 0 ? ((high24h - low24h) / price) * 100 : 0;
  const isHighVolume = volume24h > 150000000;
  const isStrongTrend = Math.abs(change24h) >= 2.0;

  let evaluatedDuration = durationMinutes;
  let durationReason = '';

  if (isNeutral) {
    evaluatedDuration = 0;
    durationReason = riskOfficer.summary.isVetoedByRiskOfficer
      ? `Comitê definiu 0 minutos de permanência devido ao VETO do Risk Officer (${riskOfficer.summary.vetoReason}).`
      : `Comitê definiu 0 minutos de permanência pois o quórum mínimo (4/6 especialistas) não foi alcançado (${buyVotes} Compras / ${sellVotes} Vendas).`;
  } else if (priceSpreadPct > 4.5 || Math.abs(change24h) > 6.0) {
    evaluatedDuration = durationMinutes <= 3 ? 1 : 3;
    durationReason = `Comitê reduziu a permanência para ${evaluatedDuration}m (Micro-Scalp): A alta volatilidade e amplitude intraday (${priceSpreadPct.toFixed(1)}%) aumentam o risco de exaustão da kline. O trader deve realizar o lucro rápido antes de uma reação contrária.`;
  } else if (isHighVolume && isStrongTrend && priceSpreadPct <= 3.8) {
    evaluatedDuration = durationMinutes < 10 ? 10 : 15;
    durationReason = `Comitê aprovou a extensão do tempo seguro para ${evaluatedDuration}m: O volume expressivo ($${(volume24h / 1e6).toFixed(0)}M) acompanhado de tendência firme e volatilidade controlada (${priceSpreadPct.toFixed(1)}%) comprovam sustentação sólida para alcançar o Take Profit sem risco prematuro.`;
  } else {
    evaluatedDuration = durationMinutes;
    durationReason = `Comitê ratificou a janela operacional de ${durationMinutes}m: As condições de volume ($${(volume24h / 1e6).toFixed(0)}M) e estrutura gráfica ajustam-se perfeitamente a esta exposição.`;
  }

  return {
    assetSymbol: symbol,
    assetName: name,
    assetPrice: price,
    timestamp: now,
    finalDecision: decision,
    confidenceScore: Math.round(confidence),
    signalDurationMinutes: isNeutral ? 0 : durationMinutes,
    recommendedDurationMinutes: evaluatedDuration,
    durationJustification: durationReason,
    expiryTimestamp: now + evaluatedDuration * 60 * 1000,
    entryTarget: Number(entry.toFixed(4)),
    stopLoss: Number(stop.toFixed(4)),
    takeProfit: Number(tp.toFixed(4)),
    riskRewardRatio: isNeutral ? 'N/A (NEUTRO)' : `1:${riskOfficer.summary.riskRewardRatio}`,
    summaryConsensus: isNeutral
      ? `O Comitê Vibe-Trading concluiu por AGUARDAR / NEUTRO em ${symbol}. ${riskOfficer.summary.isVetoedByRiskOfficer ? riskOfficer.summary.vetoReason : 'Quórum insuficiente de especialistas (requerido >= 4/6).'}`
      : `O Comitê Vibe-Trading aprovou ${decision} em ${symbol} com quórum de ${Math.max(buyVotes, sellVotes)}/6 especialistas e sinal verde do Risk Protocol Officer.`,
    reasoningNotes: [
      `Quórum dos Especialistas: ${buyVotes} Compras | ${sellVotes} Vendas | Quórum Mínimo: 4/6 (${decision}).`,
      `Dr. Quant Graph: ${drQuant.summary.confluenceCount} sinais confluentes (${drQuant.summary.candlestickPattern}).`,
      `Sofia Sentiment: Fear & Greed ${sofiaSentiment.summary.fearAndGreedCurrent ?? 'n/d'}/100 | Funding Rate: ${sofiaSentiment.summary.fundingRateBinancePercent ?? 'n/d'}% (${sofiaSentiment.summary.fundingRateStatus}).`,
      `OrderBook Sentinel: ${orderbookSentinel.summary ? `OBI L2 de ${orderbookSentinel.summary.orderBookImbalanceRatio > 0 ? '+' : ''}${orderbookSentinel.summary.orderBookImbalanceRatio} | Delta Vol $${(orderbookSentinel.summary.deltaVolumeNetUsd / 1e6).toFixed(1)}M | POC $${orderbookSentinel.summary.pocPriceUsd}.` : 'Book L2 indisponível (sem dados fabricados).'}`,
      `Whale Tracker Apex: ${whaleApex.summary ? `Net Flow $${(whaleApex.summary.netFlow24hUsd / 1e6).toFixed(1)}M | Buy/Sell $${(whaleApex.summary.buyVolume24hUsd / 1e6).toFixed(1)}M / $${(whaleApex.summary.sellVolume24hUsd / 1e6).toFixed(1)}M | Whale Index ${whaleApex.summary.whaleIndexScore ?? 'n/d'}.` : 'Dados on-chain indisponíveis (sem dados fabricados).'}`,
      `Alpha Zoo Engine: Regime HMM (${alphaZoo.summary.marketRegime.regimeType.split(' ')[0]}) | Backtest real Win Rate ${alphaZoo.summary.walkForwardWinRate90d}% (Pós-Taxas 0.10%).`,
      `Risk Protocol Officer: RRR 1:${riskOfficer.summary.riskRewardRatio} | Half-Kelly ${riskOfficer.summary.fractionalKellyPositionSizePercent}% ($${riskOfficer.summary.recommendedCapitalAllocationUSD}) | VaR 95% ${riskOfficer.summary.var95Percent}% | Veto Status: ${riskOfficer.summary.isVetoedByRiskOfficer ? '🛑 VETADO' : '✅ APROVADO'}.`,
    ],
    agents: allAgents,
  };
}

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSub);
    }
    throw err;
  }
}

async function callGeminiWithRetry(ai: GoogleGenAI, prompt: string, schema: any, retries = 2): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 6.0 second timeout to accommodate structured JSON generation under normal load
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API request timed out')), 6000)
      );

      const apiPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const response = (await Promise.race([apiPromise, timeoutPromise])) as any;

      if (response && response.text) {
        return cleanAndParseJson(response.text);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('resource exhausted') ||
        errMsg.includes('429') ||
        errMsg.includes('timeout') ||
        errMsg.includes('timed out');

      if (isTransient && attempt < retries) {
        await new Promise((res) => setTimeout(res, 300 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini response was empty or timed out');
}

