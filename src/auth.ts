import type { User } from '@supabase/supabase-js';
import { $ } from './app/dom';
import { supabase } from './storage/supabase';

/** Mensaje en castellano para los errores de login más comunes. */
export function loginError(e: { message?: string; status?: number; code?: string; name?: string } | null): string {
  if (!e) return '';
  const m = (e.message || '').toLowerCase();
  if (e.code === 'invalid_credentials' || m.includes('invalid login')) return 'El email o la contraseña no son correctos.';
  if (e.code === 'email_not_confirmed' || m.includes('not confirmed')) return 'Tu email todavía no está confirmado. Revisá tu correo.';
  if (e.status === 429 || e.code === 'over_request_rate_limit') return 'Demasiados intentos. Esperá un rato y probá de nuevo.';
  if (!navigator.onLine || e.name === 'AuthRetryableFetchError' || m.includes('fetch')) return 'No hay conexión. Para entrar la primera vez necesitás internet.';
  return 'No se pudo entrar. Probá de nuevo.';
}

/** Muestra el login y resuelve cuando el usuario entra. */
export function showLogin(): Promise<User> {
  $('#boot')!.hidden = true;
  $('#app')!.hidden = true;
  const box = $('#login')!, form = $<HTMLFormElement>('#lform')!, err = $('#l-err')!, btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  box.hidden = false;
  err.hidden = true;
  form.reset();
  $<HTMLInputElement>('#l-email')!.focus();
  return new Promise((resolve) => {
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const email = String(new FormData(form).get('email') || '').trim(), password = String(new FormData(form).get('password') || '');
      if (!email || !password) { err.textContent = 'Poné tu email y tu contraseña.'; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Entrando…'; err.hidden = true;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) { err.textContent = loginError(error); err.hidden = false; return; }
        box.hidden = true;
        form.onsubmit = null;
        resolve(data.user);
      } catch (e) {
        err.textContent = loginError(e as Error); err.hidden = false;
      } finally {
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    };
  });
}
