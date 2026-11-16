import { describe, expect, it } from 'vitest';
import { ars, csvNum, money, usd } from '../src/calc';
import { emptyState, newest, normalize, parseImport } from '../src/state';

describe('formato de dinero', () => {
  it('siempre 2 decimales, formato argentino', () => {
    expect(ars(1234.56)).toBe('$ 1.234,56');
    expect(ars(1000000)).toBe('$ 1.000.000,00');
    expect(ars(-50.5)).toBe('−$ 50,50');
    expect(ars(-0.001)).toBe('$ 0,00');
    expect(usd(12.3)).toBe('US$ 12,30');
    expect(money('USD', 1)).toBe('US$ 1,00');
    expect(money('ARS', 1)).toBe('$ 1,00');
  });
  it('CSV con coma decimal', () => {
    expect(csvNum(1234.567)).toBe('1234,57');
  });
});

describe('normalize', () => {
  it('completa campos faltantes', () => {
    const s = normalize({ v: 4, months: { '2026-05': {} }, debts: [{ id: 'd' }] });
    expect(s.uber).toEqual([]);
    expect(s.rate).toBe(1555);
    expect(s.startDay).toBe(1);
    expect(s.months['2026-05']).toEqual({ income: [], fixed: [] });
    expect(s.debts[0].payments).toEqual([]);
  });
  it('un formato viejo arranca vacío', () => {
    const s = normalize({ v: 3, months: {} });
    expect(s._rs).toBe(1);
    expect(s.startDay).toBe(27);
  });
  it('migra las tarjetas viejas dentro del mes a gastos fijos', () => {
    const s = normalize({ v: 4, months: { '2026-05': { income: [], fixed: [], cardDay: 10, card: [{ id: 'k', name: 'Visa', amt: 5, cur: 'ARS', done: true }, { id: 'e', ex: 1 }] } }, debts: [] });
    expect(s.months['2026-05']).toEqual({ income: [], fixed: [{ id: 'k', name: 'Tarjeta: Visa', amt: 5, cur: 'ARS', day: 10, done: true }] });
  });
});

describe('gana el más nuevo', () => {
  it('compara la marca t', () => {
    const a = { ...emptyState(), t: 100 };
    expect(newest(a, { ...emptyState(), t: 200 })).toBe('remote');
    expect(newest(a, { ...emptyState(), t: 100 })).toBe('local');
    expect(newest(a, null)).toBe('local');
  });
});

describe('importar respaldo', () => {
  it('acepta el JSON que exporta cuentas-v6', () => {
    const s = parseImport(JSON.stringify({ ...emptyState(), t: 5, carDaily: '9000' }));
    expect(s.carDaily).toBe(9000);
    expect(s.t).toBe(5);
  });
  it('rechaza archivos que no son respaldos', () => {
    expect(() => parseImport('hola')).toThrow('no es un JSON válido');
    expect(() => parseImport('{"a":1}')).toThrow('no parece un respaldo');
    expect(() => parseImport('{"v":2,"months":{},"debts":[]}')).toThrow('versión muy vieja');
  });
});
