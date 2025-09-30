import { signJwt } from '../../app/auth/server-auth';
import { getSingleAllowedUser, secureEqual, toPublic } from '../_lib/auth-user.mts';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Méthode non autorisée' 
      }), { status: 405, headers });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'JWT_SECRET manquant côté serveur' 
      }), { status: 500, headers });
    }

    const body = await req.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Identifiants requis' 
      }), { status: 400, headers });
    }

    const user = getSingleAllowedUser();
    if (username !== user.username || !secureEqual(user.password, password)) {
      await sleep(150);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Identifiants invalides' 
      }), { status: 401, headers });
    }

    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role 
    };
    
    const token = await signJwt(payload, secret, { 
      expiresInSeconds: 60 * 60 * 24 * 7 // 7 jours
    });

    return new Response(JSON.stringify({ 
      success: true,
      data: {
        token, 
        user: toPublic(user)
      }
    }), { 
      status: 200, 
      headers 
    });

  } catch (e: any) {
    console.error('Erreur de login:', e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Erreur serveur', 
      message: e?.message 
    }), { status: 500, headers });
  }
}
