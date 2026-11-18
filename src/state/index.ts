import { deriveMonth } from '../calc/month';
import { num } from '../calc/util';
import type { Month, State } from '../types';

/** Clave de localStorage del prototipo: se conserva para leer lo que ya haya guardado. */
export const LS_KEY = 'cuentas-v2';

export const CATS = {
  gasto: ['Comida en la calle', 'Supermercado', 'Transporte', 'Salud', 'Ocio', 'Ropa', 'Hogar', 'Otros'],
  fijo: ['Alquiler', 'Servicios', 'Suscripciones', 'Gimnasio', 'Teléfono / internet', 'Cloud / software', 'Otros fijos'],
  auto: ['Combustible', 'Peaje / estacionamiento', 'Lavado', 'Mantenimiento', 'Pago alquiler del auto', 'Multas / otros'],
  uin: ['Viajes', 'Propinas', 'Otros ingresos'],
  ing: ['Sueldo', 'Freelance', 'Otros'],
};

export function emptyState(): State {
  return { v: 4, rate: 1555, startDay: 27, t: 0, months: {}, uber: [], debts: [], cards: [], consumos: [], stmts: {}, accounts: [], defAcc: '', gastos: [], transfers: [], carDaily: 0 };
}

/**
 * Completa y corrige un estado leído de afuera (localStorage, nube o respaldo).
 * Un formato anterior a v:4 se descarta y se arranca vacío (marcado con _rs).
 * Muta y devuelve el mismo objeto, como el prototipo.
 */
export function normalize(input: unknown): State {
  const x = input as State & { months: Record<string, Month & { card?: unknown; cardDay?: unknown }> };
  if (!x || typeof x !== 'object' || (x.v || 0) < 4) {
    const e0 = emptyState();
    e0._rs = 1;
    return e0;
  }
  x.startDay = x.startDay == null ? 1 : num(x.startDay);
  x.rate = num(x.rate) || 1555;
  x.months = x.months && typeof x.months === 'object' ? x.months : {};
  x.uber = Array.isArray(x.uber) ? x.uber : [];
  x.debts = Array.isArray(x.debts) ? x.debts : [];
  x.t = x.t || 0;
  x.debts.forEach((d) => { d.payments = Array.isArray(d.payments) ? d.payments : []; });
  x.cards = Array.isArray(x.cards) ? x.cards : [];
  x.consumos = Array.isArray(x.consumos) ? x.consumos : [];
  x.stmts = x.stmts && typeof x.stmts === 'object' ? x.stmts : {};
  x.accounts = Array.isArray(x.accounts) ? x.accounts : [];
  x.accounts.forEach((a) => { if (a.pending) a.pending = true; else delete a.pending; });
  // La cuenta destino tiene que existir y ser disponible; si no, la cuenta queda sin destino vinculado.
  x.accounts.forEach((a) => {
    const to = a.withdrawTo && x.accounts.find((b) => b.id === a.withdrawTo);
    if (!a.pending || !to || to.pending) delete a.withdrawTo;
  });
  x.defAcc = x.defAcc || '';
  // Una cuenta pendiente no puede ser la de por defecto.
  if (x.accounts.some((a) => a.id === x.defAcc && a.pending)) { const f = x.accounts.find((a) => !a.pending); x.defAcc = f ? f.id : ''; }
  x.gastos = Array.isArray(x.gastos) ? x.gastos : [];
  x.transfers = Array.isArray(x.transfers) ? x.transfers : [];
  x.carDaily = num(x.carDaily);
  Object.keys(x.months).forEach((k) => {
    const m = x.months[k];
    m.income = m.income || [];
    m.fixed = m.fixed || [];
    // Formato viejo: la tarjeta era una lista de gastos dentro del mes.
    if (Array.isArray(m.card)) {
      (m.card as { id: string; name?: string; amt: number; cur: 'ARS' | 'USD'; done?: boolean; ex?: number }[]).forEach((c) => {
        if (!c.ex) m.fixed.push({ id: c.id, name: 'Tarjeta: ' + (c.name || 'consumo'), amt: c.amt, cur: c.cur, day: (m.cardDay as number) || '', done: !!c.done });
      });
    }
    delete m.card;
    delete m.cardDay;
  });
  return x;
}

/** Devuelve el período k, creándolo (con la plantilla del anterior) si no existe. */
export function ensureMonth(S: State, k: string): Month {
  let m = S.months[k];
  if (!m) m = S.months[k] = deriveMonth(S, k);
  m.income = m.income || [];
  m.fixed = m.fixed || [];
  return m;
}

/** "Gana el más nuevo": devuelve el estado con la marca t más reciente (a igualdad, el local). */
export function newest(local: State, remote: State | null | undefined): 'local' | 'remote' {
  return remote && num(remote.t) > num(local.t) ? 'remote' : 'local';
}

/**
 * Lee un respaldo JSON exportado por la app (incluida cuentas-v6.html).
 * Tira un error con mensaje para mostrar si no es un respaldo válido.
 */
export function parseImport(text: string): State {
  let x: unknown;
  try { x = JSON.parse(text); } catch { throw new Error('Ese archivo no es un JSON válido.'); }
  const o = x as Partial<State> | null;
  if (!o || typeof o !== 'object' || !o.months || !Array.isArray(o.debts)) {
    throw new Error('Ese archivo no parece un respaldo de Cuentas.');
  }
  const s = normalize(o);
  if (s._rs) throw new Error('Ese respaldo es de una versión muy vieja y no se puede importar.');
  return s;
}

/** Copia profunda apta para guardar (JSON puro). */
export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
