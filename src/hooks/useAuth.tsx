import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'auth_token';

export interface UseAuth {
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): UseAuth {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEY, token); else localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json.token) { setToken(json.token); return true; }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => { setToken(null); }, []);

  return { token, loading, login, logout };
}

export function authHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
