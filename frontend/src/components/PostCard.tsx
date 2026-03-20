import { useMemo, useState } from 'react';
import type { Post } from '../types/post.types';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postService } from '../services/post.service';
import { profilePreferencesService } from '../services/profile-preferences.service';
import type { AxiosError } from 'axios';

interface PostCardProps {
  post: Post;
  onEdit: (post: Post) => void;
  isDarkMode?: boolean;
  isAdminUser?: boolean;
}

type InfinitePostsCache = {
// Avatar padrão para autores sem imagem definida.
  pages: Array<{
    posts: Post[];
  }>;
  pageParams: unknown[];
};

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

// Card de post com ações de like, edição, exclusão e denúncia.
export default function PostCard({ post, onEdit, isDarkMode = false, isAdminUser = false }: PostCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportSuccessModal, setShowReportSuccessModal] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const authorName = post.author?.name || 'Usuário';

  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdminUser;

  const authorStoredAvatarUrl = useMemo(() => {
    return profilePreferencesService.get(post.authorId).avatarUrl;
  }, [post.authorId]);

  const authorAvatarUrl = authorStoredAvatarUrl || post.author?.avatarUrl;
  const defaultAvatarUrl = useMemo(() => getDefaultAvatarDataUrl(authorName), [authorName]);
  const resolvedAuthorAvatarUrl = authorAvatarUrl || defaultAvatarUrl;

  const deleteMutation = useMutation({
    mutationFn: () => postService.deletePost(post.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      const status = error.response?.status;
      if (status === 403) {
        setActionError('Você não tem permissão para excluir este post.');
        return;
      }

      setActionError(error.response?.data?.error || 'Não foi possível excluir o post.');
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => postService.toggleLike(post.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      const previousCaches = queryClient.getQueriesData<InfinitePostsCache>({
        queryKey: ['posts'],
      });

      queryClient.setQueriesData<InfinitePostsCache>(
        { queryKey: ['posts'] },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              posts: page.posts.map((currentPost) => {
                if (currentPost.id !== post.id) {
                  return currentPost;
                }

                const hasLiked = !currentPost.hasLiked;
                const likes = currentPost.likes + (hasLiked ? 1 : -1);

                return {
                  ...currentPost,
                  hasLiked,
                  likes: Math.max(0, likes),
                };
              }),
            })),
          };
        }
      );

      return { previousCaches };
    },
    onError: (_error, _variables, context) => {
      context?.previousCaches?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (response) => {
      queryClient.setQueriesData<InfinitePostsCache>(
        { queryKey: ['posts'] },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              posts: page.posts.map((currentPost) => {
                if (currentPost.id !== post.id) {
                  return currentPost;
                }

                return {
                  ...currentPost,
                  hasLiked: response.liked,
                };
              }),
            })),
          };
        }
      );
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => postService.reportPost(post.id, { reason: reportReason.trim() }),
    onSuccess: (response) => {
      setActionError(null);
      setReportSuccessMessage(response.message || 'Denúncia enviada com sucesso.');
      setShowReportSuccessModal(true);
      setReportError(null);
      setShowReportModal(false);
      setReportReason('');
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      const backendError = error.response?.data?.error;

      if (error.response?.status === 404) {
        if (backendError?.toLowerCase().includes('post não encontrado')) {
          setReportError('Este post não está mais disponível para denúncia. Atualize a timeline.');
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        } else {
          setReportError('Não foi possível encontrar o recurso de denúncia no servidor.');
        }
      } else {
        setReportError(backendError || 'Não foi possível enviar a denúncia.');
      }
    },
  });

  const formatDate = (dateString: string) => {
    const normalizedDateString = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)
      ? `${dateString.replace(' ', 'T')}Z`
      : dateString;

    const date = new Date(normalizedDateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
      hour12: false,
      timeZoneName: 'short',
    });
  };

  const handleDelete = () => {
    setActionError(null);
    deleteMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const handleOpenReport = () => {
    setActionError(null);
    setReportError(null);
    setReportReason('');
    setShowDeleteConfirm(false);
    setShowReportModal(true);
  };

  const handleSubmitReport = () => {
    if (reportReason.trim().length < 5) {
      setReportError('Informe um motivo com pelo menos 5 caracteres.');
      return;
    }

    setReportError(null);
    reportMutation.mutate();
  };

  return (
    <div className={isDarkMode ? 'relative bg-[#1e293b] border border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-gray-600 transition animate-fade-in' : 'relative bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 hover:border-gray-300 transition animate-fade-in'}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
            <img
              src={resolvedAuthorAvatarUrl}
              alt={`Foto de perfil de ${authorName}`}
              onError={(event) => {
                if (event.currentTarget.src !== defaultAvatarUrl) {
                  event.currentTarget.src = defaultAvatarUrl;
                }
              }}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div>
            <h3 className={isDarkMode ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>{authorName}</h3>
            <p className={isDarkMode ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{formatDate(post.createdAt)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isAuthor && user && (
            <button
              onClick={handleOpenReport}
              className={isDarkMode ? 'text-gray-400 hover:text-amber-400 transition p-2' : 'text-gray-500 hover:text-amber-500 transition p-2'}
              title="Denunciar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.29 3.86L1.82 18a2 2 0 001.72 3h16.92a2 2 0 001.72-3l-8.47-14.14a2 2 0 00-3.44 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17h.01" />
              </svg>
            </button>
          )}

          {isAuthor && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(post)}
              className={isDarkMode ? 'text-gray-400 hover:text-blue-500 transition p-2' : 'text-gray-500 hover:text-blue-500 transition p-2'}
              title="Editar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
          )}

          {canDelete && (
            <button
              onClick={() => {
                setShowReportModal(false);
                setShowDeleteConfirm(true);
              }}
              className={isDarkMode ? 'text-gray-400 hover:text-red-500 transition p-2' : 'text-gray-500 hover:text-red-500 transition p-2'}
              title="Excluir"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <h2 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>{post.title}</h2>
        <p className={isDarkMode ? 'text-gray-300 whitespace-pre-wrap' : 'text-gray-700 whitespace-pre-wrap'}>{post.content}</p>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className={isDarkMode ? 'mb-4 overflow-hidden rounded-xl bg-black/20 border border-gray-700' : 'mb-4 overflow-hidden rounded-xl bg-gray-50 border border-gray-200'}>
          <img
            src={post.imageUrl}
            alt={post.title}
            className="block w-full max-h-[70vh] object-contain"
          />
        </div>
      )}

      {/* Actions */}
      <div className={isDarkMode ? 'flex items-center gap-6 pt-4 border-t border-gray-700' : 'flex items-center gap-6 pt-4 border-t border-gray-200'}>
        <button
          onClick={() => likeMutation.mutate()}
          disabled={!user || likeMutation.isPending}
          className="flex items-center gap-2 transition text-red-500 disabled:opacity-50 active:scale-95"
        >
          {post.hasLiked ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444">
              <path d="M12 20.364l-7.682-7.682a4.5 4.5 0 116.364-6.364L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#ef4444">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          )}
          <span className="font-medium">{post.likes}</span>
        </button>
      </div>

      {actionError && (
        <p className="mt-3 text-sm text-red-500">{actionError}</p>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-black/55 backdrop-blur-[1px] p-4 sm:p-6 flex items-center justify-center animate-fade-in">
          <div className={isDarkMode ? 'w-full max-w-sm bg-[#1e293b] border border-gray-700 rounded-2xl p-6 animate-pop-in' : 'w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6 animate-pop-in'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Excluir post?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              Esta ação não pode ser desfeita. O post será excluído permanentemente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 px-4 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-black/55 backdrop-blur-[1px] p-4 sm:p-6 flex items-center justify-center animate-fade-in">
          <div className={isDarkMode ? 'w-full max-w-md bg-[#1e293b] border border-gray-700 rounded-2xl p-6 animate-pop-in' : 'w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 animate-pop-in'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Denunciar post</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-4 text-sm' : 'text-gray-600 mb-4 text-sm'}>
              Explique o motivo da denúncia para revisão do administrador.
            </p>

            <textarea
              value={reportReason}
              onChange={(event) => {
                setReportReason(event.target.value);
                if (reportError) {
                  setReportError(null);
                }
              }}
              rows={4}
              maxLength={500}
              placeholder="Descreva o problema..."
              className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition resize-none' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none'}
            />

            {reportError && <p className="mt-2 text-sm text-red-500">{reportError}</p>}

            <p className={isDarkMode ? 'mt-2 text-xs text-gray-400' : 'mt-2 text-xs text-gray-500'}>
              {reportReason.length}/500 caracteres
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false);
                  setReportError(null);
                  setReportReason('');
                }}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 px-4 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={reportMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 px-4 rounded-full transition disabled:opacity-50"
              >
                {reportMutation.isPending ? 'Enviando...' : 'Enviar denúncia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Denúncia enviada</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              {reportSuccessMessage}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReportSuccessModal(false)}
                className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-2 px-4 rounded-full transition font-medium"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
