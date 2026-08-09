import { describe, it, expect } from 'vitest';
import { pruneJournalEntries, JOURNAL_MAX_ENTRIES, JOURNAL_TTL_DAYS } from './journal';
import { TradeJournalEntry } from '../types';

const makeEntry = (overrides: Partial<TradeJournalEntry> & { timestamp: number }): TradeJournalEntry => ({
  id: `trade-${overrides.timestamp}`,
  symbol: 'BTC',
  type: 'COMPRA',
  entryPrice: 100,
  targetPrice: 110,
  stopPrice: 95,
  status: 'EM_ANDAMENTO',
  durationMinutes: 5,
  expiryTimestamp: overrides.timestamp + 5 * 60 * 1000,
  confidence: 70,
  notes: 'teste',
  ...overrides,
});

describe('pruneJournalEntries', () => {
  const now = Date.now();

  it('remove entradas expiradas (mais antigas que o TTL)', () => {
    const entries = [
      makeEntry({ timestamp: now }),
      makeEntry({ timestamp: now - (JOURNAL_TTL_DAYS + 1) * 24 * 60 * 60 * 1000 }),
    ];
    const pruned = pruneJournalEntries(entries);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].timestamp).toBe(now);
  });

  it('mantém no máximo maxEntries mantendo as mais recentes', () => {
    const entries = Array.from({ length: JOURNAL_MAX_ENTRIES + 20 }, (_, i) =>
      makeEntry({ timestamp: now - i * 60 * 1000 })
    );
    const pruned = pruneJournalEntries(entries);
    expect(pruned).toHaveLength(JOURNAL_MAX_ENTRIES);
    expect(pruned[0].timestamp).toBe(now);
  });

  it('aceita políticas customizadas', () => {
    const entries = [
      makeEntry({ timestamp: now }),
      makeEntry({ timestamp: now - 2 * 60 * 60 * 1000 }),
      makeEntry({ timestamp: now - 3 * 60 * 60 * 1000 }),
    ];
    const pruned = pruneJournalEntries(entries, { maxEntries: 2, ttlMs: 2 * 60 * 60 * 1000 });
    expect(pruned).toHaveLength(1);
    expect(pruned[0].timestamp).toBe(now);
  });

  it('retorna lista vazia quando não há entradas', () => {
    expect(pruneJournalEntries([])).toEqual([]);
  });
});
