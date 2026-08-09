import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Top100Table } from './components/Top100Table';
import { SwarmMeetingRoom } from './components/SwarmMeetingRoom';
import { TradingChart } from './components/TradingChart';
import { WhaleRadar } from './components/WhaleRadar';
import { AlphaZooPanel } from './components/AlphaZooPanel';
import { TradeJournal } from './components/TradeJournal';
import { SystemWarningToast } from './components/SystemWarningToast';
import { SystemDiagnosticModal } from './components/SystemDiagnosticModal';
import { CryptoAsset, KlinePoint, WhaleOverview, SwarmAnalysisResult, TradeJournalEntry, AlphaFactor, SystemDiagnosticResult } from './types';

const JOURNAL_STORAGE_KEY = 'vibe-swarm-journal';

const loadJournalEntries = (): TradeJournalEntry[] => {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Falha ao ler diário de trades do localStorage:', err);
    return [];
  }
};

const DEFAULT_SEED_ASSETS: CryptoAsset[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 96450, change24h: 2.45, volume24h: 38500000000, high24h: 97800, low24h: 95100, marketCap: 1900000000000, rank: 1, category: 'Layer 1' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 2750, change24h: 1.82, volume24h: 18200000000, high24h: 2820, low24h: 2690, marketCap: 330000000000, rank: 2, category: 'Layer 1' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', price: 198.4, change24h: 4.15, volume24h: 8900000000, high24h: 204, low24h: 189, marketCap: 94000000000, rank: 3, category: 'Layer 1' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', price: 0.0000185, change24h: 14.20, volume24h: 4200000000, high24h: 0.0000192, low24h: 0.0000158, marketCap: 7800000000, rank: 4, category: 'Meme' },
  { id: 'sui', symbol: 'SUI', name: 'Sui', price: 3.42, change24h: 11.80, volume24h: 3100000000, high24h: 3.55, low24h: 3.02, marketCap: 9800000000, rank: 5, category: 'Layer 1' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', price: 2.50, change24h: -0.85, volume24h: 6200000000, high24h: 2.62, low24h: 2.42, marketCap: 142000000000, rank: 6, category: 'Layer 1' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', price: 6.15, change24h: -9.40, volume24h: 1950000000, high24h: 6.85, low24h: 6.02, marketCap: 7200000000, rank: 7, category: 'AI & Data' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', price: 650.2, change24h: 0.95, volume24h: 1800000000, high24h: 662, low24h: 642, marketCap: 95000000000, rank: 8, category: 'Layer 1' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.265, change24h: 5.40, volume24h: 3100000000, high24h: 0.28, low24h: 0.25, marketCap: 38000000000, rank: 9, category: 'Meme' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('swarm');
  const [assets, setAssets] = useState<CryptoAsset[]>(DEFAULT_SEED_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | null>(DEFAULT_SEED_ASSETS[0]);
  
  const [chartTimeframe, setChartTimeframe] = useState<'5m' | '15m' | '1h'>('5m');
  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [whaleOverview, setWhaleOverview] = useState<WhaleOverview | null>(null);
  const [alphaFactors, setAlphaFactors] = useState<AlphaFactor[]>([]);

  const [swarmResult, setSwarmResult] = useState<SwarmAnalysisResult | null>(null);
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>(loadJournalEntries);
  
  const [loadingAssets, setLoadingAssets] = useState<boolean>(true);
  const [loadingSwarm, setLoadingSwarm] = useState<boolean>(false);
  const [loadingKlines, setLoadingKlines] = useState<boolean>(false);

  // System Self-Diagnostic States
  const [systemHealth, setSystemHealth] = useState<SystemDiagnosticResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);
  const [toastDismissed, setToastDismissed] = useState<boolean>(false);

  // Periodic Background Self-Diagnostic Check (Every 15 Seconds)
  useEffect(() => {
    runSystemDiagnosticCheck();
    const interval = setInterval(() => {
      runSystemDiagnosticCheck();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Persist trade journal to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journalEntries));
    } catch (err) {
      console.warn('Falha ao salvar diário de trades no localStorage:', err);
    }
  }, [journalEntries]);

  const runSystemDiagnosticCheck = async (simulateAgent?: string, simulateDegraded?: boolean) => {
    setIsCheckingHealth(true);
    try {
      let query = '';
      if (simulateAgent) query += `simulateAgent=${simulateAgent}&`;
      if (simulateDegraded) query += `simulateDegraded=true&`;

      const res = await fetch(`/api/health?${query}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Endpoint /api/health indisponível ou resposta não-JSON');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setSystemHealth(json.data);
        // Reset toast dismissed state if a new warning occurs
        if (json.data.overallStatus !== 'ONLINE') {
          setToastDismissed(false);
        }
      }
    } catch (err) {
      console.warn('System health check temporary fetch issue:', err);
      // Fallback offline status
      setSystemHealth({
        overallStatus: 'DEGRADED',
        timestamp: Date.now(),
        latencyMs: 999,
        activeAgentsCount: 0,
        totalAgentsCount: 6,
        diagnostics: [],
        warningMessage: 'Aviso do Sistema: Servidor inacessível ou conectividade de rede perdida.',
      });
      setToastDismissed(false);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Initial Data Fetch & Continuous Price Stream (3s Polling)
  useEffect(() => {
    fetchTopAssets(false);
    fetchAlphaFactors();

    const priceSyncInterval = setInterval(() => {
      fetchTopAssets(true);
    }, 3000);

    return () => clearInterval(priceSyncInterval);
  }, []);

  // Fetch Klines & Whales whenever selected asset or chartTimeframe changes
  useEffect(() => {
    if (selectedAsset) {
      fetchKlinesData(selectedAsset.symbol, chartTimeframe);
      fetchWhalesData(selectedAsset.symbol);
    }
  }, [selectedAsset?.symbol, chartTimeframe]);

  const fetchTopAssets = async (isSilent = false) => {
    if (!isSilent) setLoadingAssets(true);
    try {
      const res = await fetch('/api/crypto/top');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Servidor indisponível ou resposta inválida');
      }
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const freshAssets: CryptoAsset[] = json.data;
        setAssets(freshAssets);

        // Keep selectedAsset synced in real-time with updated price & stats
        setSelectedAsset((prev) => {
          if (!prev) return freshAssets[0];
          const updatedMatch = freshAssets.find((a) => a.symbol === prev.symbol || a.id === prev.id);
          return updatedMatch || prev;
        });
      }
    } catch (err) {
      console.warn('Notice: temporary network issue fetching top assets:', err);
      setAssets((prev) => (prev.length > 0 ? prev : DEFAULT_SEED_ASSETS));
    } finally {
      if (!isSilent) setLoadingAssets(false);
    }
  };

  const fetchKlinesData = async (symbol: string, interval: string = chartTimeframe) => {
    setLoadingKlines(true);
    try {
      const res = await fetch(`/api/crypto/klines?symbol=${symbol}&interval=${interval}&limit=40`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Servidor indisponível');
      }
      const json = await res.json();
      if (json.success) {
        setKlines(json.data);
      }
    } catch (err) {
      console.error('Failed to load klines:', err);
    } finally {
      setLoadingKlines(false);
    }
  };

  const fetchWhalesData = async (symbol: string) => {
    try {
      const res = await fetch(`/api/crypto/whales?symbol=${symbol}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Servidor indisponível');
      }
      const json = await res.json();
      if (json.success) {
        setWhaleOverview(json.data);
      }
    } catch (err) {
      console.error('Failed to load whale overview:', err);
    }
  };

  const fetchAlphaFactors = async () => {
    try {
      const res = await fetch('/api/crypto/alpha-factors');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Servidor indisponível');
      }
      const json = await res.json();
      if (json.success) {
        setAlphaFactors(json.data);
      }
    } catch (err) {
      console.error('Failed to load alpha factors:', err);
    }
  };

  const handleRunSwarmAnalysis = async (symbol: string, durationMinutes: number) => {
    const targetAsset = assets.find((a) => a.symbol === symbol) || selectedAsset;
    if (!targetAsset) return;

    setLoadingSwarm(true);
    try {
      const res = await fetch('/api/swarm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetAsset.symbol,
          name: targetAsset.name,
          price: targetAsset.price,
          change24h: targetAsset.change24h,
          volume24h: targetAsset.volume24h,
          high24h: targetAsset.high24h,
          low24h: targetAsset.low24h,
          signalDurationMinutes: durationMinutes,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Servidor de IA indisponível ou resposta inesperada');
      }

      const json = await res.json();
      if (json.success) {
        setSwarmResult(json.data);
      }
    } catch (err) {
      console.error('Failed to run swarm analysis:', err);
    } finally {
      setLoadingSwarm(false);
    }
  };

  const handleSelectAsset = (asset: CryptoAsset, runSwarmImmediately = false) => {
    setSelectedAsset(asset);
    if (runSwarmImmediately) {
      setActiveTab('swarm');
      handleRunSwarmAnalysis(asset.symbol, 5);
    }
  };

  const handleAddToJournal = (entryData: Omit<TradeJournalEntry, 'id' | 'timestamp'>) => {
    const newEntry: TradeJournalEntry = {
      ...entryData,
      id: `trade-${Date.now()}`,
      timestamp: Date.now(),
    };
    setJournalEntries((prev) => [newEntry, ...prev]);
  };

  const handleRemoveJournalEntry = (id: string) => {
    setJournalEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateJournalStatus = (id: string, status: TradeJournalEntry['status']) => {
    setJournalEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (status === 'EM_ANDAMENTO' || status === 'CANCELADO') return { ...e, status };
        const base = status === 'LUCRO'
          ? e.targetPrice / e.entryPrice - 1
          : e.stopPrice / e.entryPrice - 1;
        const pnlPercent = (e.type === 'VENDA' ? -base : base) * 100;
        return { ...e, status, pnlPercent };
      })
    );
  };

  // Remaining timer formatted string for header pill
  const getHeaderSignalCountdown = () => {
    if (!swarmResult) return '';
    const diff = Math.max(0, Math.floor((swarmResult.expiryTimestamp - Date.now()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeSymbol = selectedAsset?.symbol || 'BTC';
  const hasActiveSignal = !!swarmResult && swarmResult.expiryTimestamp > Date.now();

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#D1D5DB] font-mono selection:bg-emerald-500 selection:text-slate-950">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        topCount={assets.length}
        activeSymbol={activeSymbol}
        hasActiveSignal={hasActiveSignal}
        signalCountdown={getHeaderSignalCountdown()}
        systemHealth={systemHealth}
        onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 space-y-4">
        {loadingAssets && assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-[#9CA3AF]">Connecting to Binance Spot Orderbook Feed...</p>
          </div>
        ) : (
          <>
            {activeTab === 'swarm' && selectedAsset && (
              <SwarmMeetingRoom
                selectedAsset={selectedAsset}
                assets={assets}
                onSelectAsset={setSelectedAsset}
                swarmResult={swarmResult}
                isLoading={loadingSwarm}
                onRunSwarm={handleRunSwarmAnalysis}
                onAddToJournal={handleAddToJournal}
                onSwarmResultUpdated={(result) => setSwarmResult(result)}
              />
            )}

            {activeTab === 'top100' && (
              <Top100Table
                assets={assets}
                onSelectAsset={handleSelectAsset}
                selectedSymbol={activeSymbol}
              />
            )}

            {activeTab === 'chart' && selectedAsset && (
              <TradingChart
                symbol={activeSymbol}
                klines={klines}
                asset={selectedAsset}
                timeframe={chartTimeframe}
                onTimeframeChange={(tf) => setChartTimeframe(tf)}
                onRefresh={() => fetchKlinesData(activeSymbol, chartTimeframe)}
                isLoading={loadingKlines}
              />
            )}

            {activeTab === 'whales' && (
              <WhaleRadar symbol={activeSymbol} overview={whaleOverview} />
            )}

            {activeTab === 'alpha' && (
              <AlphaZooPanel factors={alphaFactors} symbol={activeSymbol} selectedAsset={selectedAsset} />
            )}

            {activeTab === 'journal' && (
              <TradeJournal
                entries={journalEntries}
                onRemoveEntry={handleRemoveJournalEntry}
                onUpdateStatus={handleUpdateJournalStatus}
              />
            )}
          </>
        )}
      </main>

      {/* System Warning Toast */}
      {!toastDismissed && (
        <SystemWarningToast
          systemHealth={systemHealth}
          onDismiss={() => setToastDismissed(true)}
          onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
        />
      )}

      {/* System Diagnostic Detail Modal */}
      <SystemDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        systemHealth={systemHealth}
        isChecking={isCheckingHealth}
        onRunDiagnosticNow={runSystemDiagnosticCheck}
      />

      {/* Footer */}
      <footer className="border-t border-[#24272C] bg-[#121417] py-3 text-[10px] font-mono text-[#6B7280]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>Vibe-Trading Swarm AI • HKU Data Science Multi-Agent Framework</div>
          <div>Realtime Orderbook & Social Feeds. For algorithmic research purposes.</div>
        </div>
      </footer>
    </div>
  );

}

