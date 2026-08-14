import React, { useState, useEffect, useRef } from 'react';
import {
  Bug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  FileCode2,
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  X,
  Code2
} from 'lucide-react';
import {
  runSwarmTestSuite,
  validateAndSanitizeSwarmResponse,
  SwarmTestSuiteResult,
  ValidationResult
} from '../lib/swarmValidator';

interface SwarmDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastAnalysisResult?: any;
}

export const SwarmDebugModal: React.FC<SwarmDebugModalProps> = ({
  isOpen,
  onClose,
  lastAnalysisResult,
}) => {
  const [activeTab, setActiveTab] = useState<'TEST_SUITE' | 'LIVE_INSPECTOR' | 'CUSTOM_JSON'>('TEST_SUITE');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<SwarmTestSuiteResult | null>(null);
  const [customJsonInput, setCustomJsonInput] = useState<string>('');
  const [customValidation, setCustomValidation] = useState<ValidationResult | null>(null);
  const [lastAnalysisValidation, setLastAnalysisValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (lastAnalysisResult) {
      const val = validateAndSanitizeSwarmResponse(lastAnalysisResult);
      setLastAnalysisValidation(val);
      setCustomJsonInput(JSON.stringify(lastAnalysisResult, null, 2));
    }
  }, [lastAnalysisResult]);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunSuite = async () => {
    setIsRunning(true);
    try {
      const fetchFn = async (payload: any) => {
        const res = await fetch('/api/swarm/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        return json;
      };

      const suite = await runSwarmTestSuite(fetchFn);
      setTestResults(suite);
    } catch (err) {
      console.error('Error running debug test suite:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleValidateCustomJson = (text: string) => {
    setCustomJsonInput(text);
    try {
      const parsed = JSON.parse(text);
      const val = validateAndSanitizeSwarmResponse(parsed);
      setCustomValidation(val);
    } catch (err: any) {
      setCustomValidation({
        valid: false,
        errors: [`JSON com erro de sintaxe: ${err?.message || String(err)}`],
        warnings: [],
        reports: [],
        sanitized: {} as any,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swarm-debug-title"
        tabIndex={-1}
        className="bg-[#121418] border border-[#24272C] rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden outline-none"
      >
        {/* Modal Header */}
        <div className="p-4 bg-[#181B20] border-b border-[#24272C] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 id="swarm-debug-title" className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <span>Depurador & Validador de Schema API</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  /api/swarm/analyze
                </span>
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Suíte de testes automatizados e validação em tempo real da estrutura JSON do comitê de IA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar depurador"
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#24272C] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-4 pt-3 bg-[#121418] border-b border-[#24272C] flex items-center gap-2">
          <button
            onClick={() => setActiveTab('TEST_SUITE')}
            className={`px-3 py-2 text-xs font-mono font-bold rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'TEST_SUITE'
                ? 'border-emerald-400 text-emerald-400 bg-[#181B20]'
                : 'border-transparent text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Suíte de Testes Unitários ({testResults ? `${testResults.passCount}/${testResults.totalTests}` : 'Pronta'})</span>
          </button>

          <button
            onClick={() => setActiveTab('LIVE_INSPECTOR')}
            className={`px-3 py-2 text-xs font-mono font-bold rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'LIVE_INSPECTOR'
                ? 'border-emerald-400 text-emerald-400 bg-[#181B20]'
                : 'border-transparent text-[#9CA3AF] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Inspetor da Última Resposta</span>
            {lastAnalysisValidation && (
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                lastAnalysisValidation.valid
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {lastAnalysisValidation.valid ? 'SCHEMA OK' : 'AUTO-HEALED'}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CUSTOM_JSON')}
            className={`px-3 py-2 text-xs font-mono font-bold rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'CUSTOM_JSON'
                ? 'border-emerald-400 text-emerald-400 bg-[#181B20]'
                : 'border-transparent text-[#9CA3AF] hover:text-white'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Testar JSON Customizado</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: TEST SUITE */}
          {activeTab === 'TEST_SUITE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#181B20] border border-[#24272C] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Suíte de Testes Automatizados da API
                  </h3>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    Executa validações contra casos de borda: payloads COMPRAR, NEUTRO (duração 0), payloads corrompidos e rota live /api/swarm/analyze.
                  </p>
                </div>

                <button
                  onClick={handleRunSuite}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
                >
                  {isRunning ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Executando Testes...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-black" />
                      <span>Executar Testes de Schema</span>
                    </>
                  )}
                </button>
              </div>

              {testResults && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#181B20] border border-[#24272C] text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-[#9CA3AF]">Status Geral:</span>
                      <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                        testResults.allPassed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {testResults.allPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{testResults.allPassed ? 'TODOS OS TESTES PASSARAM' : 'FALHA EM ALGUNS TESTES'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[#9CA3AF]">
                      <span>Passaram: <strong className="text-emerald-400">{testResults.passCount}</strong></span>
                      <span>Falharam: <strong className="text-rose-400">{testResults.failCount}</strong></span>
                      <span>Total: <strong>{testResults.totalTests}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {testResults.cases.map((c) => (
                      <div
                        key={c.testId}
                        className="p-3.5 rounded-xl bg-[#181B20] border border-[#24272C] space-y-2 font-mono text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">{c.testId}:</span>
                            <span className="font-bold text-white">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#6B7280]">{c.durationMs}ms</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.passed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {c.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[#9CA3AF] text-[11px] font-sans">{c.description}</p>

                        {c.errors.length > 0 && (
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-900/50 text-rose-300 space-y-1">
                            <div className="font-bold flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Erros/Inconformidades Detectadas:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                              {c.errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {c.reports.length > 0 && (
                          <div className="overflow-x-auto pt-1">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="text-[#6B7280] border-b border-[#24272C]">
                                  <th className="py-1 px-2">Campo</th>
                                  <th className="py-1 px-2">Esperado</th>
                                  <th className="py-1 px-2">Recebido</th>
                                  <th className="py-1 px-2">Status</th>
                                  <th className="py-1 px-2">Ação/Mensagem</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.reports.slice(0, 8).map((r, i) => (
                                  <tr key={i} className="border-b border-[#24272C]/40 text-[#D1D5DB]">
                                    <td className="py-1 px-2 font-bold text-emerald-300">{r.field}</td>
                                    <td className="py-1 px-2 text-[#9CA3AF]">{r.expectedType}</td>
                                    <td className="py-1 px-2 text-[#9CA3AF]">{r.actualType}</td>
                                    <td className="py-1 px-2">
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        r.status === 'PASS'
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-amber-500/20 text-amber-400'
                                      }`}>
                                        {r.status}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2 text-[#9CA3AF]">{r.message}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE INSPECTOR */}
          {activeTab === 'LIVE_INSPECTOR' && (
            <div className="space-y-4">
              {!lastAnalysisResult ? (
                <div className="p-8 text-center rounded-xl bg-[#181B20] border border-[#24272C] space-y-2">
                  <Activity className="w-8 h-8 text-[#6B7280] mx-auto animate-pulse" />
                  <p className="text-xs font-mono text-white font-bold">Nenhuma análise executada na sessão atual.</p>
                  <p className="text-xs text-[#9CA3AF]">
                    Clique em "EXECUTAR REUNIÃO SWARM" na tela principal para inspecionar a estrutura JSON em tempo real.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-[#181B20] border border-[#24272C] flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">Último Resultado Inspecionado:</span>
                      <span className="text-[#9CA3AF] text-[11px]">
                        Ativo: <strong className="text-emerald-400">{lastAnalysisResult.assetSymbol}</strong> | Decisão: <strong className="text-amber-400">{lastAnalysisResult.finalDecision}</strong>
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded font-bold text-xs ${
                      lastAnalysisValidation?.valid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {lastAnalysisValidation?.valid ? '✓ VALIDAÇÃO 100% CORRETA' : '⚠ AUTO-CORRIGIDO COM SUCESSO'}
                    </span>
                  </div>

                  {lastAnalysisValidation && lastAnalysisValidation.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-amber-300 space-y-1">
                      <span className="font-bold block">Avisos de Higienização de Schema:</span>
                      <ul className="list-disc list-inside text-[11px] space-y-0.5">
                        {lastAnalysisValidation.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-[#0A0B0D] border border-[#24272C] overflow-x-auto max-h-96">
                    <pre className="text-emerald-400 text-[11px] leading-relaxed">
                      {JSON.stringify(lastAnalysisValidation?.sanitized || lastAnalysisResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM JSON */}
          {activeTab === 'CUSTOM_JSON' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-xl bg-[#181B20] border border-[#24272C]">
                <label className="block font-bold text-white mb-1.5 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span>Cole um Payload JSON para Teste de Validação:</span>
                </label>
                <textarea
                  value={customJsonInput}
                  onChange={(e) => handleValidateCustomJson(e.target.value)}
                  placeholder='{"assetSymbol": "BTC", "assetPrice": 65000, "finalDecision": "COMPRAR", ...}'
                  className="w-full h-48 p-3 bg-[#0A0B0D] border border-[#24272C] rounded-lg text-emerald-400 text-[11px] focus:outline-none focus:border-emerald-500/50 resize-y font-mono"
                />
              </div>

              {customValidation && (
                <div className="p-4 rounded-xl bg-[#181B20] border border-[#24272C] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Resultado do Validador:</span>
                    <span className={`px-2.5 py-1 rounded font-bold text-xs ${
                      customValidation.valid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {customValidation.valid ? 'VALID' : 'INVALID / HEALED'}
                    </span>
                  </div>

                  {customValidation.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-300 text-[11px] space-y-1">
                      <span className="font-bold block">Inconformidades com o Schema:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {customValidation.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-[#0A0B0D] border border-[#24272C]">
                    <span className="text-[#9CA3AF] text-[10px] block mb-1">Objeto Higienizado para a UI (Sanitized Result):</span>
                    <pre className="text-emerald-400 text-[10px] max-h-48 overflow-y-auto">
                      {JSON.stringify(customValidation.sanitized, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#181B20] border-t border-[#24272C] flex items-center justify-between text-xs font-mono text-[#9CA3AF]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validador de Schema Ativo (Auto-Healing ativado na API e no Frontend)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#24272C] hover:bg-[#2C3036] text-white font-bold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
