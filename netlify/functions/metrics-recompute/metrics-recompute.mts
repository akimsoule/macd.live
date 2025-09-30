import type { Config } from '@netlify/functions';
import { recomputeAndPersistMetrics } from '../../app/trading/metrics-db.js';
import { invalidateTradingSnapshotCache } from '../../app/trading/data-service.js';

export const config: Config = {
  schedule: '*/15 * * * *'
};

export default async function handler() {
  try {
    const snapshot = await recomputeAndPersistMetrics();
    if (snapshot) {
      invalidateTradingSnapshotCache();
      console.log('✅ MetricSnapshot rafraîchi:', snapshot.timestamp);
    } else {
      console.log('ℹ️ Aucun trade pour calcul métriques');
    }
  } catch (e) {
    console.error('❌ metrics-recompute échec:', (e as any)?.message || e);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
