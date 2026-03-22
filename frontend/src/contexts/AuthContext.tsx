/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/auth.types';
import { AUTH_BANNED_EVENT, AUTH_UNAUTHORIZED_EVENT, authService } from '../services/api.service';
import { themePreferencesService } from '../services/theme-preferences.service';

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
  const isDarkMode = themePreferencesService.getThemeModeForSession(user?.id) === 'dark';

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

  useEffect(() => {
    if (!user || banNotice || isLogoutPending) {
      return;
    }

    const checkSession = async () => {
      try {
        await authService.checkSessionStatus();
      } catch {
        // Erros de sessão/autorização são tratados globalmente pelos interceptors.
      }
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, banNotice, isLogoutPending]);

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h2 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Conta Banida</h2>
            <p className={isDarkMode ? 'text-gray-300 mb-2' : 'text-gray-700 mb-2'}>
              Sua conta foi banida pelo seguinte motivo: {banNotice.reason}
            </p>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-700 mb-6'}>
              Sua conta está banida pelo seguinte tempo: {banNotice.duration}
            </p>
            <button
              type="button"
              onClick={logout}
              disabled={isLogoutPending}
              className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-2 px-4 rounded-full transition font-medium disabled:opacity-60"
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
