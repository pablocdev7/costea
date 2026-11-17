/* Supabase falso para las pruebas de punta a punta: intercepta Auth y la API REST.
   Implementa la misma regla que save_state() en la base: gana la marca t más nueva. */
import type { BrowserContext, Page, Route } from '@playwright/test';

export const EMAIL = 'prueba@example.com';
export const PASSWORD = 'clave-de-prueba';
export const UID = '00000000-0000-4000-8000-000000000001';
const BASE = 'https://e2e.supabase.test';

function b64url(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}

function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const access_token = b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, exp, iat: exp - 3600 }) + '.firma';
  return { access_token, token_type: 'bearer', expires_in: 3600 * 24, expires_at: exp, refresh_token: 'refresh-e2e', user };
}

export class FakeSupabase {
  /** Fila de app_state del usuario (null = todavía no hay). */
  row: { data: Record<string, unknown>; t: number } | null = null;
  saves: Record<string, unknown>[] = [];
  offline = false;

  constructor(initial?: Record<string, unknown>) {
    if (initial) this.row = { data: initial, t: Number(initial.t) || 0 };
  }

  /** Simula que otro dispositivo guardó una versión más nueva. */
  remoteWrite(data: Record<string, unknown>): void {
    this.row = { data, t: Number(data.t) || 0 };
  }

  async install(target: Page | BrowserContext): Promise<void> {
    await target.route(BASE + '/**', (route) => this.handle(route));
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  }

  private async handle(route: Route) {
    if (this.offline) return route.abort('internetdisconnected');
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    if (p === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'refresh_token') return this.json(route, 200, session());
      const body = req.postDataJSON() as { email: string; password: string };
      if (body.email === EMAIL && body.password === PASSWORD) return this.json(route, 200, session());
      return this.json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (p === '/auth/v1/user') return this.json(route, 200, session().user);
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (p === '/rest/v1/app_state' && req.method() === 'GET') {
      return this.json(route, 200, this.row ? [{ data: this.row.data, t: this.row.t }] : []);
    }
    if (p === '/rest/v1/rpc/save_state') {
      const { p_data } = req.postDataJSON() as { p_data: Record<string, unknown> };
      this.saves.push(p_data);
      const t = Number(p_data.t) || 0;
      let applied = false;
      if (!this.row || this.row.t < t) { this.row = { data: p_data, t }; applied = true; }
      return this.json(route, 200, [{ data: this.row.data, t: this.row.t, applied }]);
    }
    return this.json(route, 404, { message: 'no simulado: ' + p });
  }
}

export async function login(page: Page, password = PASSWORD): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
