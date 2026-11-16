import './styles.css';
import { ctx, mo, refreshToday, setState } from './app/ctx';
import { $, esc } from './app/dom';
import { bindEvents } from './app/events';
import { showLogin } from './auth';
import { registerPwa } from './pwa';
import { closeSheet } from './sheets';
import { emptyState, normalize } from './state';
import { clearCache, fetchRemote, readCache, readOwner, startSync, stopSync, type Owner } from './storage/sync';
import { supabase } from './storage/supabase';
import type { State } from './types';
import { render } from './views';

function setSave(t: string, off: boolean): void {
  const e = $('#save');
  if (!e) return;
  e.textContent = t;
  e.classList.toggle('off', off);
}

function bootMsg(html: string): void {
  $('#app')!.hidden = true;
  $('#login')!.hidden = true;
  const b = $('#boot')!;
  b.innerHTML = html;
  b.hidden = false;
}

function showApp(): void {
  $('#boot')!.hidden = true;
  $('#login')!.hidden = true;
  $('#app')!.hidden = false;
  render();
}

const hooks = {
  get: (): State => ctx.S,
  adopt: (s: State): void => {
    // Llegó una versión más nueva (de otro dispositivo): se reemplaza la de pantalla.
    delete s._rs;
    ctx.S = s;
    refreshToday();
    mo(ctx.key);
    if (ctx.sheet) closeSheet();
    if (!$('#app')!.hidden) render();
  },
  status: setSave,
  authLost: (): void => { void checkSession(); },
};

/** Abre la app para un usuario: primero la copia local; si no hay, la de la nube. */
async function open(o: Owner): Promise<void> {
  const cached = readCache(o.id);
  if (cached) {
    setState(cached);
    showApp();
    startSync(o, hooks, false);
    return;
  }
  bootMsg('Cargando tus datos…');
  try {
    const remote = await fetchRemote(o.id);
    setState(remote || normalize(emptyState()));
  } catch {
    // Sin copia local ni conexión: no arrancamos vacíos, porque un cambio hecho así
    // pisaría los datos de la nube al sincronizar.
    bootMsg('<div style="text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center"><p>Necesitás internet para cargar tus datos la primera vez en este dispositivo.</p><button class="btn" type="button" id="boot-retry">Reintentar</button></div>');
    $('#boot-retry')!.onclick = () => { void open(o); };
    return;
  }
  showApp();
  startSync(o, hooks, true);
}

async function login(): Promise<void> {
  const user = await showLogin();
  bootMsg('Cargando…');
  await open({ id: user.id, email: user.email || '' });
}

/** Si la sesión se perdió (y hay conexión para comprobarlo), vuelve al login sin borrar la copia local. */
async function checkSession(): Promise<void> {
  if (!navigator.onLine) return;
  const { data, error } = await supabase.auth.getSession();
  if (data.session || error) return;
  stopSync();
  await login();
}

async function logout(): Promise<void> {
  stopSync();
  clearCache();
  setState(normalize(emptyState()));
  ctx.tab = 'resumen';
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await login();
}

async function boot(): Promise<void> {
  registerPwa();
  bindEvents(() => { void logout(); });
  let session = null, failed = false;
  try {
    const r = await supabase.auth.getSession();
    session = r.data.session;
    failed = !!r.error;
  } catch { failed = true; }
  if (session) return open({ id: session.user.id, email: session.user.email || '' });
  // Sin internet y con la sesión vencida: igual se puede usar la copia local.
  const o = readOwner();
  if (o && readCache(o.id) && (failed || !navigator.onLine)) return open(o);
  return login();
}

boot().catch((e) => {
  bootMsg('<p>Algo salió mal al abrir la app: ' + esc((e as Error).message) + '</p>');
});
