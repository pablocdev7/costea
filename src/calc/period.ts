import type { Num } from '../types';
import { num, pad, shiftKey } from './util';

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const SHORTM = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Día de arranque efectivo: 2–28, o 1 (mes calendario) si no es válido. */
export function sday(startDay: Num | null | undefined): number {
  const n = Math.round(num(startDay));
  return n >= 2 && n <= 28 ? n : 1;
}

/**
 * Período ('AAAA-MM') al que pertenece una fecha 'AAAA-MM-DD'.
 * Con arranque el 27: del 27 de marzo al 26 de abril es el período de abril.
 */
export function periodKey(ds: string, startDay: Num): string {
  const sd = sday(startDay);
  const ym = ds.slice(0, 7);
  const d = +ds.slice(8, 10);
  return sd > 1 && d >= sd ? shiftKey(ym, 1) : ym;
}

/** Fecha real del día d dentro del período k (inversa de periodKey). */
export function dateOf(k: string, d: number, startDay: Num): string {
  const sd = sday(startDay);
  const ym = sd > 1 && d >= sd ? shiftKey(k, -1) : k;
  return ym + '-' + pad(d);
}

/** Nombre del mes de una clave de período. */
export function mlab(k: string): string {
  return MONTHS[+k.split('-')[1] - 1];
}

/** Texto 'Período: del 27 mar al 26 abr', o null con mes calendario. */
export function periodRange(k: string, startDay: Num): string | null {
  const sd = sday(startDay);
  if (sd <= 1) return null;
  const a = dateOf(k, sd, startDay).split('-');
  const b = new Date(dateOf(shiftKey(k, 1), sd, startDay) + 'T12:00:00');
  b.setDate(b.getDate() - 1);
  return 'Período: del ' + (+a[2]) + ' ' + SHORTM[+a[1] - 1] + ' al ' + b.getDate() + ' ' + SHORTM[b.getMonth()];
}

/**
 * Texto de cuándo vence algo: '5 abr · en 3 d', '· vence hoy', '· venció hace 2 d'.
 * Los avisos relativos solo se muestran si se está mirando el período actual.
 */
export function whenTxt(dt: string, isCurrent: boolean, todayD: string): { t: string; late: boolean } {
  if (dt === '9999-99-99') return { t: 'sin fecha', late: false };
  const p = dt.split('-');
  let s = (+p[2]) + ' ' + SHORTM[+p[1] - 1];
  let late = false;
  if (isCurrent) {
    const diff = Math.round((+new Date(dt + 'T12:00:00') - +new Date(todayD + 'T12:00:00')) / 864e5);
    if (diff < 0) { s += ' · venció hace ' + (-diff) + ' d'; late = true; }
    else if (diff === 0) s += ' · vence hoy';
    else if (diff <= 7) s += ' · en ' + diff + ' d';
  }
  return { t: s, late };
}
