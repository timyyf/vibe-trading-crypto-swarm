import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCryptoWithSwarm } from './geminiService.js';
import { AgentReport } from '../types.js';

const BASE_MARKET = {
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 96000,
  change24h: 2.5,
  volume24h: 32000000000,
  high24h: 97500,
  low24h: 94000,
};

// Bloco JSON mínimo que um LLM OpenAI-compatível retornaria.
function llmPayload(agentIds: string[]): string {
  const agents = agentIds.map((id, idx) => ({
    agentId: id,
    agentName: `Especialista ${id}`,
    agentRole: 'Especialista de Mercado',
    opinion: idx % 2 === 0 ? 'COMPRAR' : 'AGUARDAR / NEUTRO',
    score: 60 + idx * 5,
    summary: `Parecer do especialista ${id}`,
    keyMetrics: [],
    signals: [],
  }));
  return JSON.stringify({ finalDecision: 'COMPRAR', confidenceScore: 70, agents });
}

// Fake Response compatível com o fetch do Node/Undici.
function fakeOkResponse(content: string): Response {
  const body = JSON.stringify({
    choices: [{ message: { content } }],
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function fakeErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: { message: `erro ${status}` } }), { status });
}

describe('analyzeCryptoWithSwarm — modo híbrido Groq + DeepSeek', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  let groqCalls: string[] = [];
  let deepseekCalls: string[] = [];

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.HYBRID_BUDGET_MS = '12000';
    groqCalls = [];
    deepseekCalls = [];

    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const agentIdsMatch = url.includes('api.groq.com')
        ? groqCalls
        : url.includes('api.deepseek.com')
        ? deepseekCalls
        : null;
      if (!agentIdsMatch) return fakeErrorResponse(404);
      // Extrai o subset de agentes do prompt (linha "com estes agentId exatos:").
      const bodyText = typeof init?.body === 'string' ? init.body : '';
      const match = bodyText.match(/agentId exatos: ([^\.]+)\./);
      const ids = match ? match[1].replace(/[\\"]/g, '').split(',').map((s) => s.trim()) : [];
      agentIdsMatch.push(ids.join(','));
      return fakeOkResponse(llmPayload(ids));
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('quando DeepSeek falha, o Groq assume os 3 especialistas dele (engine groq, 6/6 CONCLUÍDO)', async () => {
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.groq.com')) {
        const bodyText = typeof init?.body === 'string' ? init.body : '';
        const match = bodyText.match(/agentId exatos: ([^\.]+)\./);
        const ids = match ? match[1].replace(/[\\"]/g, '').split(',').map((s) => s.trim()) : [];
        groqCalls.push(ids.join(','));
        return fakeOkResponse(llmPayload(ids));
      }
      if (url.includes('api.deepseek.com')) {
        deepseekCalls.push('deepseek');
        return fakeErrorResponse(401); // chave inválida / saldo
      }
      return fakeErrorResponse(404);
    }) as any;

    const result = await analyzeCryptoWithSwarm(
      BASE_MARKET.symbol,
      BASE_MARKET.name,
      BASE_MARKET.price,
      BASE_MARKET.change24h,
      BASE_MARKET.volume24h,
      BASE_MARKET.high24h,
      BASE_MARKET.low24h
    );

    // DeepSeek foi chamado e falhou; Groq foi chamado 2x (3 iniciais + 3 substitutos).
    expect(deepseekCalls).toHaveLength(1);
    expect(groqCalls).toHaveLength(2);
    expect(groqCalls[0]).toBe('technical,sentiment,orderbook');
    expect(groqCalls[1]).toBe('whales,alpha,risk');

    expect(result.engineSource).toBe('groq');
    expect(result.agents).toHaveLength(6);
    const concluded = result.agents.filter((a) => a.status === 'CONCLUÍDO');
    const degraded = result.agents.filter((a) => a.status === 'DEGRADADO');
    expect(concluded).toHaveLength(6);
    expect(degraded).toHaveLength(0);
    expect(result.agents.every((a) => a.provider === 'groq')).toBe(true);
  });

  it('quando ambos respondem, mantém híbrido Groq + DeepSeek', async () => {
    const result = await analyzeCryptoWithSwarm(
      BASE_MARKET.symbol,
      BASE_MARKET.name,
      BASE_MARKET.price,
      BASE_MARKET.change24h,
      BASE_MARKET.volume24h,
      BASE_MARKET.high24h,
      BASE_MARKET.low24h
    );

    expect(groqCalls).toHaveLength(1);
    expect(deepseekCalls).toHaveLength(1);
    expect(result.engineSource).toBe('hybrid');
    expect(result.agents).toHaveLength(6);
    expect(result.agents.filter((a) => a.provider === 'groq')).toHaveLength(3);
    expect(result.agents.filter((a) => a.provider === 'deepseek')).toHaveLength(3);
    expect(result.agents.every((a) => a.status === 'CONCLUÍDO')).toBe(true);
  });

  it('quando Groq falha mas DeepSeek responde, retorna híbrido com 3 DEGRADADO', async () => {
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.groq.com')) {
        groqCalls.push('groq');
        return fakeErrorResponse(500);
      }
      if (url.includes('api.deepseek.com')) {
        const bodyText = typeof init?.body === 'string' ? init.body : '';
        const match = bodyText.match(/agentId exatos: ([^\.]+)\./);
        const ids = match ? match[1].replace(/[\\"]/g, '').split(',').map((s) => s.trim()) : [];
        deepseekCalls.push(ids.join(','));
        return fakeOkResponse(llmPayload(ids));
      }
      return fakeErrorResponse(404);
    }) as any;

    const result = await analyzeCryptoWithSwarm(
      BASE_MARKET.symbol,
      BASE_MARKET.name,
      BASE_MARKET.price,
      BASE_MARKET.change24h,
      BASE_MARKET.volume24h,
      BASE_MARKET.high24h,
      BASE_MARKET.low24h
    );

    expect(result.engineSource).toBe('hybrid');
    expect(result.agents).toHaveLength(6);
    expect(result.agents.filter((a) => a.provider === 'groq' && a.status === 'DEGRADADO')).toHaveLength(3);
    expect(result.agents.filter((a) => a.provider === 'deepseek' && a.status === 'CONCLUÍDO')).toHaveLength(3);
  });
});
