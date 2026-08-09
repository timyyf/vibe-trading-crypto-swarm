import { TradeJournalEntry } from '../types';

export const JOURNAL_MAX_ENTRIES = 50;
export const JOURNAL_ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const DAY_MS = 24 * 60 * 60 * 1000;

export const JOURNAL_TTL_DAYS = Math.round(JOURNAL_ENTRY_TTL_MS / DAY_MS);

/**
 * Remove entradas expiradas (idade > ttlMs) e, se ainda exceder maxEntries,
 * mantém apenas as mais recentes (a lista é ordenada da mais nova para a mais antiga).
 */
export function pruneJournalEntries(
  entries: TradeJournalEntry[],
  opts: { maxEntries?: number; ttlMs?: number } = {}
): TradeJournalEntry[] {
  const maxEntries = opts.maxEntries ?? JOURNAL_MAX_ENTRIES;
  const ttlMs = opts.ttlMs ?? JOURNAL_ENTRY_TTL_MS;
  const now = Date.now();
  const alive = entries.filter((e) => now - e.timestamp <= ttlMs);
  return alive.slice(0, maxEntries);
}
