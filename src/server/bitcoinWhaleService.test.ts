import { describe, it, expect } from 'vitest';
import { filterWhaleMoves, aggregateBitcoinWhale } from './bitcoinWhaleService.js';

function makeTx(txid: string, outputs: { value: number; addr?: string }[]): any {
  return {
    txid,
    vout: outputs.map((o, i) => ({ value: o.value, scriptpubkey_address: o.addr ?? `bc1qtest${i}` })),
  };
}

describe('bitcoinWhaleService - filtro de movimentos-baleia', () => {
  it('mantém apenas saídas >= threshold com endereço válido', () => {
    const txs = [makeTx('a', [{ value: 15 }, { value: 3 }, { value: 20 }])];
    const moves = filterWhaleMoves(txs, 10, 962000);
    expect(moves.length).toBe(2);
    expect(moves.map((m) => m.amountBtc)).toEqual([15, 20]);
    expect(moves.every((m) => m.blockHeight === 962000)).toBe(true);
    expect(moves[0].amountUsd).toBeNull();
  });

  it('ignora saídas sem endereço de saída (scriptpubkey_address)', () => {
    const txs = [makeTx('b', [{ value: 50, addr: '' }])];
    txs[0].vout[0].scriptpubkey_address = undefined;
    const moves = filterWhaleMoves(txs, 10, 962000);
    expect(moves.length).toBe(0);
  });

  it('nenhum movimento quando todas as saídas estão abaixo do limite', () => {
    const txs = [makeTx('c', [{ value: 9.9 }, { value: 0.5 }])];
    expect(filterWhaleMoves(txs, 10, 962000).length).toBe(0);
  });
});

describe('bitcoinWhaleService - agregação', () => {
  const moves = [
    { txid: 't1', blockHeight: 962000, amountBtc: 15, amountUsd: null, recipient: 'bc1qaaa' },
    { txid: 't2', blockHeight: 962001, amountBtc: 40, amountUsd: null, recipient: 'bc1qbbb' },
    { txid: 't3', blockHeight: 962002, amountBtc: 15, amountUsd: null, recipient: 'bc1qaaa' },
  ];

  it('ordena por valor desc, soma totais e conta carteiras únicas', () => {
    const ov = aggregateBitcoinWhale(moves, 60_000, 3, 962002);
    expect(ov).not.toBeNull();
    expect(ov!.moves[0].amountBtc).toBe(40);
    expect(ov!.stats.totalMovedBtc).toBe(70);
    expect(ov!.stats.totalMovedUsd).toBe(70 * 60_000);
    expect(ov!.stats.uniqueRecipients).toBe(2);
    expect(ov!.stats.blocksScanned).toBe(3);
    expect(ov!.stats.latestBlockHeight).toBe(962002);
    expect(ov!.moves[0].amountUsd).toBe(40 * 60_000);
  });

  it('retorna null com lista vazia (nenhum número fabricado)', () => {
    expect(aggregateBitcoinWhale([], 60_000, 3, 962002)).toBeNull();
  });
});
