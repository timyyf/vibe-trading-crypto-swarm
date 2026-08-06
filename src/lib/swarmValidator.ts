import { SwarmAnalysisResult, TradeDecision, AgentReport, KeyMetric } from '../types';

export interface FieldValidationReport {
  field: string;
  expectedType: string;
  actualType: string;
  value: any;
  status: 'PASS' | 'FAIL' | 'HEALED';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reports: FieldValidationReport[];
  sanitized: SwarmAnalysisResult;
}

export interface TestCaseResult {
  testId: string;
  name: string;
  description: string;
  passed: boolean;
  durationMs: number;
  reports: FieldValidationReport[];
  errors: string[];
  outputSample: any;
}

export interface SwarmTestSuiteResult {
  timestamp: number;
  totalTests: number;
  passCount: number;
  failCount: number;
  allPassed: boolean;
  cases: TestCaseResult[];
}

/**
 * Validates and sanitizes a Swarm Analysis payload.
 * Ensures strict type compliance and auto-heals corrupted fields to prevent UI crashes.
 */
export function validateAndSanitizeSwarmResponse(raw: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const reports: FieldValidationReport[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['O payload retornado é nulo ou não é um objeto JSON válido.'],
      warnings: [],
      reports: [
        {
          field: 'root',
          expectedType: 'object',
          actualType: typeof raw,
          value: raw,
          status: 'FAIL',
          message: 'Payload raiz inválido.',
        },
      ],
      sanitized: getFallbackSwarmResult('BTC', 'Bitcoin', 50000),
    };
  }

  // Helper for field checking
  const checkField = (
    field: string,
    val: any,
    expectedType: 'string' | 'number' | 'boolean' | 'array' | 'object',
    defaultValue: any,
    validatorFn?: (v: any) => boolean
  ): { value: any; report: FieldValidationReport } => {
    let actualType: string = typeof val;
    if (Array.isArray(val)) actualType = 'array';
    if (val === null) actualType = 'null';

    let isTypeCorrect = actualType === expectedType;
    if (expectedType === 'number' && actualType === 'string' && !isNaN(Number(val))) {
      // Auto-heal string to number
      val = Number(val);
      isTypeCorrect = true;
    }

    let isValid = isTypeCorrect;
    if (isValid && validatorFn) {
      isValid = validatorFn(val);
    }

    if (!isValid) {
      if (val === undefined || val === null) {
        errors.push(`Campo obrigatório ausente: '${field}'. Aplicando valor padrão seguro.`);
      } else {
        errors.push(`Tipo/Valor inválido em '${field}': esperado ${expectedType}, recebido ${actualType} (${JSON.stringify(val)}).`);
      }

      return {
        value: defaultValue,
        report: {
          field,
          expectedType,
          actualType,
          value: val,
          status: 'HEALED',
          message: `Corrigido para default (${JSON.stringify(defaultValue)})`,
        },
      };
    }

    return {
      value: val,
      report: {
        field,
        expectedType,
        actualType,
        value: val,
        status: 'PASS',
        message: 'Tipo e formato válidos',
      },
    };
  };

  // 1. Asset Info
  const fSymbol = checkField('assetSymbol', raw.assetSymbol, 'string', 'BTC', (v) => v.length > 0);
  reports.push(fSymbol.report);

  const fName = checkField('assetName', raw.assetName, 'string', fSymbol.value, (v) => v.length > 0);
  reports.push(fName.report);

  const fPrice = checkField('assetPrice', raw.assetPrice, 'number', 0, (v) => v >= 0);
  reports.push(fPrice.report);

  const fTimestamp = checkField('timestamp', raw.timestamp, 'number', Date.now(), (v) => v > 0);
  reports.push(fTimestamp.report);

  // 2. Decision & Confidence
  const validDecisions: TradeDecision[] = ['COMPRAR', 'VENDER', 'AGUARDAR / NEUTRO'];
  const fDecision = checkField('finalDecision', raw.finalDecision, 'string', 'AGUARDAR / NEUTRO', (v) => validDecisions.includes(v as any));
  reports.push(fDecision.report);

  const isNeutral = fDecision.value === 'AGUARDAR / NEUTRO';

  const fConfidence = checkField('confidenceScore', raw.confidenceScore, 'number', 75, (v) => v >= 0 && v <= 100);
  reports.push(fConfidence.report);

  // 3. Durations
  const expectedDuration = isNeutral ? 0 : 5;
  const fSignalDuration = checkField('signalDurationMinutes', raw.signalDurationMinutes, 'number', expectedDuration, (v) => v >= 0);
  reports.push(fSignalDuration.report);

  const fRecDuration = checkField('recommendedDurationMinutes', raw.recommendedDurationMinutes, 'number', fSignalDuration.value, (v) => v >= 0);
  reports.push(fRecDuration.report);

  const fJustification = checkField('durationJustification', raw.durationJustification, 'string', 'Análise de tempo do comitê concluída.', (v) => v.length > 0);
  reports.push(fJustification.report);

  const fExpiry = checkField('expiryTimestamp', raw.expiryTimestamp, 'number', Date.now() + fRecDuration.value * 60000, (v) => v > 0);
  reports.push(fExpiry.report);

  // 4. Targets & Risk
  const fEntry = checkField('entryTarget', raw.entryTarget, 'number', fPrice.value, (v) => v >= 0);
  reports.push(fEntry.report);

  const fStop = checkField('stopLoss', raw.stopLoss, 'number', fPrice.value * 0.98, (v) => v >= 0);
  reports.push(fStop.report);

  const fTP = checkField('takeProfit', raw.takeProfit, 'number', fPrice.value * 1.03, (v) => v >= 0);
  reports.push(fTP.report);

  const fRR = checkField('riskRewardRatio', raw.riskRewardRatio, 'string', '1:2.0', (v) => v.length > 0);
  reports.push(fRR.report);

  const fConsensus = checkField('summaryConsensus', raw.summaryConsensus, 'string', 'Resumo de consenso do comitê.', (v) => v.length > 0);
  reports.push(fConsensus.report);

  // 5. Reasoning Notes
  const fNotes = checkField('reasoningNotes', raw.reasoningNotes, 'array', ['Análise técnica realizada'], (v) => v.every((i: any) => typeof i === 'string'));
  reports.push(fNotes.report);

  // 6. Agents array validation
  let sanitizedAgents: AgentReport[] = [];
  if (!Array.isArray(raw.agents)) {
    errors.push("Campo 'agents' deve ser uma lista (array). Gerando lista padrão de agentes.");
    reports.push({
      field: 'agents',
      expectedType: 'array',
      actualType: typeof raw.agents,
      value: raw.agents,
      status: 'HEALED',
      message: 'Substituído por agentes padrão.',
    });
    sanitizedAgents = getDefaultAgents();
  } else {
    reports.push({
      field: 'agents',
      expectedType: 'array',
      actualType: 'array',
      value: `${raw.agents.length} agentes`,
      status: 'PASS',
      message: `${raw.agents.length} especialistas identificados.`,
    });

    sanitizedAgents = raw.agents.map((ag: any, idx: number) => {
      const validAgentIds = ['technical', 'sentiment', 'whales', 'alpha'];
      const agentId = validAgentIds.includes(ag?.agentId) ? ag.agentId : (['technical', 'sentiment', 'whales', 'alpha'][idx % 4] as any);
      const agentName = typeof ag?.agentName === 'string' ? ag.agentName : `Agente ${idx + 1}`;
      const agentRole = typeof ag?.agentRole === 'string' ? ag.agentRole : 'Especialista de Mercado';
      const opinion = validDecisions.includes(ag?.opinion) ? ag.opinion : 'AGUARDAR / NEUTRO';
      const score = typeof ag?.score === 'number' ? Math.min(100, Math.max(0, ag.score)) : 70;
      const summary = typeof ag?.summary === 'string' ? ag.summary : 'Análise individual concluída.';
      const avatarIcon = typeof ag?.avatarIcon === 'string' ? ag.avatarIcon : 'Activity';
      const specialistType = typeof ag?.specialistType === 'string' ? ag.specialistType : 'Analista Quantitativo';
      
      const keyMetrics: KeyMetric[] = Array.isArray(ag?.keyMetrics)
        ? ag.keyMetrics.map((km: any) => ({
            label: String(km?.label || 'Métrica'),
            value: String(km?.value || 'N/A'),
            status: ['positive', 'negative', 'neutral'].includes(km?.status) ? km.status : 'neutral',
          }))
        : [{ label: 'Status', value: 'OK', status: 'neutral' }];

      const signals: string[] = Array.isArray(ag?.signals)
        ? ag.signals.map((s: any) => String(s))
        : ['Sinal neutro identificado'];

      return {
        agentId,
        agentName,
        agentRole,
        specialistType,
        avatarIcon,
        opinion,
        score,
        summary,
        keyMetrics,
        signals,
        processingTimeMs: typeof ag?.processingTimeMs === 'number' ? ag.processingTimeMs : 150 + idx * 20,
        status: ag?.status || 'CONCLUÍDO',
      };
    });
  }

  const sanitized: SwarmAnalysisResult = {
    assetSymbol: fSymbol.value,
    assetName: fName.value,
    assetPrice: fPrice.value,
    timestamp: fTimestamp.value,
    finalDecision: fDecision.value,
    confidenceScore: fConfidence.value,
    signalDurationMinutes: isNeutral ? 0 : fSignalDuration.value,
    recommendedDurationMinutes: isNeutral ? 0 : fRecDuration.value,
    durationJustification: fJustification.value,
    expiryTimestamp: isNeutral ? fTimestamp.value : fExpiry.value,
    entryTarget: fEntry.value,
    stopLoss: fStop.value,
    takeProfit: fTP.value,
    riskRewardRatio: fRR.value,
    summaryConsensus: fConsensus.value,
    reasoningNotes: fNotes.value,
    agents: sanitizedAgents,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reports,
    sanitized,
  };
}

/**
 * Default fallback object generator
 */
export function getFallbackSwarmResult(symbol: string, name: string, price: number): SwarmAnalysisResult {
  return {
    assetSymbol: symbol,
    assetName: name,
    assetPrice: price,
    timestamp: Date.now(),
    finalDecision: 'AGUARDAR / NEUTRO',
    confidenceScore: 70,
    signalDurationMinutes: 0,
    recommendedDurationMinutes: 0,
    durationJustification: 'Mercado em transição. Janela de tempo definida como 0 min por segurança.',
    expiryTimestamp: Date.now(),
    entryTarget: price,
    stopLoss: price * 0.98,
    takeProfit: price * 1.02,
    riskRewardRatio: 'N/A (NEUTRO)',
    summaryConsensus: `O Comitê concluiu por AGUARDAR / NEUTRO em ${symbol}.`,
    reasoningNotes: ['Sem viés direcional claro', 'Aguardando rompimento de consolidação'],
    agents: getDefaultAgents(),
  };
}

export function getDefaultAgents(): AgentReport[] {
  return [
    {
      agentId: 'technical',
      agentName: 'SOPHIA-9',
      agentRole: 'Análise Técnica & Chartismo',
      specialistType: 'Técnico',
      avatarIcon: 'Activity',
      opinion: 'AGUARDAR / NEUTRO',
      score: 70,
      summary: 'Médias móveis alinhadas horizontalmente.',
      keyMetrics: [{ label: 'RSI (14)', value: '51.2', status: 'neutral' }],
      signals: ['RSI Neutro'],
      processingTimeMs: 140,
      status: 'CONCLUÍDO',
    },
    {
      agentId: 'sentiment',
      agentName: 'AURA-X',
      agentRole: 'Sentimento de Redes & Notícias',
      specialistType: 'Analista de Sentimento',
      avatarIcon: 'MessageSquare',
      opinion: 'AGUARDAR / NEUTRO',
      score: 68,
      summary: 'Sentimento de redes sociais equilibrado sem picos de euforia.',
      keyMetrics: [{ label: 'Fear & Greed', value: '55/100', status: 'neutral' }],
      signals: ['Sem volatilidade social'],
      processingTimeMs: 210,
      status: 'CONCLUÍDO',
    },
    {
      agentId: 'whales',
      agentName: 'NEXUS-WHALE',
      agentRole: 'Rastreamento On-Chain & Baleias',
      specialistType: 'Fundamentalista',
      avatarIcon: 'Database',
      opinion: 'AGUARDAR / NEUTRO',
      score: 72,
      summary: 'Grandes carteiras sem movimentações expressivas nas últimas horas.',
      keyMetrics: [{ label: 'Exchange Netflow', value: '+$1.2M', status: 'neutral' }],
      signals: ['Netflow estável'],
      processingTimeMs: 175,
      status: 'CONCLUÍDO',
    },
    {
      agentId: 'alpha',
      agentName: 'ALPHA-QUANT',
      agentRole: 'Análise de Fatores Quantitativos',
      specialistType: 'Quant Factor',
      avatarIcon: 'Zap',
      opinion: 'AGUARDAR / NEUTRO',
      score: 74,
      summary: 'Modelo estatístico indica baixa assimetria para posições direcionais.',
      keyMetrics: [{ label: 'Sharpe Estimado', value: '1.45', status: 'neutral' }],
      signals: ['Ratio Sharpe baixo'],
      processingTimeMs: 190,
      status: 'CONCLUÍDO',
    },
  ];
}

/**
 * Runs automated unit test suite verifying live /api/swarm/analyze endpoint or mock payloads.
 */
export async function runSwarmTestSuite(fetchFn?: (payload: any) => Promise<any>): Promise<SwarmTestSuiteResult> {
  const cases: TestCaseResult[] = [];

  // Case 1: Standard COMPRAR scenario
  const t1Start = performance.now();
  const mockComprar = {
    assetSymbol: 'BTC',
    assetName: 'Bitcoin',
    assetPrice: 65000,
    timestamp: Date.now(),
    finalDecision: 'COMPRAR',
    confidenceScore: 88,
    signalDurationMinutes: 5,
    recommendedDurationMinutes: 10,
    durationJustification: 'Volume forte suporta extensão para 10 minutos',
    expiryTimestamp: Date.now() + 600000,
    entryTarget: 65000,
    stopLoss: 64000,
    takeProfit: 67000,
    riskRewardRatio: '1:2.0',
    summaryConsensus: 'Comitê unânime na compra com breakout de resistência.',
    reasoningNotes: ['MACD cruzou para cima', 'Volume 2x acima da média'],
    agents: getDefaultAgents().map((a) => ({ ...a, opinion: 'COMPRAR' as TradeDecision })),
  };
  const val1 = validateAndSanitizeSwarmResponse(mockComprar);
  cases.push({
    testId: 'TEST-01',
    name: 'Schema Payload de Decisão COMPRAR',
    description: 'Valida se todos os tipos numéricos, strings e decisão COMPRAR são parsed sem erros ou healings.',
    passed: val1.valid,
    durationMs: Math.round(performance.now() - t1Start),
    reports: val1.reports,
    errors: val1.errors,
    outputSample: val1.sanitized,
  });

  // Case 2: Neutral Scenario (0 duration verification)
  const t2Start = performance.now();
  const mockNeutro = {
    assetSymbol: 'ETH',
    assetName: 'Ethereum',
    assetPrice: 3500,
    timestamp: Date.now(),
    finalDecision: 'AGUARDAR / NEUTRO',
    confidenceScore: 72,
    signalDurationMinutes: 0,
    recommendedDurationMinutes: 0,
    durationJustification: 'Mercado em consolidação. 0 min de tempo seguro.',
    expiryTimestamp: Date.now(),
    entryTarget: 3500,
    stopLoss: 3430,
    takeProfit: 3570,
    riskRewardRatio: 'N/A (NEUTRO)',
    summaryConsensus: 'Comitê indica prudência e neutralidade.',
    reasoningNotes: ['Consolidação em retângulo'],
    agents: getDefaultAgents(),
  };
  const val2 = validateAndSanitizeSwarmResponse(mockNeutro);
  const neutralDurationPassed = val2.sanitized.signalDurationMinutes === 0 && val2.sanitized.recommendedDurationMinutes === 0;
  cases.push({
    testId: 'TEST-02',
    name: 'Regra de Decisão NEUTRA (Duração Zero)',
    description: 'Valida se o schema garante 0 minutos de permanência quando a decisão é AGUARDAR / NEUTRO.',
    passed: val2.valid && neutralDurationPassed,
    durationMs: Math.round(performance.now() - t2Start),
    reports: val2.reports,
    errors: val2.errors,
    outputSample: val2.sanitized,
  });

  // Case 3: Corrupted / Partial payload auto-healing test
  const t3Start = performance.now();
  const mockCorrupted = {
    assetSymbol: 'SOL',
    assetPrice: '145.50', // string price (should auto-heal to number)
    finalDecision: 'INVALID_DECISION', // invalid decision enum (should heal to NEUTRO)
    confidenceScore: 150, // out of bounds confidence score (> 100)
    agents: 'not-an-array', // corrupted agents field
  };
  const val3 = validateAndSanitizeSwarmResponse(mockCorrupted);
  cases.push({
    testId: 'TEST-03',
    name: 'Resiliência a Payloads Incompletos/Corrompidos',
    description: 'Valida a capacidade de Auto-Healing contra string em números, decisão inválida e agentes corrompidos.',
    passed: val3.sanitized.assetPrice === 145.5 && val3.sanitized.finalDecision === 'AGUARDAR / NEUTRO' && Array.isArray(val3.sanitized.agents),
    durationMs: Math.round(performance.now() - t3Start),
    reports: val3.reports,
    errors: val3.errors,
    outputSample: val3.sanitized,
  });

  // Case 4: Live HTTP API Call Test (/api/swarm/analyze)
  const t4Start = performance.now();
  if (fetchFn) {
    try {
      const liveData = await fetchFn({
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 65000,
        change24h: 2.5,
        volume24h: 30000000000,
        high24h: 66000,
        low24h: 64000,
        signalDurationMinutes: 5,
      });

      const val4 = validateAndSanitizeSwarmResponse(liveData?.data || liveData);
      cases.push({
        testId: 'TEST-04',
        name: 'Integração HTTP Live (/api/swarm/analyze)',
        description: 'Chama a rota real da API backend para validar o contrato JSON de resposta em tempo real.',
        passed: val4.valid,
        durationMs: Math.round(performance.now() - t4Start),
        reports: val4.reports,
        errors: val4.errors,
        outputSample: val4.sanitized,
      });
    } catch (err: any) {
      cases.push({
        testId: 'TEST-04',
        name: 'Integração HTTP Live (/api/swarm/analyze)',
        description: 'Chama a rota real da API backend para validar o contrato JSON de resposta em tempo real.',
        passed: false,
        durationMs: Math.round(performance.now() - t4Start),
        reports: [],
        errors: [`Falha na requisição HTTP: ${err?.message || String(err)}`],
        outputSample: null,
      });
    }
  }

  const passCount = cases.filter((c) => c.passed).length;
  return {
    timestamp: Date.now(),
    totalTests: cases.length,
    passCount,
    failCount: cases.length - passCount,
    allPassed: passCount === cases.length,
    cases,
  };
}
