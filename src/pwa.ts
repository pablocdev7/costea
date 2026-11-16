import { registerSW } from 'virtual:pwa-register';
import { $, note } from './app/dom';

/** Registra el service worker y avisa cuando hay una versión nueva. */
export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() { $('#upd')!.hidden = false; },
    onOfflineReady() { note('Listo: la app ya funciona sin internet.'); },
    onRegisteredSW(_url, reg) {
      // Si la app queda abierta mucho tiempo, busca actualizaciones cada hora.
      if (reg) setInterval(() => { if (navigator.onLine) void reg.update(); }, 60 * 60 * 1000);
    },
  });
  $('#upd-go')!.addEventListener('click', () => { $('#upd')!.hidden = true; void update(true); });
}
