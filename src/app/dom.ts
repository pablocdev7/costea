import { ars, num, usd } from '../calc';
import { ctx } from './ctx';

export function $<T extends Element = HTMLElement>(s: string, r: ParentNode = document): T | null {
  return r.querySelector<T>(s);
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Atributo de color de sección: --c y --cs. */
export function st(c: string): string {
  return 'style="--c:var(--' + c + ');--cs:var(--' + c + '-s)"';
}

let noteT: ReturnType<typeof setTimeout> | undefined;
/** Aviso abajo. html puede traer un botón (ej. Deshacer); el resto del texto se escapa antes de llamarlo. */
export function note(html: string, ms?: number): void {
  const n = $('#note')!;
  n.innerHTML = html;
  n.hidden = false;
  clearTimeout(noteT);
  noteT = setTimeout(() => { n.hidden = true; }, ms || 5000);
}

export function amtHtml(cur: string | undefined, a: number): string {
  return cur === 'USD' ? usd(a) + '<small>≈ ' + ars(a * num(ctx.S.rate)) + '</small>' : ars(a);
}

export function cardHead(_c: string, title: string, right?: string): string {
  return '<div class="card-h"><h2><span class="dot"></span>' + title + '</h2>' + (right || '') + '</div>';
}
