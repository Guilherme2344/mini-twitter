import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { authService } from '../services/api.service';
import {
  profilePreferencesService,
  type ProfilePreferences,
} from '../services/profile-preferences.service';

const profileSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Nome é obrigatório' })
    .min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  email: z.email({ message: 'E-mail inválido' }),
  bio: z.string().max(160, { message: 'Bio deve ter no máximo 160 caracteres' }).optional(),
  avatarUrl: z.url({ message: 'URL inválida' }).optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

// Verifica se valor é um data URL de imagem enviado por upload local.
const isUploadDataUrl = (value?: string) => value?.startsWith('data:image/') ?? false;

// Gera avatar padrão com inicial do usuário.
const getDefaultAvatarDataUrl = (name?: string) => {
  const initial = (name?.charAt(0).toUpperCase() || 'U').replace(/[^A-ZÀ-ÿ0-9]/g, 'U');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <defs>
        <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#9333ea" />
        </linearGradient>
      </defs>
      <rect width="80" height="80" fill="url(#avatarGradient)" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="34" font-family="Arial, sans-serif" fill="#ffffff" font-weight="700">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { isDarkMode } = useTheme();
  const isAdminUser = user?.email?.toLowerCase() === 'minitwitteradmin@access.total.ok';
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showProfileSavedModal, setShowProfileSavedModal] = useState(false);
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
  const [deleteProfileError, setDeleteProfileError] = useState<string | null>(null);
  const [uploadedAvatarDataUrl, setUploadedAvatarDataUrl] = useState<string | null>(null);
  const [draftUploadedAvatarDataUrl, setDraftUploadedAvatarDataUrl] = useState<string | null>(null);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState('');
  const [avatarUploadName, setAvatarUploadName] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  useBodyScrollLock(showAvatarModal || showProfileSavedModal || showDeleteProfileModal);

  const preferences = useMemo<ProfilePreferences>(() => {
    return profilePreferencesService.get(user?.id);
  }, [user?.id]);

  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | undefined>(preferences.avatarUrl);
  const [hasAvatarSelectionChanged, setHasAvatarSelectionChanged] = useState(false);
  const initialAvatarUrl = isUploadDataUrl(preferences.avatarUrl) ? '' : preferences.avatarUrl || '';
  const hasSavedUploadedAvatar = isUploadDataUrl(savedAvatarUrl);
  const uploadLabel = avatarUploadName || (hasSavedUploadedAvatar ? 'Imagem de upload salva' : null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      bio: preferences.bio || '',
      avatarUrl: initialAvatarUrl,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const avatarUrlInput = watch('avatarUrl');
  const avatarPreviewUrl = uploadedAvatarDataUrl || avatarUrlInput || savedAvatarUrl;
  const defaultAvatarUrl = useMemo(() => getDefaultAvatarDataUrl(user?.name), [user?.name]);
  const resolvedAvatarPreviewUrl = avatarPreviewUrl || defaultAvatarUrl;
  const avatarModalPreviewUrl = draftUploadedAvatarDataUrl || draftAvatarUrl || resolvedAvatarPreviewUrl;

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      name: data.name,
      email: data.email,
    };

    const nextAvatarUrl = hasAvatarSelectionChanged
      ? (uploadedAvatarDataUrl || data.avatarUrl || undefined)
      : savedAvatarUrl;

    const updatedPreferences: ProfilePreferences = {
      bio: data.bio?.trim() || undefined,
      avatarUrl: nextAvatarUrl,
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    profilePreferencesService.set(user.id, updatedPreferences);
    setSavedAvatarUrl(updatedPreferences.avatarUrl);
    setHasAvatarSelectionChanged(false);

    setShowProfileSavedModal(true);
    setUploadedAvatarDataUrl(null);
    setAvatarUploadName(null);
    setAvatarUploadError(null);
  };

  // Converte arquivo selecionado para data URL para preview.
  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
      reader.readAsDataURL(file);
    });

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarUploadName(null);
      setAvatarUploadError('Imagem muito grande. O limite é 5MB.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setDraftUploadedAvatarDataUrl(dataUrl);
      setDraftAvatarUrl('');
      setAvatarUploadName(file.name);
      setAvatarUploadError(null);
    } catch {
      setDraftUploadedAvatarDataUrl(null);
      setAvatarUploadName(null);
      setAvatarUploadError('Não foi possível carregar a imagem. Tente novamente.');
    }
  };

  const clearAvatarUpload = () => {
    setDraftUploadedAvatarDataUrl(null);
    setAvatarUploadName(null);
    setAvatarUploadError(null);
  };

  const handleAvatarUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftAvatarUrl(event.target.value);

    if (event.target.value) {
      setDraftUploadedAvatarDataUrl(null);
      setAvatarUploadName(null);
      setAvatarUploadError(null);
    }
  };

  const handleOpenAvatarModal = () => {
    const currentUrl = avatarUrlInput || (isUploadDataUrl(savedAvatarUrl) ? '' : savedAvatarUrl || '');
    const currentUploaded = uploadedAvatarDataUrl || (isUploadDataUrl(savedAvatarUrl) ? savedAvatarUrl || null : null);

    setDraftAvatarUrl(currentUrl);
    setDraftUploadedAvatarDataUrl(currentUploaded);
    setAvatarUploadName(currentUploaded ? 'Imagem selecionada' : null);
    setAvatarUploadError(null);
    setShowAvatarModal(true);
  };

  const handleCloseAvatarModal = () => {
    setShowAvatarModal(false);
    setDraftAvatarUrl('');
    setDraftUploadedAvatarDataUrl(null);
    setAvatarUploadName(null);
    setAvatarUploadError(null);
  };

  // Confirma e aplica alteração de avatar nas preferências locais.
  const handleConfirmAvatarChange = () => {
    if (draftAvatarUrl && !z.url().safeParse(draftAvatarUrl).success) {
      setAvatarUploadError('URL inválida');
      return;
    }

    setUploadedAvatarDataUrl(draftUploadedAvatarDataUrl);
    setValue('avatarUrl', draftAvatarUrl, { shouldValidate: true, shouldDirty: true });
    setHasAvatarSelectionChanged(true);
    setShowAvatarModal(false);
    setAvatarUploadError(null);
  };

  const deleteProfileMutation = useMutation({
    mutationFn: () => authService.deleteProfile(),
    onSuccess: () => {
      setDeleteProfileError(null);
      setShowDeleteProfileModal(false);
      setUser(null);
      profilePreferencesService.clear(user?.id);
      navigate('/register');
    },
    onError: (error: unknown) => {
      const maybeAxios = error as { response?: { data?: { error?: string } } };
      setDeleteProfileError(maybeAxios.response?.data?.error || 'Não foi possível excluir seu perfil.');
    },
  });

  if (isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={isDarkMode ? 'min-h-screen bg-[#0f172a]' : 'min-h-screen bg-slate-100'}>
      <header className={isDarkMode ? 'bg-[#1e293b] border-b border-gray-700 sticky top-0 z-40' : 'bg-white border-b border-gray-200 sticky top-0 z-40'}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className={isDarkMode ? 'text-xl sm:text-2xl font-bold text-white' : 'text-xl sm:text-2xl font-bold text-slate-900'}>Personalização de Perfil</h1>
          <Link
            to="/"
            className={isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full transition' : 'bg-gray-200 hover:bg-gray-300 text-slate-800 px-4 py-2 rounded-full transition'}
          >
            Voltar ao feed
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 sm:p-8' : 'bg-white border border-gray-200 rounded-2xl p-6 sm:p-8'}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
            <button
              type="button"
              onClick={handleOpenAvatarModal}
              className={isDarkMode ? 'w-14 h-14 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden border border-gray-600 hover:border-blue-400 transition' : 'w-14 h-14 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden border border-gray-300 hover:border-blue-400 transition'}
              title="Personalizar foto de perfil"
            >
              <img
                src={resolvedAvatarPreviewUrl}
                alt="Foto de perfil"
                onError={(event) => {
                  if (event.currentTarget.src !== defaultAvatarUrl) {
                    event.currentTarget.src = defaultAvatarUrl;
                  }
                }}
                className="w-full h-full rounded-full object-cover"
              />
            </button>
            <div>
              <h2 className={isDarkMode ? 'text-white text-xl font-bold' : 'text-slate-900 text-xl font-bold'}>{user?.name || 'Usuário'}</h2>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Personalize seus dados de exibição</p>
              <p className="text-gray-500 text-sm mt-1">Clique na foto para alterar</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Nome</label>
              <input
                {...register('name')}
                type="text"
                className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                placeholder="Seu nome"
              />
              {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>E-mail</label>
              <input
                {...register('email')}
                type="email"
                className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                placeholder="seuemail@exemplo.com"
              />
              {errors.email && <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Bio (opcional)</label>
              <textarea
                {...register('bio')}
                rows={3}
                className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none'}
                placeholder="Escreva uma breve descrição sobre você"
              />
              {errors.bio && <p className="mt-2 text-sm text-red-500">{errors.bio.message}</p>}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-3 rounded-full transition font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteProfileError(null);
                  setShowDeleteProfileModal(true);
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-full transition font-medium"
              >
                Excluir perfil
              </button>
            </div>
          </form>
        </div>
      </main>

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto'}>
            <h3 className={isDarkMode ? 'text-white text-2xl font-bold mb-4' : 'text-slate-900 text-2xl font-bold mb-4'}>Personalizar foto de perfil</h3>

            <div className="flex justify-center mb-5">
              <div className={isDarkMode ? 'w-24 h-24 rounded-full overflow-hidden border border-gray-600 bg-linear-to-br from-blue-500 to-purple-600' : 'w-24 h-24 rounded-full overflow-hidden border border-gray-300 bg-linear-to-br from-blue-500 to-purple-600'}>
                <img
                  src={avatarModalPreviewUrl}
                  alt="Preview da foto de perfil"
                  onError={(event) => {
                    if (event.currentTarget.src !== defaultAvatarUrl) {
                      event.currentTarget.src = defaultAvatarUrl;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>URL da foto de perfil (opcional)</label>
                <input
                  onChange={handleAvatarUrlChange}
                  value={draftAvatarUrl}
                  type="url"
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                  placeholder="https://exemplo.com/avatar.jpg"
                />
                {errors.avatarUrl && <p className="mt-2 text-sm text-red-500">{errors.avatarUrl.message}</p>}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-white text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Upload da foto de perfil (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className={isDarkMode ? 'w-full bg-transparent border border-gray-600 rounded-xl px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]'}
                />
                {uploadLabel && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={isDarkMode ? 'text-sm text-gray-300 truncate' : 'text-sm text-gray-700 truncate'}>Arquivo selecionado: {uploadLabel}</p>
                    <button
                      type="button"
                      onClick={clearAvatarUpload}
                      className="text-sm text-red-400 hover:text-red-300 transition"
                    >
                      Remover
                    </button>
                  </div>
                )}
                {avatarUploadError && <p className="mt-2 text-sm text-red-500">{avatarUploadError}</p>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                type="button"
                onClick={handleCloseAvatarModal}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-full transition font-medium' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-3 rounded-full transition font-medium'}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleConfirmAvatarChange}
                className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-3 rounded-full transition font-medium"
              >
                Confirmar imagem
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileSavedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Perfil atualizado</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              As alterações do seu perfil foram salvas com sucesso.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowProfileSavedModal(false)}
                className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-2 px-4 rounded-full transition font-medium"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Excluir perfil?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              Tem certeza? Seus posts também serão excluídos e esta ação não poderá ser desfeita.
            </p>

            {deleteProfileError && <p className="mb-4 text-sm text-red-500">{deleteProfileError}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteProfileModal(false)}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 px-4 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteProfileMutation.mutate()}
                disabled={deleteProfileMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full transition disabled:opacity-50"
              >
                {deleteProfileMutation.isPending ? 'Excluindo...' : 'Excluir perfil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
