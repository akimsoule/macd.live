import { useState } from 'react';
import { LogIn, Eye, EyeOff, Lock, User, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      
      if (success) {
        onLoginSuccess?.();
      } else {
        setError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      }
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card shadow-lg rounded-lg border border-border">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mb-4 flex justify-center">
              <img 
                src="/logo.png" 
                alt="MACD Live Logo" 
                className="w-16 h-16 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold">Administration</h1>
            <p className="text-muted-foreground">
              Connectez-vous pour accéder au panel admin
            </p>
          </div>

          {/* Lien retour vers l'accueil */}
          <div className="mb-4">
            <Link 
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Link>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Champ Username */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="votre@email.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Champ Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              </div>
            )}

            {/* Bouton de connexion */}
            <div className="mt-6">
              <button
                type="submit"
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isLoading || !username || !password}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    Connexion...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Se connecter
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Informations */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center text-sm text-muted-foreground">
              <p>🔒 Accès réservé aux administrateurs</p>
              <p className="mt-1">
                Panel d'administration pour MACD Live
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}