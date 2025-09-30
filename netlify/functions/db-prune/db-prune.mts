import type { Config } from '@netlify/functions';
import { prisma } from '../../app/trading/db';

export const config: Config = {
  schedule: '0 3 * * *' // 03:00 UTC quotidien
};

interface Counts {
  deletedTrades: number;
  deletedEquity: number;
  deletedMetrics: number;
}

export default async function handler() {
  const summary: Counts = { deletedTrades: 0, deletedEquity: 0, deletedMetrics: 0 };
  try {
    const now = new Date();
    const tradeCutoff = new Date(now.getTime() - 365*24*60*60*1000); // 365 jours
    const equityCutoff = new Date(now.getTime() - 90*24*60*60*1000);  // 90 jours
    const metricHourlyCutoff = new Date(now.getTime() - 30*24*60*60*1000); // 30 jours

    // Purge trades anciens
    try {
      const delT = await prisma.trade.deleteMany({ where: { exitTime: { lt: tradeCutoff } } });
      summary.deletedTrades = delT.count;
    } catch (e) {
      console.warn('⚠️ purge trades erreur:', (e as any)?.message || e);
    }

    // Purge equity snapshots anciens
    try {
      const delE = await prisma.equitySnapshot.deleteMany({ where: { timestamp: { lt: equityCutoff } } });
      summary.deletedEquity = delE.count;
    } catch (e) {
      console.warn('⚠️ purge equity erreur:', (e as any)?.message || e);
    }

    // Purge metric snapshots (garder 1 par jour au-delà de 30 jours)
    try {
      const oldMetrics = await prisma.metricSnapshot.findMany({
        where: { timestamp: { lt: metricHourlyCutoff } },
        select: { id: true, timestamp: true }
      });
      const keepIds = new Set<string>();
      const byDay: Record<string, { id: string; ts: Date }> = {};
      for (const m of oldMetrics) {
        const day = m.timestamp.toISOString().slice(0,10);
        if (!byDay[day] || byDay[day].ts < m.timestamp) {
          byDay[day] = { id: m.id, ts: m.timestamp };
        }
      }
      Object.values(byDay).forEach(d => keepIds.add(d.id));
      const toDelete = oldMetrics.filter(m => !keepIds.has(m.id)).map(m => m.id);
      if (toDelete.length) {
        const delM = await prisma.metricSnapshot.deleteMany({ where: { id: { in: toDelete } } });
        summary.deletedMetrics = delM.count;
      }
    } catch (e) {
      console.warn('⚠️ purge metrics erreur:', (e as any)?.message || e);
    }

    console.log('✅ db-prune terminé', summary);
  } catch (e) {
    console.error('❌ db-prune échec global:', (e as any)?.message || e);
  }
  return new Response(JSON.stringify({ ok: true, ...summary }), { status: 200 });
}
