import { requireAuth } from '../app/auth/server-auth';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const authResult = await requireAuth(req);
    
    if (!authResult) {
      return new Response(JSON.stringify({ 
        success: false, 
        data: { valid: false },
        error: 'Token invalide ou manquant' 
      }), { 
        status: 401, 
        headers 
      });
    }

    // Token valide, retourner les informations de l'utilisateur
    const user = {
      id: authResult.payload.sub || '1',
      username: authResult.payload.username || 'admin',
      role: authResult.payload.role || 'admin'
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        valid: true,
        user
      }
    }), {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('Erreur lors de la vérification du token:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      data: { valid: false },
      error: 'Erreur serveur' 
    }), { 
      status: 500, 
      headers 
    });
  }
}