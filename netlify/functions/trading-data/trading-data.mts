import { getTradingSnapshot, invalidateTradingSnapshotCache } from '../../app/trading/data-service';

// Endpoint simplifié: fournit un snapshot agrégé (cache TTL ~10s dans data-service)
// Query param: ?refresh=1 pour invalider le cache avant lecture
export default async function handler(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  const isAllowed = allowed.length === 0 || allowed.includes(origin);
  const corsOrigin = isAllowed ? (origin || allowed[0] || '*') : 'null';
  const headers: Record<string,string> = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (!isAllowed && origin) console.warn('[trading-data] 🚫 Origine non autorisée:', origin);
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('refresh') === '1') invalidateTradingSnapshotCache();
    const snapshot = await getTradingSnapshot();
    return new Response(JSON.stringify(snapshot), { status: 200, headers });
  } catch (e) {
    console.error('[trading-data] ❌ Error:', (e as any)?.message || e);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, headers });
  }
}