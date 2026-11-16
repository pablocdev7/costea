/* Datos inventados para las pruebas, armados alrededor de la fecha de hoy. */
import { dateOf, dstr, periodKey, shiftKey } from '../src/calc';
import { emptyState } from '../src/state';

export const today = dstr(new Date());
export const curKey = periodKey(today, 27);
export const prevKey = shiftKey(curKey, -1);
export const d = (day: number, k = curKey) => dateOf(k, day, 27);

/** Estado completo con un poco de todo y montos grandes (para probar el ancho de 400px). */
export function richState(t = 1000) {
  const s = emptyState();
  return {
    ...s,
    t,
    rate: 1250,
    carDaily: 15000,
    defAcc: 'a1',
    accounts: [
      { id: 'a1', name: 'Banco de prueba', base: 1234567.89, baseAt: 1 },
      { id: 'a2', name: 'Efectivo', base: 45000, baseAt: 1 },
    ],
    months: {
      [curKey]: {
        income: [
          { id: 'i1', name: 'Sueldo de prueba', amt: 1850000, cur: 'ARS', done: true, cat: 'Sueldo' },
          { id: 'i2', name: 'Trabajo freelance con nombre largo', amt: 1200, cur: 'USD', done: false },
        ],
        fixed: [
          { id: 'f1', name: 'Alquiler del departamento', amt: 650000, cur: 'ARS', day: 5, cat: 'Alquiler', done: true },
          { id: 'f2', name: 'Servicio en la nube', amt: 25, cur: 'USD', day: 15, cat: 'Cloud / software', done: false },
          { id: 'f3', name: 'Gimnasio', amt: 38000, cur: 'ARS', day: 10, done: false },
        ],
      },
    },
    cards: [{ id: 'c1', name: 'Tarjeta de prueba', closeDay: 20, dueDay: 5 }],
    consumos: [
      { id: 'x1', cardId: 'c1', date: d(2), name: 'Supermercado grande', amt: 187654.32, cur: 'ARS', cat: 'Supermercado' },
      { id: 'x2', cardId: 'c1', date: d(3), name: 'Suscripción', amt: 19.99, cur: 'USD', cat: 'Ocio' },
    ],
    debts: [
      { id: 'd1', kind: 'loan', name: 'Préstamo de prueba', who: 'Alguien', cur: 'USD', principal: 5000, rate: 2, ratePer: 'm', planned: 400, day: 12, payments: [] },
      { id: 'd2', kind: 'fixed', name: 'Heladera en cuotas', cur: 'ARS', amount: 98765.43, total: 12, day: 8, payments: [{ id: 'p1', date: d(8, prevKey), paid: 98765.43, ts: 2 }] },
    ],
    uber: [
      { id: 'u1', date: d(1), type: 'in', cat: 'Viajes', amt: 123456.78, ts: 3 },
      { id: 'u2', date: d(1), type: 'out', cat: 'Combustible', amt: 34567.89, ts: 4 },
      { id: 'u3', date: d(2), type: 'in', cat: 'Viajes', amt: 98000, ts: 5 },
      { id: 'u4', date: d(4), type: 'out', cat: 'Pago alquiler del auto', amt: 105000, ts: 6 },
    ],
    gastos: [{ id: 'g1', date: d(2), cat: 'Comida en la calle', name: 'Almuerzo', amt: 12500, ts: 7 }],
  };
}
