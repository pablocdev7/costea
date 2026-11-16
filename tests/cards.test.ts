import { describe, expect, it } from 'vitest';
import { dueCal, dueKeyFor, stmtOf } from '../src/calc';
import type { Card } from '../src/types';
import { mkState } from './helpers';

// Tarjeta típica: cierra el 20, vence el 5 del mes siguiente.
const cierre20: Card = { id: 'c1', name: 'Tarjeta A', closeDay: 20, dueDay: 5 };
// Cierra el 3 y vence el 15 del mismo mes.
const cierre3: Card = { id: 'c2', name: 'Tarjeta B', closeDay: 3, dueDay: 15 };

describe('dueCal', () => {
  it('consumo hasta el cierre: vence el mes siguiente si el vencimiento es antes del cierre', () => {
    expect(dueCal(cierre20, '2026-04-20')).toBe('2026-05');
    expect(dueCal(cierre20, '2026-04-01')).toBe('2026-05');
  });
  it('consumo después del cierre pasa al resumen siguiente', () => {
    expect(dueCal(cierre20, '2026-04-21')).toBe('2026-06');
  });
  it('vencimiento posterior al cierre: vence el mismo mes del cierre', () => {
    expect(dueCal(cierre3, '2026-04-03')).toBe('2026-04');
    expect(dueCal(cierre3, '2026-04-04')).toBe('2026-05');
  });
  it('cruza el año', () => {
    expect(dueCal(cierre20, '2026-12-25')).toBe('2027-02');
  });
});

describe('dueKeyFor', () => {
  it('el período de pago respeta el arranque el 27', () => {
    // Vence el 5 de mayo → período de mayo.
    expect(dueKeyFor(cierre20, '2026-04-10', 27)).toBe('2026-05');
    // Una tarjeta que vence el 28 de mayo se paga en el período de junio.
    const v28: Card = { id: 'c3', name: 'C', closeDay: 15, dueDay: 28 };
    expect(dueKeyFor(v28, '2026-05-10', 27)).toBe('2026-06');
    expect(dueKeyFor(v28, '2026-05-10', 1)).toBe('2026-05');
  });
});

describe('stmtOf', () => {
  const S = mkState({
    cards: [cierre20],
    consumos: [
      { id: 'x1', cardId: 'c1', date: '2026-04-02', name: 'Súper', amt: 10000, cur: 'ARS' },
      { id: 'x2', cardId: 'c1', date: '2026-04-20', name: 'App', amt: 5, cur: 'USD' },
      { id: 'x3', cardId: 'c1', date: '2026-04-21', name: 'Otro', amt: 999, cur: 'ARS' },
      { id: 'x4', cardId: 'otra', date: '2026-04-02', name: 'Ajena', amt: 1, cur: 'ARS' },
    ],
  });

  it('suma lo registrado de esa tarjeta y período, con dólares convertidos', () => {
    const s = stmtOf(S, cierre20, '2026-05');
    expect(s.items.map((x) => x.id)).toEqual(['x1', 'x2']);
    expect(s.reg).toBe(15000);
    expect(s.real).toBe(0);
    expect(s.toPay).toBe(15000);
    expect(s.paid).toBe(false);
  });

  it('si se cargó el total real del resumen, se paga ese', () => {
    S.stmts['c1|2026-05'] = { real: 15800, paid: true };
    const s = stmtOf(S, cierre20, '2026-05');
    expect(s.toPay).toBe(15800);
    expect(s.paid).toBe(true);
  });
});
