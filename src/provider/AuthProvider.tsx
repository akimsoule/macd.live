import { useEffect, useState, useCallback, type ReactNode } from "react";
import type { AuthContextType, User } from "../types/auth";
import { AuthContext } from "../contexts/AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyToken = useCallback(async (tokenToVerify: string) => {
    try {
      const response = await fetch("/api/auth-verify", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
   
      if (result.success && result.data.valid) {
        setToken(tokenToVerify);
        setUser(result.data.user);
        localStorage.setItem("auth_token", tokenToVerify);
        console.log("✅ Authentification automatique réussie");
      } else {
        // Token invalide, nettoyer le localStorage
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la vérification du token:", error);
      localStorage.removeItem("auth_token");
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Vérifier si un token est stocké au démarrage
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [verifyToken]);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (result.success && result.data?.token) {
        setToken(result.data.token);
        setUser(result.data.user);
        localStorage.setItem("auth_token", result.data.token);
        console.log("✅ Connexion réussie");
        return true;
      } else {
        console.error("❌ Échec de la connexion:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ Erreur lors de la connexion:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    console.log("✅ Déconnexion réussie");
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};