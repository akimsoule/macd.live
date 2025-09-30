import { runSymbol } from '../../app/trading/trader';
import { requireAuth } from '../../app/auth/server-auth';

// Endpoint manuel: /api/run-symbol?symbol=PEOPLE/USDT:USDT
// Body JSON optionnel { symbol: "..." }
export default async function handler(req: Request) {
  try {
    if (process.env.PUBLIC_DASHBOARD !== '1') {
      const authRes = await requireAuth(req).catch(() => null);
      if (!authRes) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    let url: URL | null = null;
    try { url = new URL(req.url); } catch {}
    let symbol = url?.searchParams.get('symbol') || '';
    if (!symbol && req.headers.get('content-type')?.includes('application/json')) {
      try { const body = await req.json(); if (body?.symbol) symbol = body.symbol; } catch {}
    }
    if (!symbol) return new Response(JSON.stringify({ error: 'missing symbol' }), { status: 400 });

    const result = await runSymbol(symbol);
    return new Response(JSON.stringify({ ok: true, symbol, result }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as any)?.message || 'error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
