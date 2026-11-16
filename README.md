# Cuentas

PWA personal de finanzas: ingresos, gastos fijos, tarjetas, deudas y Uber, con los datos en Supabase y copia local para usarla sin internet. Es la migración de `cuentas-v6.html` (el prototipo queda en el repo como referencia).

## Requisitos

- Node 20 o más nuevo.
- Un proyecto de Supabase con `supabase/schema.sql` ejecutado y el registro público desactivado (Authentication → Sign In / Providers → Email → "Allow new users to sign up" apagado).

## Correr en local

```bash
npm install
cp .env.example .env   # y completar con la URL y la publishable key del proyecto
npm run dev            # http://localhost:5173
```

`.env` está en `.gitignore`: las credenciales no van al repo.

## Probar

```bash
npm test               # Vitest: lógica pura (src/calc y src/state)
npm run test:e2e       # Playwright: flujos completos en Chromium a 400px de ancho
npm run typecheck
```

Los tests de Playwright hacen un build de producción en `dist-e2e/` contra un **Supabase falso** (`e2e/mock.ts` intercepta Auth y la API): nunca tocan la base real ni necesitan tu contraseña. Cubren login, sesión persistente, "gana el más nuevo", importar JSON, pagos de préstamo, tarjetas, deshacer, ancho de 400px sin scroll horizontal, tema oscuro, manifest y uso sin conexión con el service worker.

La primera vez: `npx playwright install chromium`.

## Cómo está armado

| Carpeta | Qué hay |
| --- | --- |
| `src/calc/` | Lógica pura (períodos, tarjetas, préstamos, cuentas, Uber, totales). Sin DOM. |
| `src/state/` | Estado vacío, `normalize`, plantilla de período, importación, "gana el más nuevo". |
| `src/storage/` | Cliente de Supabase y sincronización (`sync.ts`). |
| `src/views/` | Pestañas (Resumen, Ingresos, Hoy, Gastos, Deudas, Análisis, Datos). |
| `src/sheets/` | Hojas de edición (formularios). |
| `src/app/` | Estado de la interfaz, eventos, exportar CSV/JSON. |
| `supabase/schema.sql` | Tabla `app_state` con RLS y la función `save_state`. |

### Sincronización

- Todo el estado es un documento JSON por usuario en `app_state` (el mismo formato que el respaldo JSON del prototipo).
- Cada cambio pone `t = Date.now()`, se guarda al instante en `localStorage` y a los 800 ms se sube con `save_state()`.
- `save_state()` solo pisa la nube si la versión que llega es más nueva. Si la nube tenía algo más nuevo (otro dispositivo), la app lo adopta.
- Sin conexión, la app abre desde la caché y guarda en el dispositivo; al volver la conexión (o al volver a la app) compara con la nube y sube lo pendiente.
- En un dispositivo sin copia local, la app espera a leer la nube antes de dejarte cargar nada, para no pisar tus datos con un estado vacío.

## PWA

- Manifest "Cuentas", modo standalone, íconos 192/512 y maskable (generados desde `public/icon.svg` con `npm run icons`).
- El service worker deja la app en caché (incluidas las fuentes) para abrir sin internet.
- Cuando hay una versión nueva aparece arriba "Hay una versión nueva de Cuentas · Actualizar".

## Deploy

Pendiente (próximo paso de la Fase 1): Vercel con preview por rama, y la guía para instalarla en iPhone/Android.
