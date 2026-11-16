import type { Cur, Num } from '../types';

/** Lee un número del estado: '' / texto inválido / undefined → 0. */
export function num(v: Num | null | undefined): number {
  const n = parseFloat(v as string);
  return isFinite(n) ? n : 0;
}

/** Redondeo a 2 decimales (centavos). */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha local → 'AAAA-MM-DD'. */
export function dstr(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Corre una clave de período 'AAAA-MM' d meses. */
export function shiftKey(k: string, d: number): string {
  const p = k.split('-').map(Number);
  let y = p[0];
  let m = p[1] + d;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + pad(m);
}

export function toARS(a: number, cur: Cur | undefined, rate: Num): number {
  return cur === 'USD' ? a * num(rate) : a;
}

export function nid(): string {
  return Math.random().toString(36).slice(2, 9);
}
