import { signJwt } from '../../app/auth/server-auth';

export default async function handler(req: Request) {
  const headers: Record<string,string> = {
    'content-type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });
  try {
    const body = await req.json().catch(() => ({}));
    const userEnv = process.env.DASHBOARD_USER;
    const passEnv = process.env.DASHBOARD_PASSWORD;
    if (!userEnv || !passEnv) {
      return new Response(JSON.stringify({ error: 'server_misconfig' }), { status: 500, headers });
    }
    const { username, password } = body;
    if (username !== userEnv || password !== passEnv) {
      await new Promise(r => setTimeout(r, 400)); // petite latence pour éviter brute force
      return new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401, headers });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) return new Response(JSON.stringify({ error: 'server_misconfig' }), { status: 500, headers });
    const token = await signJwt({ sub: username, role: 'admin' }, secret, { expiresInSeconds: 60 * 60 * 8 });
    return new Response(JSON.stringify({ token, expiresIn: 60 * 60 * 8 }), { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'error', message: e?.message }), { status: 500, headers });
  }
}
