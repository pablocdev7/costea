/* Persistencia: localStorage como caché (sirve sin internet) + Supabase como fuente compartida.
   Regla: gana la versión con la marca t más nueva, como en el prototipo. */
import { num } from '../calc';
import { clone, LS_KEY, newest, normalize } from '../state';
import type { State } from '../types';
import { supabase } from './supabase';

const OWNER_KEY = 'cuentas-owner';
/** Tiempo máximo de espera de la nube (conexión mala = como sin conexión). */
const TIMEOUT = 15000;
const OFFLINE_MSG = 'Sin conexión · guardado en este dispositivo';
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export interface Owner { id: string; email: string }

interface Hooks {
  /** Estado actual de la app (se lee en cada guardado). */
  get: () => State;
  /** Llegó una versión más nueva de la nube: la app la adopta. */
  adopt: (s: State) => void;
  status: (text: string, offline: boolean) => void;
  /** La sesión ya no es válida (hay que volver a entrar). */
  authLost: () => void;
}

let hooks: Hooks | null = null;
let owner: Owner | null = null;
let ready = false;
let dirty = false;
let saving = false;
let tmr: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;

/* ---------- caché local ---------- */
function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* sin espacio o bloqueado */ } }

export function readOwner(): Owner | null {
  try { const o = JSON.parse(lsGet(OWNER_KEY) || 'null'); return o && o.id ? o : null; } catch { return null; }
}

/** Copia local del usuario, o null si no hay (o es de otra cuenta). */
export function readCache(uid: string): State | null {
  const o = readOwner();
  if (o && o.id !== uid) return null;
  const raw = lsGet(LS_KEY);
  if (!raw) return null;
  try { const s = normalize(JSON.parse(raw)); return s._rs ? null : s; } catch { return null; }
}

function writeCache(s: State): void {
  lsSet(LS_KEY, JSON.stringify(s));
  if (owner) lsSet(OWNER_KEY, JSON.stringify(owner));
}

export function clearCache(): void {
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(OWNER_KEY); } catch { /* nada */ }
}

/* ---------- nube ---------- */
/** Lee la versión de la nube (null si todavía no hay). Tira error si no hay conexión. */
export async function fetchRemote(uid: string): Promise<State | null> {
  const { data, error } = await supabase.from('app_state').select('data,t').eq('user_id', uid).limit(1).abortSignal(AbortSignal.timeout(TIMEOUT));
  if (error) throw error;
  const row = data && data[0];
  return row ? normalize(row.data) : null;
}

function isAuthError(e: unknown): boolean {
  const err = e as { code?: string; status?: number; message?: string } | null;
  return !!err && (err.code === '42501' || err.status === 401 || /JWT|No hay sesión/i.test(err.message || ''));
}

function setStatus(t: string, off = false) { hooks?.status(t, off); }

/** Sube los cambios pendientes. Si la nube tiene algo más nuevo, lo adopta. */
export async function flush(): Promise<void> {
  if (!ready || !hooks) return;
  if (saving) { clearTimeout(tmr); tmr = setTimeout(flush, 400); return; }
  if (!dirty) return;
  if (isOffline()) { setStatus(OFFLINE_MSG, true); return; }
  saving = true;
  clearTimeout(retry);
  setStatus('Guardando…');
  try {
    while (dirty) {
      dirty = false;
      const snap = clone(hooks.get());
      const { data, error } = await supabase.rpc('save_state', { p_data: snap }).abortSignal(AbortSignal.timeout(TIMEOUT));
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { data: unknown; t: number; applied: boolean } | undefined;
      if (row && !row.applied && num(row.t) > num(hooks.get().t)) {
        const s = normalize(row.data);
        writeCache(s);
        hooks.adopt(s);
      }
    }
    setStatus('Guardado');
  } catch (e) {
    dirty = true;
    if (isAuthError(e)) { setStatus('Sin sesión · guardado en este dispositivo', true); hooks.authLost(); }
    else {
      setStatus(OFFLINE_MSG, true);
      retry = setTimeout(flush, 30000);
    }
  } finally {
    saving = false;
  }
}

/** Compara con la nube y se queda con lo más nuevo. */
export async function pull(): Promise<void> {
  if (!owner || !hooks) return;
  if (isOffline()) { ready = true; setStatus(dirty ? OFFLINE_MSG : 'Sin conexión', true); return; }
  try {
    const remote = await fetchRemote(owner.id);
    const local = hooks.get();
    if (remote && newest(local, remote) === 'remote') {
      writeCache(remote);
      hooks.adopt(remote);
      if (!dirty) setStatus('Guardado');
    } else if (!remote ? num(local.t) > 0 : num(local.t) > num(remote.t)) {
      dirty = true;
    }
    ready = true;
    if (dirty) await flush(); else setStatus('Guardado');
  } catch (e) {
    ready = true;
    if (isAuthError(e)) hooks.authLost();
    setStatus(dirty ? OFFLINE_MSG : 'Sin conexión', true);
  }
}

/** Guarda un cambio: marca t, escribe la caché y programa la subida. */
export function persist(s: State): void {
  s.t = Date.now();
  writeCache(s);
  dirty = true;
  if (isOffline()) setStatus(OFFLINE_MSG, true);
  else setStatus(ready ? 'Guardando…' : 'Guardado en este dispositivo');
  clearTimeout(tmr);
  tmr = setTimeout(flush, 800);
}

/** Empieza a sincronizar. Si alreadyFresh, el estado recién se leyó de la nube. */
export function startSync(o: Owner, h: Hooks, alreadyFresh: boolean): void {
  owner = o;
  hooks = h;
  lsSet(OWNER_KEY, JSON.stringify(o));
  writeCache(h.get());
  if (alreadyFresh) { ready = true; setStatus('Guardado'); }
  else void pull();
}

export function stopSync(): void {
  clearTimeout(tmr); clearTimeout(retry);
  hooks = null; owner = null; ready = false; dirty = false;
}

export function hasPending(): boolean { return dirty; }

export function syncInfo(): { email: string } {
  return { email: owner?.email || '' };
}

// Al volver la conexión o al volver a la app (por ejemplo, después de usarla en la compu), sincroniza.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void pull(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void pull(); });
}
