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
import { CryptoAsset, KlinePoint, WhaleTransaction, SwarmAnalysisResult, TradeJournalEntry, AlphaFactor, SystemDiagnosticResult } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('swarm');
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | null>(null);
  
  const [chartTimeframe, setChartTimeframe] = useState<'5m' | '15m' | '1h'>('5m');
  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [whaleTxs, setWhaleTxs] = useState<WhaleTransaction[]>([]);
  const [alphaFactors, setAlphaFactors] = useState<AlphaFactor[]>([]);

  const [swarmResult, setSwarmResult] = useState<SwarmAnalysisResult | null>(null);
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>([]);
  
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

  const runSystemDiagnosticCheck = async (simulateAgent?: string, simulateDegraded?: boolean) => {
    setIsCheckingHealth(true);
    try {
      let query = '';
      if (simulateAgent) query += `simulateAgent=${simulateAgent}&`;
      if (simulateDegraded) query += `simulateDegraded=true&`;

      const res = await fetch(`/api/health?${query}`);
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

  // Initial Data Fetch
  useEffect(() => {
    fetchTopAssets();
    fetchAlphaFactors();
  }, []);


  // Fetch Klines & Whales whenever selected asset or chartTimeframe changes
  useEffect(() => {
    if (selectedAsset) {
      fetchKlinesData(selectedAsset.symbol, chartTimeframe);
      fetchWhalesData(selectedAsset.symbol);
    }
  }, [selectedAsset?.symbol, chartTimeframe]);

  const fetchTopAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/crypto/top');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setAssets(json.data);
        if (!selectedAsset) {
          setSelectedAsset(json.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load top assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchKlinesData = async (symbol: string, interval: string = chartTimeframe) => {
    setLoadingKlines(true);
    try {
      const res = await fetch(`/api/crypto/klines?symbol=${symbol}&interval=${interval}&limit=40`);
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
      const json = await res.json();
      if (json.success) {
        setWhaleTxs(json.data);
      }
    } catch (err) {
      console.error('Failed to load whales:', err);
    }
  };

  const fetchAlphaFactors = async () => {
    try {
      const res = await fetch('/api/crypto/alpha-factors');
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
      prev.map((e) => (e.id === id ? { ...e, status } : e))
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
              <WhaleRadar symbol={activeSymbol} transactions={whaleTxs} />
            )}

            {activeTab === 'alpha' && (
              <AlphaZooPanel factors={alphaFactors} symbol={activeSymbol} />
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

