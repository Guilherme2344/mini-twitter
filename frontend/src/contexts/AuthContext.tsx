/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/auth.types';
import { AUTH_BANNED_EVENT, AUTH_UNAUTHORIZED_EVENT, authService } from '../services/api.service';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type BanNotice = {
  reason: string;
  duration: string;
};

// Provider responsável por restaurar e manter a sessão autenticada.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [banNotice, setBanNotice] = useState<BanNotice | null>(null);
  const [isLogoutPending, setIsLogoutPending] = useState(false);

  useEffect(() => {
    // Restaura sessão salva localmente ao iniciar a aplicação.
    const storedUser = authService.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    // Escuta evento global de 401 para limpar sessão no frontend.
    const handleUnauthorized = () => {
      setUser(null);
      setBanNotice(null);
      setIsLogoutPending(false);
    };

    const handleBanned = (event: Event) => {
      const customEvent = event as CustomEvent<{ banReason?: string; banDuration?: string }>;
      setBanNotice({
        reason: customEvent.detail?.banReason || 'Não informado',
        duration: customEvent.detail?.banDuration || 'Não informado',
      });
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_BANNED_EVENT, handleBanned);
    setIsLoading(false);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_BANNED_EVENT, handleBanned);
    };
  }, []);

  // Encerra sessão no backend e limpa estado local.
  const logout = async () => {
    setIsLogoutPending(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      setUser(null);
      setBanNotice(null);
      setIsLogoutPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        setUser,
        logout,
      }}
    >
      {children}
      {banNotice && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-red-200 shadow-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Conta banida</h2>
            <p className="text-sm text-slate-700">
              Sua conta foi banida e o uso do sistema está bloqueado.
            </p>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
              <p className="text-sm text-slate-800">
                <span className="font-semibold">Motivo:</span> {banNotice.reason}
              </p>
              <p className="text-sm text-slate-800">
                <span className="font-semibold">Duração:</span> {banNotice.duration}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={isLogoutPending}
              className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 transition"
            >
              {isLogoutPending ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
