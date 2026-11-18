/* Modelo de datos. Es el mismo JSON que guarda cuentas-v6.html (versión v:4),
   así un respaldo exportado de la app actual se importa sin conversión.
   Los montos pueden venir como número o como '' (campo vacío en un formulario);
   la lógica siempre los lee con num(). */

export type Cur = 'ARS' | 'USD';
/** Valor numérico tal como lo guarda el prototipo: número, '' o (en datos viejos) texto. */
export type Num = number | string;

/** Ingreso o gasto fijo de un período. */
export interface Item {
  id: string;
  name: string;
  amt: Num;
  cur: Cur;
  /** Día del mes en que se paga (solo gastos fijos). */
  day?: Num;
  cat?: string;
  /** Cuenta desde/hacia la que se mueve la plata ('' = cuenta por defecto). */
  acc?: string;
  done: boolean;
  doneAt?: number;
  /** Dato de ejemplo (1) o real (0/undefined). */
  ex?: number | boolean;
  /** Gasto fijo de este período que se paga en el período anterior. */
  early?: boolean;
}

export interface Month {
  income: Item[];
  fixed: Item[];
  /** Plata con la que se arranca el período, si se ajustó a mano. */
  opening?: Num;
}

export type UberType = 'in' | 'out';

export interface UberEntry {
  id: string;
  date: string;
  type: UberType;
  cat: string;
  amt: Num;
  note?: string;
  acc?: string;
  ts?: number;
  ex?: number | boolean;
}

/** Gasto diario que no es del auto ("Otro gasto" en la pestaña Hoy). */
export interface Gasto {
  id: string;
  date: string;
  cat: string;
  name: string;
  amt: Num;
  acc?: string;
  ts?: number;
}

export interface Card {
  id: string;
  name: string;
  closeDay: Num;
  dueDay: Num;
  ex?: number | boolean;
}

/** Consumo con tarjeta de crédito. */
export interface Consumo {
  id: string;
  cardId: string;
  date: string;
  name: string;
  amt: Num;
  cur: Cur;
  cat?: string;
  ex?: number | boolean;
}

/** Resumen de tarjeta, indexado por `${cardId}|${periodo}`. */
export interface Stmt {
  /** Total real según el resumen del banco. */
  real?: Num;
  acc?: string;
  paid?: boolean;
  paidAt?: number;
  /** Monto pagado (lo que había que pagar al marcarlo). */
  amt?: Num;
}

export interface Payment {
  id: string;
  date: string;
  paid: Num;
  interest?: Num;
  capital?: Num;
  acc?: string;
  ts?: number;
}

export type DebtKind = 'loan' | 'fixed';

export interface Debt {
  id: string;
  kind: DebtKind;
  name: string;
  cur: Cur;
  day?: Num;
  payments: Payment[];
  ex?: number | boolean;
  /* préstamo con interés */
  who?: string;
  principal?: Num;
  rate?: Num;
  /** 'm' = tasa mensual, 'y' = tasa anual. */
  ratePer?: 'm' | 'y';
  planned?: Num;
  /* cuotas fijas */
  amount?: Num;
  total?: Num;
}

export interface Account {
  id: string;
  name: string;
  /** Saldo cargado a mano en el momento baseAt. */
  base: Num;
  baseAt: number;
  /** Plata acumulada en una app (Uber, Didi, Cabify) que todavía no se retiró:
   *  no cuenta como plata disponible. Sin el campo = disponible. */
  pending?: boolean;
  /** Solo cuentas pendientes: cuenta disponible a la que se retira por defecto. */
  withdrawTo?: string;
}

export interface Transfer {
  id: string;
  from: string;
  to: string;
  amt: Num;
  note?: string;
  ts: number;
}

export interface State {
  v: number;
  /** Pesos por dólar. */
  rate: Num;
  /** Día en que arranca el período (2–28); 1 = mes calendario. */
  startDay: Num;
  /** Marca de tiempo de la última modificación: gana el más nuevo. */
  t: number;
  months: Record<string, Month>;
  uber: UberEntry[];
  debts: Debt[];
  cards: Card[];
  consumos: Consumo[];
  stmts: Record<string, Stmt>;
  accounts: Account[];
  defAcc: string;
  gastos: Gasto[];
  transfers: Transfer[];
  /** Cuota diaria del alquiler del auto que se aparta por día trabajado. */
  carDaily: Num;
  /** Marca interna: el estado se reinició por venir en un formato viejo. */
  _rs?: number;
}
