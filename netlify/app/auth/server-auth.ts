// Utilitaires JWT HS256 minimalistes sans dépendances externes
// Format: header.payload.signature (base64url)

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4; if (pad) str += '='.repeat(4 - pad);
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface JwtOptions { expiresInSeconds?: number; }

export async function signJwt(payload: Record<string, any>, secret: string, options: JwtOptions = {}): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (options.expiresInSeconds || 60 * 60 * 8); // défaut 8h
  const fullPayload = { ...payload, iat: now, exp };
  const key = await importKey(secret);
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(fullPayload)));
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return `${headerB64}.${payloadB64}.${base64url(sig)}`;
}

export interface VerifyResult { valid: boolean; payload?: any; error?: string; }

export async function verifyJwt(token: string, secret: string): Promise<VerifyResult> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return { valid: false, error: 'format' };
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(h)));
    if (header.alg !== 'HS256') return { valid: false, error: 'alg' };
    const key = await importKey(secret);
    const data = encoder.encode(`${h}.${p}`);
    const sig = base64urlDecode(s);
    const ok = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!ok) return { valid: false, error: 'sig' };
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(p)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now >= payload.exp) return { valid: false, error: 'exp' };
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: e?.message || 'error' };
  }
}

export async function extractAuthToken(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.substring(7).trim();
  return null;
}

export async function requireAuth(req: Request): Promise<{ payload: any } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');
  const token = await extractAuthToken(req);
  if (!token) return null;
  const res = await verifyJwt(token, secret);
  if (!res.valid) return null;
  return { payload: res.payload };
}

// Helper de réponse 401
export function unauthorized(headers: Record<string,string> = {}) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', ...headers } });
}
