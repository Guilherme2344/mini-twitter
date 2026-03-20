import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/api.service';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import type { AxiosError } from 'axios';

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'E-mail inválido' }),
  password: z.string().min(4, { message: 'Senha deve ter no mínimo 4 caracteres' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      authService.register(data),
    onSuccess: () => {
      setSuccessMessage('Cadastro realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      const message = error.response?.data?.error || 'Erro ao fazer cadastro';
      setApiError(message);
    },
  });

  // Envia cadastro e redireciona para login quando sucesso.
  const onSubmit = (data: RegisterFormData) => {
    setApiError('');
    setSuccessMessage('');
    const registerData = {
      name: data.name,
      email: data.email,
      password: data.password,
    };
    registerMutation.mutate(registerData);
  };

  return (
    <div className={isDarkMode ? 'min-h-screen bg-[#0f172a] flex items-center justify-center p-4' : 'min-h-screen bg-slate-100 flex items-center justify-center p-4'}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <h1 className={isDarkMode ? 'text-4xl font-bold text-white text-center mb-12' : 'text-4xl font-bold text-slate-900 text-center mb-12'}>Mini Twitter</h1>

        {/* Tabs */}
        <div className="flex mb-12">
          <Link
            to="/login"
            className={isDarkMode ? 'flex-1 text-center pb-4 text-gray-400 font-medium border-b-2 border-gray-700 hover:text-gray-300' : 'flex-1 text-center pb-4 text-gray-500 font-medium border-b-2 border-gray-300 hover:text-gray-700'}
          >
            Login
          </Link>
          <Link
            to="/register"
            className={isDarkMode ? 'flex-1 text-center pb-4 text-white font-medium border-b-2 border-blue-500' : 'flex-1 text-center pb-4 text-slate-900 font-medium border-b-2 border-blue-500'}
          >
            Cadastrar
          </Link>
        </div>

        {/* Form Container */}
        <div>
          <h2 className={isDarkMode ? 'text-3xl font-bold text-white mb-2 text-center sm:text-left' : 'text-3xl font-bold text-slate-900 mb-2 text-center sm:text-left'}>Olá, vamos começar!</h2>
          <p className={isDarkMode ? 'text-gray-400 mb-8 text-center sm:text-left' : 'text-gray-600 mb-8 text-center sm:text-left'}>
            Por favor, insira os dados solicitados para fazer cadastro.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Nome</label>
              <div className="relative">
                <input
                  {...register('name')}
                  type="text"
                  placeholder="Insira o seu nome"
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12'}
                />
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              {errors.name && (
                <p className="mt-2 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* E-mail Field */}
            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>E-mail</label>
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Insira o seu e-mail"
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12'}
                />
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Senha</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Insira a sua senha"
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={isDarkMode ? 'absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400' : 'absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Confirmar Senha</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirme a sua senha"
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={isDarkMode ? 'absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400' : 'absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Error Message */}
            {apiError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl">
                {apiError}
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-xl">
                {successMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-medium py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registerMutation.isPending ? 'Cadastrando...' : 'Continuar'}
            </button>
          </form>

          {/* Footer */}
          <p className={isDarkMode ? 'text-center text-gray-500 text-sm mt-8' : 'text-center text-gray-600 text-sm mt-8'}>
            Ao clicar em continuar, você concorda com nossos{' '}
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-700'}>Termos de Serviço</span> e{' '}
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-700'}>Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
