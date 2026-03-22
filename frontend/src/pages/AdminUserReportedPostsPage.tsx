import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { adminService } from '../services/admin.service';
import { postService } from '../services/post.service';
import type { AdminReportedUserPost } from '../types/admin.types';

const ADMIN_EMAIL = 'minitwitteradmin@access.total.ok';

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

export default function AdminUserReportedPostsPage() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { userUuid } = useParams<{ userUuid: string }>();
  const queryClient = useQueryClient();
  const [activeInfoPostId, setActiveInfoPostId] = useState<number | null>(null);
  const [postToDelete, setPostToDelete] = useState<{ id: number; title: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const detailsQuery = useQuery({
    queryKey: ['admin-user-reported-posts', userUuid],
    queryFn: () => adminService.getUserReportedPostsByUuid(userUuid as string),
    enabled: isAdmin && !!userUuid,
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: number) => postService.deletePost(postId),
    onSuccess: () => {
      setActionError(null);
      setPostToDelete(null);
      setActiveInfoPostId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-user-reported-posts', userUuid] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-posts', userUuid] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setActionError(error.response?.data?.error || 'Não foi possível excluir o post.');
    },
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!userUuid) {
    return <Navigate to="/admin" replace />;
  }

  const userName = detailsQuery.data?.user.name || 'Usuário';

  return (
    <div className={isDarkMode ? 'min-h-screen bg-[#0f172a] flex flex-col' : 'min-h-screen bg-slate-100 flex flex-col'}>
      <header className={isDarkMode ? 'bg-[#1e293b] border-b border-gray-700 sticky top-0 z-40' : 'bg-white border-b border-gray-200 sticky top-0 z-40'}>
        <div className="w-full px-4 py-4 max-w-3xl mx-auto flex items-center justify-between gap-4">
          <h1 className={isDarkMode ? 'text-xl sm:text-2xl font-bold text-white' : 'text-xl sm:text-2xl font-bold text-slate-900'}>
            Posts denunciados de {userName}
          </h1>
          <Link
            to="/admin"
            className={isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full transition' : 'bg-gray-200 hover:bg-gray-300 text-slate-800 px-4 py-2 rounded-full transition'}
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {actionError && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-500">{actionError}</p>
          </div>
        )}

        <div className="space-y-4">
          {detailsQuery.isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className={isDarkMode ? 'text-gray-300 mt-4' : 'text-gray-600 mt-4'}>Carregando posts denunciados...</p>
            </div>
          ) : !detailsQuery.data?.posts.length ? (
            <div className="text-center py-12">
              <p className={isDarkMode ? 'text-gray-300 text-lg' : 'text-gray-600 text-lg'}>Nenhum post denunciado para este usuário.</p>
            </div>
          ) : (
            detailsQuery.data.posts.map((post: AdminReportedUserPost) => {
              const isInfoOpen = activeInfoPostId === post.id;

              return (
                <div
                  key={post.id}
                  className={isDarkMode ? 'relative bg-[#1e293b] border border-gray-700 rounded-2xl p-4 sm:p-6 hover:border-gray-600 transition animate-fade-in' : 'relative bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 hover:border-gray-300 transition animate-fade-in'}
                >
                  <div className="flex items-start justify-end gap-1 mb-2">
                    <button
                      type="button"
                      title="Ver motivo da denúncia"
                      onClick={() => setActiveInfoPostId(isInfoOpen ? null : post.id)}
                      className={isDarkMode ? 'text-gray-300 hover:text-blue-400 transition p-2' : 'text-gray-600 hover:text-blue-500 transition p-2'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6" />
                        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      title="Excluir post"
                      onClick={() => {
                        setActiveInfoPostId(null);
                        setPostToDelete({ id: post.id, title: post.title });
                      }}
                      className={isDarkMode ? 'text-gray-400 hover:text-red-500 transition p-2' : 'text-gray-500 hover:text-red-500 transition p-2'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <h2 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>{post.title}</h2>
                    <p className={isDarkMode ? 'text-gray-300 whitespace-pre-wrap' : 'text-gray-700 whitespace-pre-wrap'}>{post.content}</p>
                  </div>

                  {post.image && (
                    <div className={isDarkMode ? 'mb-4 overflow-hidden rounded-xl bg-black/20 border border-gray-700' : 'mb-4 overflow-hidden rounded-xl bg-gray-50 border border-gray-200'}>
                      <img src={post.image} alt={post.title} className="block w-full max-h-[70vh] object-contain" />
                    </div>
                  )}

                  <div className={isDarkMode ? 'flex items-center justify-between text-sm pt-4 border-t border-gray-700 text-gray-300' : 'flex items-center justify-between text-sm pt-4 border-t border-gray-200 text-gray-600'}>
                    <span>{formatDate(post.createdAt)}</span>
                    <span>Denúncias: {post.reportsCount}</span>
                  </div>

                  {isInfoOpen && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
                      <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-xl w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-xl w-full'}>
                        <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Motivos da denúncia</h3>
                        <p className={isDarkMode ? 'text-gray-300 mb-4 text-sm' : 'text-gray-600 mb-4 text-sm'}>
                          Post: {post.title}
                        </p>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-5">
                          {post.reports.map((report) => (
                            <div key={report.id} className={isDarkMode ? 'rounded-lg border border-gray-700 bg-[#0f172a] p-3' : 'rounded-lg border border-gray-200 bg-white p-3'}>
                              <p className={isDarkMode ? 'text-gray-200 text-sm' : 'text-slate-700 text-sm'}>{report.reason}</p>
                              <p className={isDarkMode ? 'text-gray-400 text-xs mt-2' : 'text-gray-500 text-xs mt-2'}>
                                {report.reporterName} ({report.reporterEmail}) • {formatDate(report.createdAt)} • status: {report.status}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveInfoPostId(null)}
                            className={isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-full transition' : 'bg-gray-200 hover:bg-gray-300 text-slate-800 px-5 py-2 rounded-full transition'}
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {postToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Excluir post?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-6' : 'text-gray-600 mb-6'}>
              Tem certeza que deseja excluir “{postToDelete.title}”? Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 px-4 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(postToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
