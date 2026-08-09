import React, { useState, useEffect, useRef } from 'react';
import { CryptoAsset } from '../types';
import { Search, Flame, ArrowUpDown, TrendingUp, TrendingDown, Bot } from 'lucide-react';
import { buildSparklineGeometry } from '../lib/sparkline';

interface Top100TableProps {
  assets: CryptoAsset[];
  onSelectAsset: (asset: CryptoAsset, runSwarmImmediately?: boolean) => void;
  selectedSymbol: string;
}

interface AssetRowProps {
  asset: CryptoAsset;
  isSelected: boolean;
  maxVolume: number;
  sparkline?: number[];
  sparklineLoading: boolean;
  onSelectAsset: (asset: CryptoAsset, runSwarmImmediately?: boolean) => void;
}

const SparklineCell: React.FC<{ points?: number[]; loading: boolean }> = ({ points, loading }) => {
  if (loading && !points) {
    return <div className="w-16 h-8 bg-[#0A0B0D] rounded border border-[#24272C] animate-pulse" />;
  }
  if (!points || points.length < 2) {
    return <span className="text-[9px] font-mono text-[#6B7280]">—</span>;
  }
  const geo = buildSparklineGeometry(points);
  return (
    <svg width="64" height="28" className="block mx-auto" aria-label="Tendência de preço">
      <polyline
        points={geo.points}
        fill="none"
        stroke={geo.trendUp ? '#34D399' : '#FB7185'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

const AssetRow: React.FC<AssetRowProps> = ({ asset, isSelected, maxVolume, sparkline, sparklineLoading, onSelectAsset }) => {
  const isPositive = asset.change24h >= 0;
  const volPct = Math.min(100, Math.max(5, (asset.volume24h / maxVolume) * 100));
  const isExtremeVolatile = Math.abs(asset.change24h) >= 8;

  // Price flash animation state for real-time updates
  const prevPriceRef = useRef<number>(asset.price);
  const [flashType, setFlashType] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prevPriceRef.current !== asset.price) {
      if (asset.price > prevPriceRef.current) {
        setFlashType('up');
      } else if (asset.price < prevPriceRef.current) {
        setFlashType('down');
      }
      prevPriceRef.current = asset.price;

      const timer = setTimeout(() => {
        setFlashType(null);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [asset.price]);

  return (
    <tr
      className={`hover:bg-[#1C1F24] transition-colors ${
        isSelected ? 'bg-[#1A1D21] border-l-2 border-emerald-400' : ''
      }`}
    >
      <td className="py-2 px-3 text-[#6B7280] font-mono">{asset.rank}</td>

      <td className="py-2 px-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#1A1D21] border border-[#24272C] flex items-center justify-center font-bold text-emerald-400 text-[10px]">
            {asset.symbol.substring(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-xs">{asset.symbol}</span>
              <span className="text-[#6B7280] text-[10px] font-sans">{asset.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[9px] text-[#9CA3AF] bg-[#0A0B0D] px-1 py-0.2 rounded border border-[#24272C]/50">
                {asset.category}
              </span>
              {isExtremeVolatile && (
                <span
                  title={`Volatilidade Extrema 24h: ${asset.change24h > 0 ? '+' : ''}${asset.change24h.toFixed(2)}%`}
                  className={`inline-flex items-center gap-1 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded border shadow-sm transition-all ${
                    asset.change24h >= 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10'
                  }`}
                >
                  <Flame className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  <span>EXTREME VOL ({asset.change24h > 0 ? '+' : ''}{asset.change24h.toFixed(1)}%)</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Price Column with Real-Time Green/Red Flashing CSS Transition */}
      <td className="py-2 px-3 text-right font-bold text-white">
        <span
          className={`inline-block px-1.5 py-0.5 rounded font-mono transition-all duration-500 ${
            flashType === 'up'
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20 scale-105'
              : flashType === 'down'
              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/20 scale-105'
              : 'bg-transparent text-white border border-transparent'
          }`}
        >
          ${asset.price < 0.01 ? asset.price.toFixed(7) : asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </td>

      <td className="py-2 px-3 text-right">
        <div
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isExtremeVolatile
              ? isPositive
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/20'
              : isPositive
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>
            {isPositive ? '+' : ''}
            {asset.change24h.toFixed(2)}%
          </span>
        </div>
      </td>

      <td className="py-2 px-3 text-center">
        <SparklineCell points={sparkline} loading={sparklineLoading} />
      </td>

      <td className="py-2 px-3 text-right">
        <div className="text-white font-medium">
          ${(asset.volume24h / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M
        </div>
        {/* Volume Bar */}
        <div className="w-20 ml-auto bg-[#0A0B0D] h-1 rounded overflow-hidden mt-1 border border-[#24272C]">
          <div className="bg-emerald-500 h-full" style={{ width: `${volPct}%` }}></div>
        </div>
      </td>

      <td className="py-2 px-3 text-center">
        <button
          onClick={() => onSelectAsset(asset, true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1C1F24] hover:bg-emerald-600 text-emerald-400 hover:text-white border border-[#24272C] text-[10px] uppercase font-bold transition-all"
        >
          <Bot className="w-3 h-3" />
          <span>Swarm</span>
        </button>
      </td>
    </tr>
  );
};

export const Top100Table: React.FC<Top100TableProps> = ({ assets, onSelectAsset, selectedSymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [onlyExtremeVolatile, setOnlyExtremeVolatile] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'volume24h' | 'change24h' | 'rank' | 'price'>('volume24h');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [sparklineLoading, setSparklineLoading] = useState<boolean>(true);
  const fetchedSymbolsKeyRef = useRef<string>('');

  // Busca os sparklines do conjunto atual de símbolos (reusa cache do servidor).
  useEffect(() => {
    const symbols = Array.from(new Set(assets.map((a) => a.symbol))).slice(0, 100);
    const key = symbols.sort().join(',');
    if (symbols.length === 0 || key === fetchedSymbolsKeyRef.current) return;
    fetchedSymbolsKeyRef.current = key;

    let cancelled = false;
    setSparklineLoading(true);
    fetch(`/api/crypto/sparkline?symbols=${encodeURIComponent(symbols.join(','))}`)
      .then((res) => {
        if (!res.ok) throw new Error('Servidor indisponível');
        return res.json();
      })
      .then((json) => {
        if (!cancelled && json.success) {
          setSparklines(json.data || {});
        }
      })
      .catch((err) => {
        console.warn('Falha ao carregar sparklines:', err);
      })
      .finally(() => {
        if (!cancelled) setSparklineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const categories = ['Todos', 'Layer 1', 'DeFi', 'Meme', 'AI & Data', 'Layer 2', 'Infrastructure'];

  const handleSort = (field: 'volume24h' | 'change24h' | 'rank' | 'price') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAssets = assets
    .filter((asset) => {
      const matchesSearch =
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || asset.category === selectedCategory;
      const matchesExtremeVol = !onlyExtremeVolatile || Math.abs(asset.change24h) >= 8;
      return matchesSearch && matchesCategory && matchesExtremeVol;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

  const maxVolume = Math.max(...assets.map((a) => a.volume24h), 1);

  return (
    <div className="bg-[#121417] border border-[#24272C] rounded-lg overflow-hidden">
      {/* Header Controls */}
      <div className="p-3 sm:p-4 border-b border-[#24272C] bg-[#16191D]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">Top 100 Volume Leaders (24h Spot)</h2>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 font-mono">
              Market orderflow sorted by 24h USD volume.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter token (BTC, SOL)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0B0D] text-white placeholder-[#6B7280] text-xs font-mono rounded pl-8 pr-3 py-1.5 border border-[#24272C] focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Category Pills & Volatility Filter */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                selectedCategory === cat
                  ? 'bg-[#1C1F24] text-emerald-400 border border-[#374151]'
                  : 'bg-[#0A0B0D] text-[#9CA3AF] hover:text-white border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setOnlyExtremeVolatile(!onlyExtremeVolatile)}
            className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all inline-flex items-center gap-1.5 ml-auto sm:ml-0 ${
              onlyExtremeVolatile
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-[#0A0B0D] text-[#9CA3AF] hover:text-white border border-[#24272C]'
            }`}
          >
            <Flame className={`w-3 h-3 ${onlyExtremeVolatile ? 'text-amber-400 animate-pulse' : 'text-amber-500'}`} />
            <span>Extrema Volatilidade (&ge;8%)</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#24272C] bg-[#0A0B0D] text-[10px] font-mono font-bold text-[#9CA3AF] uppercase tracking-wider">
              <th className="py-2 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('rank')}>
                <div className="flex items-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 text-[#6B7280]" />
                </div>
              </th>
              <th className="py-2 px-3">Ativo / Categoria</th>
              <th className="py-2 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Preço (USD)</span>
                  <ArrowUpDown className="w-3 h-3 text-[#6B7280]" />
                </div>
              </th>
              <th className="py-2 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('change24h')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Var. 24h</span>
                  <ArrowUpDown className="w-3 h-3 text-[#6B7280]" />
                </div>
              </th>
              <th className="py-2 px-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>Tendência (5m)</span>
                </div>
              </th>
              <th className="py-2 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('volume24h')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Vol 24h (USD)</span>
                  <ArrowUpDown className="w-3 h-3 text-[#6B7280]" />
                </div>
              </th>
              <th className="py-2 px-3 text-center">Ação Swarm AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#24272C]/60 text-xs font-mono">
            {filteredAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                isSelected={asset.symbol === selectedSymbol}
                maxVolume={maxVolume}
                sparkline={sparklines[asset.symbol]}
                sparklineLoading={sparklineLoading}
                onSelectAsset={onSelectAsset}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

