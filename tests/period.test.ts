import { describe, expect, it } from 'vitest';
import { dateOf, periodKey, periodRange, sday, shiftKey, whenTxt } from '../src/calc';

describe('shiftKey', () => {
  it('avanza y retrocede cruzando el año', () => {
    expect(shiftKey('2026-12', 1)).toBe('2027-01');
    expect(shiftKey('2026-01', -1)).toBe('2025-12');
    expect(shiftKey('2026-05', 14)).toBe('2027-07');
  });
});

describe('sday', () => {
  it('acepta 2–28 y si no usa mes calendario', () => {
    expect(sday(27)).toBe(27);
    expect(sday('27')).toBe(27);
    expect(sday(1)).toBe(1);
    expect(sday(29)).toBe(1);
    expect(sday('')).toBe(1);
  });
});

describe('periodKey (arranque el 27)', () => {
  it('del 1 al 26 es el período del mismo mes', () => {
    expect(periodKey('2026-04-01', 27)).toBe('2026-04');
    expect(periodKey('2026-04-26', 27)).toBe('2026-04');
  });
  it('desde el 27 cuenta para el mes siguiente', () => {
    expect(periodKey('2026-04-27', 27)).toBe('2026-05');
    expect(periodKey('2026-04-30', 27)).toBe('2026-05');
  });
  it('el 27 de diciembre ya es enero del año siguiente', () => {
    expect(periodKey('2026-12-27', 27)).toBe('2027-01');
  });
  it('con arranque 1 es el mes calendario', () => {
    expect(periodKey('2026-04-30', 1)).toBe('2026-04');
  });
});

describe('dateOf', () => {
  it('días desde el arranque caen en el mes anterior', () => {
    expect(dateOf('2026-05', 27, 27)).toBe('2026-04-27');
    expect(dateOf('2026-05', 10, 27)).toBe('2026-05-10');
    expect(dateOf('2027-01', 28, 27)).toBe('2026-12-28');
  });
  it('es la inversa de periodKey', () => {
    for (let d = 1; d <= 28; d++) expect(periodKey(dateOf('2026-05', d, 27), 27)).toBe('2026-05');
  });
});

describe('periodRange', () => {
  it('muestra del 27 al 26', () => {
    expect(periodRange('2026-05', 27)).toBe('Período: del 27 abr al 26 may');
  });
  it('sin texto con mes calendario', () => {
    expect(periodRange('2026-05', 1)).toBeNull();
  });
});

describe('whenTxt', () => {
  it('sin fecha', () => {
    expect(whenTxt('9999-99-99', true, '2026-05-10')).toEqual({ t: 'sin fecha', late: false });
  });
  it('vencido, hoy y próximo en el período actual', () => {
    expect(whenTxt('2026-05-08', true, '2026-05-10')).toEqual({ t: '8 may · venció hace 2 d', late: true });
    expect(whenTxt('2026-05-10', true, '2026-05-10').t).toBe('10 may · vence hoy');
    expect(whenTxt('2026-05-13', true, '2026-05-10').t).toBe('13 may · en 3 d');
    expect(whenTxt('2026-05-25', true, '2026-05-10').t).toBe('25 may');
  });
  it('en otro período solo muestra la fecha', () => {
    expect(whenTxt('2026-05-08', false, '2026-05-10')).toEqual({ t: '8 may', late: false });
  });
});
