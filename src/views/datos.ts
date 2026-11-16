import { sday } from '../calc';
import { ctx } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';
import { syncInfo } from '../storage/sync';

export function vDatos(): string {
  const si = syncInfo();
  return '<section class="card" ' + st('dat') + '>' + cardHead('dat', 'Mi mes') + '<label class="inl" for="startDay">Mi mes arranca el día <input id="startDay" type="number" min="1" max="28" inputmode="numeric" value="' + sday(ctx.S.startDay) + '"></label><p class="hint">Lo que cae desde ese día cuenta para el mes siguiente: pagos fijos, tarjetas, Uber y deudas. Con 1 usás meses de calendario. Definilo al empezar y no lo cambies después.</p></section>'
    + '<section class="card" ' + st('dat') + '>' + cardHead('dat', 'Exportar y respaldo')
    + '<p class="hint">Hacé un respaldo de vez en cuando. Con el JSON recuperás todo.</p>'
    + '<div class="btns"><button class="btn pri" type="button" data-act="csv-month">Resumen del mes (CSV)</button><button class="btn" type="button" data-act="csv-uber">Uber (CSV)</button><button class="btn" type="button" data-act="csv-debts">Pagos de deudas (CSV)</button><button class="btn" type="button" data-act="csv-cons">Consumos de tarjeta (CSV)</button><button class="btn" type="button" data-act="json">Respaldo completo (JSON)</button></div>'
    + '<p class="hint">Los CSV usan ; como separador y coma decimal para abrirlos directo en Excel o Google Sheets en español.</p></section>'
    + '<section class="card" ' + st('dat') + '>' + cardHead('dat', 'Importar JSON') + '<p class="hint">Reemplaza todos los datos actuales (en este dispositivo y en la nube) por los del archivo. Sirve para traer el respaldo de la versión anterior de la app.</p>'
    + '<div class="btns"><label class="btn" for="imp">Importar JSON…</label><input id="imp" type="file" accept=".json,application/json" hidden></div></section>'
    + '<section class="card" ' + st('dat') + '>' + cardHead('dat', 'Tu cuenta')
    + '<p class="hint">' + (si.email ? 'Entraste como <b>' + esc(si.email) + '</b>. ' : '') + 'Tus datos se guardan en la nube y en este dispositivo, así podés usar la app sin internet: se sincroniza sola cuando vuelve la conexión.</p>'
    + '<div class="btns"><button class="btn" type="button" data-act="sync-now">Sincronizar ahora</button><button class="btn danger" type="button" data-act="logout">Cerrar sesión</button></div></section>';
}
