import { AgentReport } from '../types';
import { AgentAgentId, buildCommitteePrompt, degradedAgent, normalizeAgents } from './committeePrompt.js';

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

export interface RunGroqAgentsParams {
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
}

export async function runGroqAgents(params: RunGroqAgentsParams): Promise<AgentReport[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não configurada');
  }

  const prompt = buildCommitteePrompt({
    ...params,
    providerLabel: 'Groq',
  });

  const parsed = await callGroqWithRetry(apiKey, prompt, 2);
  const agents = normalizeAgents(parsed?.agents, 'groq', params.agentIds);

  // Garante cobertura completa dos agentes solicitados (LLM pode omitir algum).
  const present = new Set(agents.map((a) => a.agentId));
  for (const id of params.agentIds) {
    if (!present.has(id)) {
      agents.push(degradedAgent(id, 'groq'));
    }
  }

  return agents;
}

// Chamada OpenAI-compatível (Groq usa o mesmo contrato do DeepSeek) com timeout
// de 20s + retry em erros transitórios. Groq é rápido (~2.5s) — 20s é folga segura.
async function callGroqWithRetry(apiKey: string, prompt: string, retries = 2): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'Você é o ORQUESTRADOR CENTRAL do Comitê Vibe-Trading (HKU Data Science / Institutional Wall Street Framework). ' +
                'Responda APENAS com JSON válido, sem markdown, sem comentários e sem texto fora do JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (res.status === 402) {
          throw new Error('saldo insuficiente na conta Groq (HTTP 402)');
        }
        throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 300)}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return cleanAndParseJson(content);
      }
      throw new Error('Groq resposta vazia');
    } catch (err: any) {
      clearTimeout(timer);
      const errMsg = err?.message || String(err);
      const isTransient =
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('500') ||
        errMsg.includes('timeout') ||
        errMsg.includes('aborted') ||
        errMsg.includes('fetch failed');

      if (isTransient && attempt < retries) {
        await new Promise((res) => setTimeout(res, 300 * attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Groq não retornou resposta válida');
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
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    throw err;
  }
}
