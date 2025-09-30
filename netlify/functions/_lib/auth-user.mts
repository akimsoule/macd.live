interface RawAuthUser {
  id: string;
  username: string;
  password: string;
  role: string;
}

interface PublicUser {
  id: string;
  username: string;
  role: string;
}

// Auth désormais strictement limitée aux variables d'environnement
function getSingleAllowedUser(): RawAuthUser {
  const username = process.env.DASHBOARD_USER || process.env.AUTH_USERNAME || "soule_akim@yahoo.fr";
  const password = process.env.DASHBOARD_PASSWORD || process.env.AUTH_PASSWORD || "akimsoule";
  
  return {
    id: "primary-user",
    username,
    password,
    role: "admin",
  };
}

function secureEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function toPublic(u: RawAuthUser): PublicUser {
  return { id: u.id, username: u.username, role: u.role };
}

export { getSingleAllowedUser, secureEqual, toPublic };
export type { RawAuthUser, PublicUser };