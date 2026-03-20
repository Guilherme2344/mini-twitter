import { useState, useEffect, useRef, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { postService } from '../services/post.service';
import type { Post, CreatePostRequest, UpdatePostRequest, PostSortOption } from '../types/post.types';
import PostCard from '../components/PostCard';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { profilePreferencesService } from '../services/profile-preferences.service';
import { useTheme } from '../contexts/ThemeContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AxiosError } from 'axios';

const createPostSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Título é obrigatório' })
    .min(3, { message: 'Título deve ter pelo menos 3 caracteres' }),
  content: z.string().min(1, { message: 'Conteúdo é obrigatório' }),
  imageUrl: z.url({ message: 'URL inválida' }).optional().or(z.literal('')),
});

type CreatePostForm = z.infer<typeof createPostSchema>;

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

// Gera avatar padrão em SVG quando usuário não possui foto personalizada.
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

export default function HomePage() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedFilter, setFeedFilter] = useState<'none' | 'oldest' | 'newest' | 'mine'>('none');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [editPostError, setEditPostError] = useState<string | null>(null);
  const { isDarkMode, toggleThemeMode } = useTheme();

  useBodyScrollLock(showCreatePost || !!editingPost || showLogoutConfirm || showMobileMenu);

  const profileAvatarUrl = useMemo(() => {
    return profilePreferencesService.get(user?.id).avatarUrl;
  }, [user?.id]);

  const defaultAvatarUrl = useMemo(() => getDefaultAvatarDataUrl(user?.name), [user?.name]);
  const resolvedAvatarUrl = profileAvatarUrl || defaultAvatarUrl;
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  const isAdminUser = user?.email?.toLowerCase() === 'minitwitteradmin@access.total.ok';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const observerTarget = useRef<HTMLDivElement | null>(null);
  const currentUserId = user?.id;
  const sortOption: PostSortOption = feedFilter === 'oldest' || feedFilter === 'newest' ? feedFilter : 'none';
  const filterAuthorId = feedFilter === 'mine' ? currentUserId : undefined;

  // Debounce da busca para evitar chamadas excessivas da API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query infinita do feed com paginação e filtros atuais.
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['posts', debouncedSearch, sortOption, filterAuthorId],
    queryFn: ({ pageParam = 1 }) =>
      postService.getPosts(pageParam, 3, debouncedSearch, sortOption, filterAuthorId),
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage * lastPage.limit <= lastPage.total ? nextPage : undefined;
    },
    initialPageParam: 1,
  });

  // Observer responsável por carregar próxima página ao chegar no fim.
  useEffect(() => {
    if (!observerTarget.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '0px' }
    );

    observer.observe(observerTarget.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: errorsCreate },
    reset: resetCreate,
    watch: watchCreate,
  } = useForm<CreatePostForm>({
    resolver: zodResolver(createPostSchema),
  });

  const imageUrlField = registerCreate('imageUrl');
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedImageUrl = watchCreate('imageUrl');
  const createImagePreviewUrl = uploadedImageDataUrl || watchedImageUrl || '';
  const editImagePreviewUrl = uploadedImageDataUrl || watchedImageUrl || editingPost?.imageUrl || '';

  const createMutation = useMutation({
    mutationFn: postService.createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      resetCreate();
      setUploadedImageDataUrl(null);
      setUploadedImageName(null);
      setImageUploadError(null);
      setShowCreatePost(false);
    },
  });

  const createPostErrorMessage = (() => {
    const error = createMutation.error as AxiosError<{ error?: string }> | null;
    return error?.response?.data?.error || error?.message || null;
  })();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePostRequest }) =>
      postService.updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setUploadedImageDataUrl(null);
      setUploadedImageName(null);
      setImageUploadError(null);
      setEditPostError(null);
      setEditingPost(null);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      const message = error.response?.data?.error || 'Não foi possível editar o post.';
      setEditPostError(message);
    },
  });

  const clearUploadedImage = () => {
    setUploadedImageDataUrl(null);
    setUploadedImageName(null);
    setImageUploadError(null);
  };

  const clearUploadedImageData = () => {
    setUploadedImageDataUrl(null);
    setUploadedImageName(null);
  };

  // Converte imagem local em data URL para preview/upload.
  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
      reader.readAsDataURL(file);
    });

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      clearUploadedImageData();
      setImageUploadError('Imagem muito grande. O limite é 5MB.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setUploadedImageDataUrl(dataUrl);
      setUploadedImageName(file.name);
      setImageUploadError(null);
    } catch {
      clearUploadedImage();
      setImageUploadError('Não foi possível carregar a imagem. Tente novamente.');
    }
  };

  const handleImageUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    imageUrlField.onChange(event);

    if (event.target.value) {
      clearUploadedImage();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowLogoutConfirm(false);
    setShowMobileMenu(false);
  };

  // Cria novo post com dados do formulário e imagem opcional.
  const onCreatePost = (data: CreatePostForm) => {
    const postData: CreatePostRequest = {
      title: data.title,
      content: data.content,
      imageUrl: uploadedImageDataUrl || data.imageUrl || undefined,
    };
    createMutation.mutate(postData);
  };

  return (
    <div className={isDarkMode ? 'min-h-screen bg-[#0f172a] flex flex-col' : 'min-h-screen bg-slate-100 flex flex-col'}>
      {/* Header */}
      <header className={isDarkMode ? 'bg-[#1e293b] border-b border-gray-700 sticky top-0 z-40' : 'bg-white border-b border-gray-200 sticky top-0 z-40'}>
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="lg:hidden animate-fade-in">
            <div className="relative flex items-center justify-center">
              <h1 className={isDarkMode ? 'text-xl font-bold text-white whitespace-nowrap' : 'text-xl font-bold text-slate-900 whitespace-nowrap'}>Mini Twitter</h1>
              <button
                type="button"
                onClick={() => setShowMobileMenu((current) => !current)}
                aria-label="Abrir menu"
                aria-expanded={showMobileMenu}
                className={isDarkMode ? 'absolute right-0 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-600 bg-[#0f172a] text-white transition active:scale-95' : 'absolute right-0 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-slate-900 transition active:scale-95'}
              >
                <div className="relative h-4 w-5">
                  <span className={isDarkMode ? `absolute left-0 h-0.5 w-5 bg-white transition-all ${showMobileMenu ? 'top-2 rotate-45' : 'top-0'}` : `absolute left-0 h-0.5 w-5 bg-slate-900 transition-all ${showMobileMenu ? 'top-2 rotate-45' : 'top-0'}`} />
                  <span className={isDarkMode ? `absolute left-0 top-2 h-0.5 w-5 bg-white transition-all ${showMobileMenu ? 'opacity-0' : 'opacity-100'}` : `absolute left-0 top-2 h-0.5 w-5 bg-slate-900 transition-all ${showMobileMenu ? 'opacity-0' : 'opacity-100'}`} />
                  <span className={isDarkMode ? `absolute left-0 h-0.5 w-5 bg-white transition-all ${showMobileMenu ? 'top-2 -rotate-45' : 'top-4'}` : `absolute left-0 h-0.5 w-5 bg-slate-900 transition-all ${showMobileMenu ? 'top-2 -rotate-45' : 'top-4'}`} />
                </div>
              </button>
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Buscar por título, conteúdo ou autor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-full px-4 py-2 pl-11 pr-11 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-full px-4 py-2 pl-11 pr-11 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                  />
                  <svg
                    className={isDarkMode ? 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' : 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500'}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Limpar busca"
                      className={isDarkMode ? 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition' : 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-900 transition'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <select
                  value={feedFilter}
                  onChange={(event) => setFeedFilter(event.target.value as 'none' | 'oldest' | 'newest' | 'mine')}
                  className={isDarkMode ? 'w-40 bg-[#0f172a] border border-gray-600 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition' : 'w-40 bg-white border border-gray-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 transition'}
                >
                  <option value="none">Sem filtro</option>
                  <option value="newest">Mais recente</option>
                  <option value="oldest">Mais antigo</option>
                  {currentUserId && <option value="mine">Meus posts</option>}
                </select>
              </div>
            </div>
          </div>

          <div className="hidden lg:grid lg:grid-cols-[1fr_minmax(320px,768px)_1fr] lg:items-center lg:gap-6 animate-fade-in">
            <div className="flex items-center justify-start min-w-0">
              <h1 className={isDarkMode ? 'text-xl sm:text-2xl font-bold text-white whitespace-nowrap' : 'text-xl sm:text-2xl font-bold text-slate-900 whitespace-nowrap'}>Mini Twitter</h1>
            </div>

            <div className="w-full lg:max-w-3xl lg:shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Buscar por título, conteúdo ou autor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-full px-4 py-2 pl-11 pr-11 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-full px-4 py-2 pl-11 pr-11 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                  />
                  <svg
                    className={isDarkMode ? 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' : 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500'}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Limpar busca"
                      className={isDarkMode ? 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition' : 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-900 transition'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <select
                  value={feedFilter}
                  onChange={(event) => setFeedFilter(event.target.value as 'none' | 'oldest' | 'newest' | 'mine')}
                  className={isDarkMode ? 'w-44 bg-[#0f172a] border border-gray-600 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition' : 'w-44 bg-white border border-gray-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 transition'}
                >
                  <option value="none">Sem filtro</option>
                  <option value="newest">Mais recente</option>
                  <option value="oldest">Mais antigo</option>
                  {currentUserId && <option value="mine">Meus posts</option>}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 min-w-0">
              <p className={isDarkMode ? 'text-gray-200 font-medium hidden xl:block whitespace-nowrap' : 'text-slate-800 font-medium hidden xl:block whitespace-nowrap'}>
                {isAuthenticated ? `${greeting}, ${firstName}` : 'Bem-vindo!'}
              </p>
              <button
                type="button"
                onClick={toggleThemeMode}
                aria-label={isDarkMode ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
                title={isDarkMode ? 'Modo escuro' : 'Modo claro'}
                className={isDarkMode ? 'relative inline-flex h-8 w-16 items-center rounded-full bg-black px-1 transition active:scale-95' : 'relative inline-flex h-8 w-16 items-center rounded-full bg-orange-500 px-1 transition active:scale-95'}
              >
                <span className={isDarkMode ? 'absolute left-2 text-white' : 'absolute right-2 text-white'}>
                  {isDarkMode ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M14.5 2.5a8.5 8.5 0 1 1-8 12.7 7 7 0 0 0 8-12.7z" />
                      <circle cx="5" cy="6" r="1.2" />
                      <circle cx="8" cy="3.8" r="1" />
                      <circle cx="10.4" cy="7.2" r="0.9" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <span
                  className={isDarkMode ? 'absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 translate-x-8 rounded-full bg-white transition-transform' : 'absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 translate-x-0 rounded-full bg-white transition-transform'}
                />
              </button>
              {isAuthenticated ? (
                <>
                  {isAdminUser && (
                    <Link
                      to="/admin"
                      className={isDarkMode ? 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full transition font-medium whitespace-nowrap inline-flex items-center justify-center' : 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full transition font-medium whitespace-nowrap inline-flex items-center justify-center'}
                    >
                      Admin
                    </Link>
                  )}
                  {!isAdminUser && (
                    <Link
                      to="/profile"
                      className={isDarkMode ? 'w-11 h-11 rounded-full overflow-hidden border border-gray-600 hover:border-blue-400 transition block' : 'w-11 h-11 rounded-full overflow-hidden border border-gray-300 hover:border-blue-400 transition block'}
                      title="Ir para personalização de perfil"
                    >
                      <img
                        src={resolvedAvatarUrl}
                        alt="Foto de perfil"
                        onError={(event) => {
                          if (event.currentTarget.src !== defaultAvatarUrl) {
                            event.currentTarget.src = defaultAvatarUrl;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                  )}
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition font-medium whitespace-nowrap inline-flex items-center justify-center gap-2 leading-none active:scale-95"
                  >
                    <span className="leading-none">Sair</span>
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 rounded-full transition font-medium whitespace-nowrap"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className={isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full transition font-medium whitespace-nowrap' : 'bg-gray-200 hover:bg-gray-300 text-slate-800 px-4 py-2 rounded-full transition font-medium whitespace-nowrap'}
                  >
                    Cadastrar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${showMobileMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setShowMobileMenu(false)}
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${showMobileMenu ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className={`${isDarkMode ? 'absolute right-0 top-0 h-full w-[84%] max-w-xs border-l border-gray-700 bg-[#0f172a] p-4 shadow-2xl' : 'absolute right-0 top-0 h-full w-[84%] max-w-xs border-l border-gray-200 bg-white p-4 shadow-2xl'} transform transition-transform duration-300 ease-out ${showMobileMenu ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between mb-6">
              <p className={isDarkMode ? 'text-gray-200 font-medium text-sm' : 'text-slate-800 font-medium text-sm'}>
                {isAuthenticated ? `${greeting}, ${firstName}` : 'Acesse sua conta'}
              </p>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className={isDarkMode ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 text-white' : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-slate-900'}
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className={isDarkMode ? 'rounded-xl border border-gray-700 p-3' : 'rounded-xl border border-gray-200 p-3'}>
                <p className={isDarkMode ? 'text-gray-300 text-sm mb-3' : 'text-gray-600 text-sm mb-3'}>Tema</p>
                <button
                  type="button"
                  onClick={toggleThemeMode}
                  aria-label={isDarkMode ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
                  title={isDarkMode ? 'Modo escuro' : 'Modo claro'}
                  className={isDarkMode ? 'relative inline-flex h-7 w-14 items-center rounded-full bg-black px-1 transition active:scale-95' : 'relative inline-flex h-7 w-14 items-center rounded-full bg-orange-500 px-1 transition active:scale-95'}
                >
                  <span className={isDarkMode ? 'absolute left-2 text-white' : 'absolute right-2 text-white'}>
                    {isDarkMode ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M14.5 2.5a8.5 8.5 0 1 1-8 12.7 7 7 0 0 0 8-12.7z" />
                        <circle cx="5" cy="6" r="1.2" />
                        <circle cx="8" cy="3.8" r="1" />
                        <circle cx="10.4" cy="7.2" r="0.9" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={isDarkMode ? 'absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-7 rounded-full bg-white transition-transform' : 'absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-0 rounded-full bg-white transition-transform'}
                  />
                </button>
              </div>

              {isAuthenticated ? (
                <>
                  {isAdminUser && (
                    <Link
                      to="/admin"
                      onClick={() => setShowMobileMenu(false)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full transition font-medium inline-flex items-center justify-center"
                    >
                      Painel Admin
                    </Link>
                  )}

                  {!isAdminUser && (
                    <Link
                      to="/profile"
                      onClick={() => setShowMobileMenu(false)}
                      className={isDarkMode ? 'w-full rounded-xl border border-gray-700 p-3 inline-flex items-center gap-3 text-gray-200' : 'w-full rounded-xl border border-gray-200 p-3 inline-flex items-center gap-3 text-slate-800'}
                      title="Ir para personalização de perfil"
                    >
                      <img
                        src={resolvedAvatarUrl}
                        alt="Foto de perfil"
                        onError={(event) => {
                          if (event.currentTarget.src !== defaultAvatarUrl) {
                            event.currentTarget.src = defaultAvatarUrl;
                          }
                        }}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="font-medium">Meu perfil</span>
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition font-medium inline-flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Sair</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/login"
                    onClick={() => setShowMobileMenu(false)}
                    className="text-center bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 rounded-full transition font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setShowMobileMenu(false)}
                    className={isDarkMode ? 'text-center bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full transition font-medium' : 'text-center bg-gray-200 hover:bg-gray-300 text-slate-800 px-4 py-2 rounded-full transition font-medium'}
                  >
                    Cadastrar
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Create Post Button */}
        {isAuthenticated ? (
          <button
            onClick={() => {
              clearUploadedImage();
              setShowCreatePost(true);
            }}
            className={isDarkMode ? 'w-full bg-[#1e293b] border border-gray-700 rounded-2xl p-4 sm:p-6 mb-6 hover:border-gray-600 transition text-left interactive-lift' : 'w-full bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-6 hover:border-gray-300 transition text-left interactive-lift'}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                <img
                  src={resolvedAvatarUrl}
                  alt="Foto de perfil"
                  onError={(event) => {
                    if (event.currentTarget.src !== defaultAvatarUrl) {
                      event.currentTarget.src = defaultAvatarUrl;
                    }
                  }}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <p className={isDarkMode ? 'text-gray-300 text-base sm:text-lg' : 'text-gray-600 text-base sm:text-lg'}>E aí, o que está rolando? Clique aqui e poste algo!</p>
            </div>
          </button>
        ) : (
          <div className={isDarkMode ? 'w-full bg-[#1e293b] border border-gray-700 rounded-2xl p-4 sm:p-6 mb-6' : 'w-full bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-6'}>
            <p className={isDarkMode ? 'text-gray-300 text-base sm:text-lg' : 'text-gray-600 text-base sm:text-lg'}>
              Faça login para publicar e interagir com os posts.
            </p>
          </div>
        )}

        {/* Posts List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className={isDarkMode ? 'text-gray-300 mt-4' : 'text-gray-600 mt-4'}>Carregando posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className={isDarkMode ? 'text-gray-300 text-lg' : 'text-gray-600 text-lg'}>
                {debouncedSearch
                  ? 'Nenhum post encontrado para sua busca.'
                  : 'Nenhum post ainda. Seja o primeiro a postar!'}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onEdit={setEditingPost}
                  isDarkMode={isDarkMode}
                  isAdminUser={isAdminUser}
                />
              ))}

              {/* Loading indicator for infinite scroll */}
              <div ref={observerTarget} className="py-4 text-center">
                {isFetchingNextPage && (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-pop-in' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-pop-in'}>
            <h2 className={isDarkMode ? 'text-white text-2xl font-bold mb-6' : 'text-slate-900 text-2xl font-bold mb-6'}>Criar novo post</h2>

            <form onSubmit={handleSubmitCreate(onCreatePost)} className="space-y-4">
              {createPostErrorMessage && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-400">{createPostErrorMessage}</p>
                </div>
              )}

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Título</label>
                <input
                  {...registerCreate('title')}
                  type="text"
                  placeholder="Digite o título"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                />
                {errorsCreate.title && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.title.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Conteúdo</label>
                <textarea
                  {...registerCreate('content')}
                  rows={4}
                  placeholder="O que você está pensando?"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition resize-none' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none'}
                />
                {errorsCreate.content && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.content.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>URL da Imagem (opcional)</label>
                <input
                  {...imageUrlField}
                  onChange={handleImageUrlChange}
                  type="url"
                  placeholder="https://exemplo.com/imagem.jpg"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                />
                {errorsCreate.imageUrl && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.imageUrl.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Arquivo de Imagem (opcional, até 5MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]'}
                />
                {uploadedImageName && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={isDarkMode ? 'text-sm text-gray-300 truncate' : 'text-sm text-gray-700 truncate'}>Arquivo selecionado: {uploadedImageName}</p>
                    <button
                      type="button"
                      onClick={clearUploadedImage}
                      className="text-sm text-red-400 hover:text-red-300 transition"
                    >
                      Remover
                    </button>
                  </div>
                )}
                {imageUploadError && <p className="mt-2 text-sm text-red-500">{imageUploadError}</p>}
              </div>

              {createImagePreviewUrl && (
                <div className={isDarkMode ? 'overflow-hidden rounded-xl border border-gray-600 bg-black/20' : 'overflow-hidden rounded-xl border border-gray-200 bg-gray-50'}>
                  <img
                    src={createImagePreviewUrl}
                    alt="Preview da imagem do post"
                    className="block w-full max-h-72 object-contain"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePost(false);
                    resetCreate();
                    clearUploadedImage();
                  }}
                  className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-full transition font-medium' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-3 rounded-full transition font-medium'}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-3 rounded-full transition font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-pop-in' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-pop-in'}>
            <h2 className={isDarkMode ? 'text-white text-2xl font-bold mb-6' : 'text-slate-900 text-2xl font-bold mb-6'}>Editar post</h2>

            <form
              onSubmit={handleSubmitCreate((data) => {
                if (!editingPost) return;
                setEditPostError(null);
                updateMutation.mutate({
                  id: editingPost.id,
                  data: {
                    title: data.title,
                    content: data.content,
                    imageUrl: uploadedImageDataUrl || data.imageUrl || undefined,
                  },
                });
              })}
              className="space-y-4"
            >
              {editPostError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-400">{editPostError}</p>
                </div>
              )}

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Título</label>
                <input
                  {...registerCreate('title')}
                  type="text"
                  defaultValue={editingPost.title}
                  placeholder="Digite o título"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                />
                {errorsCreate.title && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.title.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Conteúdo</label>
                <textarea
                  {...registerCreate('content')}
                  rows={4}
                  defaultValue={editingPost.content}
                  placeholder="O que você está pensando?"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition resize-none' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none'}
                />
                {errorsCreate.content && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.content.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>URL da Imagem (opcional)</label>
                <input
                  {...imageUrlField}
                  onChange={handleImageUrlChange}
                  type="url"
                  defaultValue={editingPost.imageUrl || ''}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
                />
                {errorsCreate.imageUrl && (
                  <p className="mt-2 text-sm text-red-500">{errorsCreate.imageUrl.message}</p>
                )}
              </div>

              <div>
                <label className={isDarkMode ? 'block text-gray-200 text-sm mb-2' : 'block text-slate-800 text-sm mb-2'}>Arquivo de Imagem (opcional, até 5MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0284c7]'}
                />
                {uploadedImageName && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={isDarkMode ? 'text-sm text-gray-300 truncate' : 'text-sm text-gray-700 truncate'}>Arquivo selecionado: {uploadedImageName}</p>
                    <button
                      type="button"
                      onClick={clearUploadedImage}
                      className="text-sm text-red-400 hover:text-red-300 transition"
                    >
                      Remover
                    </button>
                  </div>
                )}
                {imageUploadError && <p className="mt-2 text-sm text-red-500">{imageUploadError}</p>}
              </div>

              {editImagePreviewUrl && (
                <div className={isDarkMode ? 'overflow-hidden rounded-xl border border-gray-600 bg-black/20' : 'overflow-hidden rounded-xl border border-gray-200 bg-gray-50'}>
                  <img
                    src={editImagePreviewUrl}
                    alt="Preview da imagem do post"
                    className="block w-full max-h-72 object-contain"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPost(null);
                    setEditPostError(null);
                    clearUploadedImage();
                  }}
                  className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-full transition font-medium' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-3 rounded-full transition font-medium'}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-3 rounded-full transition font-medium disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full animate-pop-in' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full animate-pop-in'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Sair da conta?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              Você precisará fazer login novamente para continuar usando o sistema.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 px-4 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className={isDarkMode ? 'w-full bg-[#1e293b] border-t border-gray-700' : 'w-full bg-white border-t border-gray-200'}>
        <div className="w-full px-4 py-4">
          <p className={isDarkMode ? 'text-center sm:text-left text-xl sm:text-2xl font-bold text-white whitespace-nowrap' : 'text-center sm:text-left text-xl sm:text-2xl font-bold text-slate-900 whitespace-nowrap'}>Mini Twitter</p>
        </div>
      </footer>
    </div>
  );
}
