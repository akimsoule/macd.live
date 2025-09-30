import { useAuth } from '../hooks/useAuth';
import LoginForm from './LoginForm';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Afficher un loader pendant la vérification du token
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Si non authentifié, afficher le formulaire de connexion
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Si authentifié, afficher le contenu protégé
  return <>{children}</>;
}