import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  LogoutResponse,
} from '../types/auth.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';
export const AUTH_BANNED_EVENT = 'auth:banned';

type BannedEventDetail = {
  banReason?: string;
  banDuration?: string;
};

// Interceptor para adicionar o token em todas as requisições.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação e sinalizar logout global.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const responseData = error.response?.data as { code?: string; error?: string; banReason?: string; banDuration?: string } | undefined;
    const isBannedResponse = (status === 401 || status === 403)
      && (responseData?.code === 'USER_BANNED' || responseData?.error === 'Conta Banida');

    if (isBannedResponse) {
      const detail: BannedEventDetail = {
        banReason: responseData?.banReason,
        banDuration: responseData?.banDuration,
      };

      window.dispatchEvent(new CustomEvent<BannedEventDetail>(AUTH_BANNED_EVENT, { detail }));
      return Promise.reject(error);
    }

    if (status === 401) {
      // Token inválido ou expirado
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Registra novo usuário.
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  // Realiza login e salva sessão local.
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    const { token, user } = response.data;

    // Salvar token e usuário no localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    return response.data;
  },

  // Encerra sessão no backend e limpa storage local.
  async logout(): Promise<LogoutResponse> {
    const response = await api.post<LogoutResponse>('/auth/logout');

    // Remover token e usuário do localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return response.data;
  },

  // Exclui conta do usuário autenticado.
  async deleteProfile(): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>('/auth/me');

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return response.data;
  },

  async checkSessionStatus(): Promise<{ active: boolean }> {
    const response = await api.get<{ active: boolean }>('/auth/session-status');
    return response.data;
  },

  getStoredUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};
