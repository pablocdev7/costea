/* Formato de dinero argentino: siempre 2 decimales, punto de miles y coma decimal.
   El signo negativo es el "menos" tipográfico (−), como en el prototipo. */

const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const nfPct = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function sign(n: number): string {
  // Evita "−$ 0,00" cuando el valor redondea a cero.
  return n < 0 && Math.round(Math.abs(n) * 100) > 0 ? '−' : '';
}

/** $ 1.234,56 */
export function ars(n: number): string {
  return sign(n) + '$ ' + nf2.format(Math.abs(n));
}

/** US$ 1.234,56 */
export function usd(n: number): string {
  return sign(n) + 'US$ ' + nf2.format(Math.abs(n));
}

export function money(cur: string | undefined, n: number): string {
  return cur === 'USD' ? usd(n) : ars(n);
}

/** Número con hasta 1 decimal (porcentajes de avance). */
export function fmt1(n: number): string {
  return nf1.format(n);
}

/** Tasa de interés con hasta 2 decimales. */
export function fmtRate(n: number): string {
  return nfPct.format(n);
}

/** Número para CSV en español: coma decimal, sin separador de miles. */
export function csvNum(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}
