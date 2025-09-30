import type { Config } from "@netlify/functions"
import { runSymbol } from '../../app/trading/trader';

export default async (req: Request) => {
  const symbol = "0G/USDT:USDT";
  let next_run: string | undefined = undefined;
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => undefined);
      if (body && typeof body === 'object' && 'next_run' in body) {
        // @ts-ignore
        next_run = body.next_run;
      }
    }
  } catch {}
  
  try {
  console.log(`⏰ Déclenchement cron pour ${symbol}. Prochaine exécution:`, next_run || 'inconnue');
    
    const result = await runSymbol(symbol);
    
    console.log(`✅ Trading ${symbol} terminé:`, {
      success: true,
      symbol,
      timestamp: new Date().toISOString(),
      result: result || { message: 'Aucune action requise' }
    });
    
  } catch (error) {
    console.error(`❌ Erreur dans la fonction cron ${symbol}:`, error);
    
    console.log(`❌ Trading ${symbol} échoué:`, {
      success: false,
      symbol,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
}

export const config: Config = {
  schedule: "@hourly"
}