import { describe, it, expect } from 'vitest';
import { degradedAgent } from './committeePrompt.js';

describe('degradedAgent - reporte DEGRADADO honesto', () => {
  it('com motivo explícito reporta a causa real e nunca alega timeout falso', () => {
    const report = degradedAgent('technical', 'gemini', 'agente omitido na resposta do provedor');
    expect(report.agentId).toBe('technical');
    expect(report.status).toBe('DEGRADADO');
    expect(report.provider).toBe('gemini');
    expect(report.opinion).toBe('AGUARDAR / NEUTRO');
    expect(report.score).toBe(50);
    expect(report.summary).toContain('agente omitido na resposta do provedor');
    expect(report.summary).toContain('Sem dados fabricados; voto com peso reduzido.');
    expect(report.summary).not.toContain('não respondeu no prazo');
    expect(report.keyMetrics).toEqual([]);
    expect(report.signals).toEqual([]);
    expect(report.processingTimeMs).toBe(0);
  });

  it('sem motivo usa texto padrão honesto (não alega timeout)', () => {
    const report = degradedAgent('whales', 'deepseek');
    expect(report.provider).toBe('deepseek');
    expect(report.summary).toContain('provedor DeepSeek falhou sem motivo informado.');
    expect(report.summary).toContain('Sem dados fabricados; voto com peso reduzido.');
    expect(report.summary).not.toContain('não respondeu no prazo');
  });

  it('mantém identidade (nome/role) do agente pelo AGENT_META', () => {
    const report = degradedAgent('risk', 'groq');
    expect(report.agentName).toBe('Risk Protocol Officer');
    expect(report.agentRole).toBe('Gerenciamento de Risco & Parâmetros');
    expect(report.veto).toBeUndefined();
  });
});
