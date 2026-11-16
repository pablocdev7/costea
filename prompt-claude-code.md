# Prompt para Claude Code — "Cuentas" (finanzas personales de Pablo)

Pegá esto en Claude Code, dentro de una carpeta vacía, y poné `cuentas-v6.html` en esa carpeta antes de empezar.

---

## Contexto
Soy Pablo, vivo en Argentina (UTC-3). Tengo un prototipo funcionando en un solo archivo HTML (`cuentas-v6.html`, JS puro, estado único `S`, persistencia en localStorage). Quiero convertirlo en una **PWA instalable** que use yo solo, desde el celular (como app nativa) y desde la compu, con mis datos guardados en una base propia y sincronizados entre dispositivos.

Primero leé `cuentas-v6.html` completo: ahí está toda la lógica de negocio y los textos en español rioplatense. **No reescribas la lógica desde cero ni cambies el diseño**: migrala fielmente y después mejorala.

## Stack (decidido, no lo cambies sin avisarme)
- Vite + TypeScript, sin framework de UI al inicio (la app actual es vanilla; conservá esa estructura, separando en módulos: `state`, `calc` (lógica pura), `views`, `sheets`, `storage`).
- Supabase: Auth (email + contraseña, un solo usuario, registro público deshabilitado después de crear mi cuenta), Postgres con RLS, Storage para PDFs de resúmenes.
- vite-plugin-pwa (manifest, íconos, service worker, offline).
- Deploy en Vercel, con preview deployments por rama.
- Tests: Vitest para la lógica pura y Playwright para flujos de punta a punta.

## Fase 1 — Migración y PWA
1. Separar `calc` como funciones puras con tests: `periodKey/dateOf` (el período arranca el día 27; pagos desde el 27 cuentan para el mes siguiente), `dueCal/dueKeyFor/stmtOf` (qué resumen de tarjeta corresponde a un consumo según cierre y vencimiento), préstamos (interés = min(pago, saldo × tasa mensual), el resto va a capital; tasa mensual o anual), deudas de cuota fija, saldos por cuenta (saldo base + movimientos posteriores a `baseAt`), ganancia real de Uber (ingresos − gastos del auto − cuota diaria × días trabajados; la categoría "Pago alquiler del auto" mueve la cuenta pero no se cuenta dos veces), `spendByCat`.
2. Persistencia con Supabase. Empezá guardando el estado completo como un documento `jsonb` por usuario (tabla `app_state(user_id pk, data jsonb, updated_at)`), con RLS `user_id = auth.uid()`. Misma lógica "gana el más nuevo" que usa hoy (`t`). Usar localStorage como caché offline y sincronizar al volver la conexión.
3. Login simple (email + contraseña), sesión persistente. Pantalla de login mínima.
4. Importar mis datos actuales: botón "Importar JSON" que acepte el export de la app actual.
5. PWA: manifest (nombre "Cuentas", modo standalone, colores del tema), íconos 192/512 + maskable, service worker con caché de la app para que abra sin internet, aviso de "hay una versión nueva".
6. Tema claro/oscuro como hoy. Probar a 400px de ancho y sin scroll horizontal.
7. Deploy a Vercel y guía paso a paso para instalarla en iPhone/Android ("Agregar a pantalla de inicio").

## Fase 2 — Funciones que faltan
1. **Gastos recurrentes**: se cargan una vez (nombre, monto, moneda, día, categoría, cuenta) y aparecen solos cada período como pendientes de tildar. Se puede editar el monto de un mes puntual sin cambiar la plantilla, y pausar o borrar la plantilla. Lo mismo para ingresos (sueldo).
2. **Gasto semanal del alquiler del auto** (se paga los jueves, a semana vencida): ítem recurrente semanal con monto editable.
3. **Importar resúmenes bancarios** (Naranja X, Visa Galicia, Amex Galicia):
   - Subir el PDF (Supabase Storage), extraer el texto (pdf.js en el cliente o una Edge Function) y parsear consumos: fecha, comercio, monto, cuotas.
   - Mostrar una pantalla de conciliación: consumos del resumen vs. consumos que registré a mano en ese período de esa tarjeta. Estados: coincide, falta en mi registro, sobra en mi registro, monto distinto. Matcheo por monto + fecha cercana + comercio parecido.
   - Botones para agregar los que faltan (con categoría sugerida) y para marcar los que sobran. Guardar el total real del resumen en `stmts` como hoy.
   - Hacer el parser tolerante: si no logra leer un PDF, mostrar el texto crudo y dejarme corregir. Diseñá el parser por banco, con fixtures de prueba (te voy a pasar PDFs reales, sin datos sensibles en el repo: usá `.gitignore`).
4. **Análisis**: mantener lo que hay (Uber real, gasto por categoría, comparación con el período anterior) y agregar: gasto por categoría en los últimos 6 períodos, gasolina por mes y por día, mejor/peor día de la semana en Uber.
5. **Presupuesto por categoría** con alerta cuando se pasa del límite.

## Fase 3 — Notificaciones
Web Push con service worker + Edge Function programada (Supabase cron) que avise: vencimiento de tarjeta (2 días antes y el día), gastos fijos del día, cierre de tarjeta. Nota: en iPhone solo funciona con la PWA instalada (iOS 16.4+). Guardar las suscripciones en una tabla con RLS.

## Reglas de trabajo
- Trabajá por fases y por ramas (`feat/...`). Al terminar cada fase: correr tests, hacer deploy preview y darme el link para probar.
- No metas datos reales míos en el repo ni en tests. Variables de entorno de Supabase en `.env` (ignorado) y en Vercel.
- Dinero siempre con 2 decimales y formato argentino (`$ 1.234,56`). Dólares con tasa configurable (hoy `rate`).
- Todo el texto de la interfaz en español rioplatense (vos, tenés).
- Antes de cambiar una regla de negocio, preguntame. Al final de cada fase, escribí en `README.md` cómo correr, probar y desplegar.
- Empezá con la Fase 1 y frená cuando esté desplegada para que la pruebe.
