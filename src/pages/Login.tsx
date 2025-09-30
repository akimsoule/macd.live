import { FormEvent, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const ok = await login(username, password);
    if (ok) navigate('/'); else setError('Identifiants invalides');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 bg-card p-6 rounded-lg border border-border shadow-card">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-card-foreground">Connexion</h1>
          <p className="text-xs text-muted-foreground">Accès restreint au Dashboard</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="login-username" className="text-xs font-medium text-muted-foreground">Utilisateur</label>
            <input id="login-username" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1">
            <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">Mot de passe</label>
            <input id="login-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <button type="submit" disabled={loading} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
