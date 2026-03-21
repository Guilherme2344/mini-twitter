import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { adminService } from '../services/admin.service';
import type { AdminUserOverview } from '../types/admin.types';

const ADMIN_EMAIL = 'minitwitteradmin@access.total.ok';

// Formata informação textual de banimento para listagem de usuários.
const formatBanStatus = (bannedUntil?: string | null) => {
  if (!bannedUntil) return 'Sem banimento';
  if (bannedUntil === 'PERMANENT') return 'Banimento permanente';

  const date = new Date(bannedUntil);
  if (Number.isNaN(date.getTime())) return 'Banimento ativo';

  return `Banido até ${date.toLocaleString('pt-BR')}`;
};

// Verifica se banimento ainda está ativo.
const isBanActive = (bannedUntil?: string | null) => {
  if (!bannedUntil) return false;
  if (bannedUntil === 'PERMANENT') return true;

  const banDate = new Date(bannedUntil);
  if (Number.isNaN(banDate.getTime())) return false;
  return banDate.getTime() > Date.now();
};

// Página principal de gestão administrativa de usuários.
export default function AdminPage() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserOverview | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState(1);
  const [banPermanent, setBanPermanent] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useBodyScrollLock(showEditModal || showDeleteModal || showBanModal || showRevokeModal);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminService.getUsers,
    enabled: isAdmin,
  });

  const filteredUsers = useMemo(() => {
    const users = usersQuery.data || [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((currentUser) => currentUser.name.toLowerCase().includes(normalizedSearch));
  }, [searchTerm, usersQuery.data]);

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, name, email }: { userId: number; name: string; email: string }) =>
      adminService.updateUser(userId, name, email),
    onSuccess: () => {
      setShowEditModal(false);
      setActionError(null);
      setActionMessage('Usuário atualizado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setActionMessage(null);
      setActionError(error.response?.data?.error || 'Não foi possível atualizar o usuário.');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => adminService.deleteUser(userId),
    onSuccess: () => {
      setShowDeleteModal(false);
      setSelectedUser(null);
      setActionError(null);
      setActionMessage('Usuário excluído com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setActionMessage(null);
      setActionError(error.response?.data?.error || 'Não foi possível excluir o usuário.');
    },
  });

  const banUserMutation = useMutation({
    mutationFn: ({ userId, reason, durationDays, permanent }: { userId: number; reason: string; durationDays?: number; permanent: boolean }) =>
      adminService.banUser(userId, durationDays, permanent, reason),
    onSuccess: (response) => {
      setShowBanModal(false);
      setSelectedUser(null);
      setActionError(null);
      setActionMessage(
        response.bannedUntil === 'PERMANENT'
          ? 'Usuário banido para sempre.'
          : `Usuário banido por dias até ${new Date(response.bannedUntil).toLocaleString('pt-BR')}.`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setActionMessage(null);
      setActionError(error.response?.data?.error || 'Não foi possível banir o usuário.');
    },
  });

  const revokeBanMutation = useMutation({
    mutationFn: (userId: number) => adminService.unbanUser(userId),
    onSuccess: () => {
      setActionError(null);
      setActionMessage('Banimento revogado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setActionMessage(null);
      setActionError(error.response?.data?.error || 'Não foi possível revogar o banimento.');
    },
  });

  // Fecha todos os modais de ação do painel.
  const closeAllModals = () => {
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowBanModal(false);
    setShowRevokeModal(false);
  };

  const openEditModal = (targetUser: AdminUserOverview) => {
    setActionError(null);
    setActionMessage(null);
    setSelectedUser(targetUser);
    setEditName(targetUser.name);
    setEditEmail(targetUser.email);
    setShowDeleteModal(false);
    setShowBanModal(false);
    setShowEditModal(true);
  };

  const openDeleteModal = (targetUser: AdminUserOverview) => {
    setActionError(null);
    setActionMessage(null);
    setSelectedUser(targetUser);
    setShowEditModal(false);
    setShowBanModal(false);
    setShowDeleteModal(true);
  };

  const openBanModal = (targetUser: AdminUserOverview) => {
    setActionError(null);
    setActionMessage(null);
    setSelectedUser(targetUser);
    setBanReason('');
    setBanDays(1);
    setBanPermanent(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowBanModal(true);
  };

  const openRevokeModal = (targetUser: AdminUserOverview) => {
    setActionError(null);
    setActionMessage(null);
    setSelectedUser(targetUser);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowBanModal(false);
    setShowRevokeModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;

    if (editName.trim().length < 2) {
      setActionMessage(null);
      setActionError('Nome deve ter ao menos 2 caracteres.');
      return;
    }

    updateUserMutation.mutate({
      userId: selectedUser.id,
      name: editName.trim(),
      email: editEmail.trim(),
    });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  const handleBan = () => {
    if (!selectedUser) return;

    if (banReason.trim().length < 3) {
      setActionMessage(null);
      setActionError('Informe um motivo de banimento com ao menos 3 caracteres.');
      return;
    }

    if (!banPermanent && banDays < 1) {
      setActionMessage(null);
      setActionError('Informe a duração em dias para banimento temporário.');
      return;
    }

    banUserMutation.mutate({
      userId: selectedUser.id,
      reason: banReason.trim(),
      durationDays: banPermanent ? undefined : banDays,
      permanent: banPermanent,
    });
  };

  // Navega para a página de posts de um usuário específico (UUID).
  const handleViewPosts = (targetUser: AdminUserOverview) => {
    navigate(`/admin/users/${targetUser.uuid}/posts`);
  };

  const handleViewReportedPosts = (targetUser: AdminUserOverview) => {
    navigate(`/admin/users/${targetUser.uuid}/reported-posts`);
  };

  // Confirma e revoga banimento do usuário selecionado.
  const handleRevokeBan = () => {
    if (!selectedUser) return;

    revokeBanMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        setShowRevokeModal(false);
        setSelectedUser(null);
      },
    });
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={isDarkMode ? 'min-h-screen bg-[#0f172a]' : 'min-h-screen bg-slate-100'}>
      <header className={isDarkMode ? 'bg-[#1e293b] border-b border-gray-700' : 'bg-white border-b border-gray-200'}>
        <div className="w-full max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className={isDarkMode ? 'text-white text-2xl font-bold' : 'text-slate-900 text-2xl font-bold'}>Painel Admin</h1>
          <Link
            to="/"
            className={isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full transition' : 'bg-gray-200 hover:bg-gray-300 text-slate-800 px-4 py-2 rounded-full transition'}
          >
            Voltar ao feed
          </Link>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
        {actionMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-500">{actionMessage}</p>
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-500">{actionError}</p>
          </div>
        )}

        <section className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-4 sm:p-6' : 'bg-white border border-gray-200 rounded-2xl p-4 sm:p-6'}>
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Pesquisar usuário por nome..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 pr-11 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 pr-11 text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition'}
              />
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
          </div>

          {usersQuery.isLoading ? (
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Carregando usuários...</p>
          ) : filteredUsers.length === 0 ? (
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((listUser) => {
                const isSelf = listUser.id === user.id;
                const userHasActiveBan = isBanActive(listUser.bannedUntil);
                const isAdminRow = listUser.email.toLowerCase() === ADMIN_EMAIL;

                return (
                  <div
                    key={listUser.id}
                    className={isDarkMode ? 'w-full rounded-xl border border-gray-700 px-4 py-3 flex items-center justify-between gap-3' : 'w-full rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3'}
                  >
                    <div>
                      <p className={isDarkMode ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>{listUser.name}</p>
                      <p className={isDarkMode ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs'}>{listUser.email}</p>
                      <p className={isDarkMode ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs'}>{formatBanStatus(listUser.bannedUntil)}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => openEditModal(listUser)}
                        disabled={isSelf}
                        className={isDarkMode ? 'text-gray-300 hover:text-blue-400 transition p-2 disabled:opacity-40' : 'text-gray-600 hover:text-blue-500 transition p-2 disabled:opacity-40'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => openDeleteModal(listUser)}
                        disabled={isSelf}
                        className={isDarkMode ? 'text-gray-300 hover:text-red-500 transition p-2 disabled:opacity-40' : 'text-gray-600 hover:text-red-500 transition p-2 disabled:opacity-40'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        title="Ver posts"
                        onClick={() => handleViewPosts(listUser)}
                        className={isDarkMode ? 'text-gray-300 hover:text-emerald-400 transition p-2' : 'text-gray-600 hover:text-emerald-500 transition p-2'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={2} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6" />
                          <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        title={userHasActiveBan ? 'Revogar banimento' : 'Banir'}
                        onClick={() => {
                          if (userHasActiveBan) {
                            openRevokeModal(listUser);
                            return;
                          }

                          openBanModal(listUser);
                        }}
                        disabled={isSelf}
                        className={
                          userHasActiveBan
                            ? isDarkMode
                              ? 'text-gray-300 hover:text-emerald-400 transition p-2 disabled:opacity-40'
                              : 'text-gray-600 hover:text-emerald-500 transition p-2 disabled:opacity-40'
                            : isDarkMode
                              ? 'text-gray-300 hover:text-amber-400 transition p-2 disabled:opacity-40'
                              : 'text-gray-600 hover:text-amber-500 transition p-2 disabled:opacity-40'
                        }
                      >
                        {userHasActiveBan ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                          </svg>
                        )}
                      </button>

                      {!isAdminRow && (
                        <button
                          type="button"
                          title="Ver posts denunciados"
                          onClick={() => handleViewReportedPosts(listUser)}
                          className={isDarkMode ? 'text-xs font-semibold text-blue-300 hover:text-blue-200 transition px-3 py-2 rounded-full border border-blue-500/40 hover:border-blue-400/70' : 'text-xs font-semibold text-blue-600 hover:text-blue-700 transition px-3 py-2 rounded-full border border-blue-300 hover:border-blue-400'}
                        >
                          Denúncias
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-md w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-4' : 'text-slate-900 text-xl font-bold mb-4'}>Editar usuário</h3>

            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Nome"
                className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900'}
              />
              <input
                type="email"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
                placeholder="E-mail"
                className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900'}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                type="button"
                onClick={closeAllModals}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateUserMutation.isPending}
                className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white py-2 rounded-full transition disabled:opacity-50"
              >
                {updateUserMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Excluir usuário?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-5' : 'text-gray-600 mb-5'}>
              Tem certeza que deseja excluir {selectedUser.name}? Esta ação não pode ser desfeita.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={closeAllModals}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-full transition disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBanModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-md w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Banir usuário</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-4 text-sm' : 'text-gray-600 mb-4 text-sm'}>
              Defina o motivo e duração do banimento para {selectedUser.name}.
            </p>

            <div className="space-y-3">
              <textarea
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                rows={3}
                placeholder="Motivo do banimento"
                className={isDarkMode ? 'w-full bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-white resize-none' : 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-slate-900 resize-none'}
              />

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={banDays}
                  onChange={(event) => setBanDays(Number(event.target.value) || 1)}
                  disabled={banPermanent}
                  className={isDarkMode ? 'w-28 bg-[#0f172a] border border-gray-600 rounded-xl px-3 py-2 text-white disabled:opacity-60' : 'w-28 bg-white border border-gray-300 rounded-xl px-3 py-2 text-slate-900 disabled:opacity-60'}
                />
                <span className={isDarkMode ? 'text-gray-300 text-sm' : 'text-gray-600 text-sm'}>dias</span>
                <label className={isDarkMode ? 'inline-flex items-center gap-2 text-gray-200 text-sm' : 'inline-flex items-center gap-2 text-slate-800 text-sm'}>
                  <input
                    type="checkbox"
                    checked={banPermanent}
                    onChange={(event) => setBanPermanent(event.target.checked)}
                  />
                  Banir para sempre
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                type="button"
                onClick={closeAllModals}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBan}
                disabled={banUserMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-full transition disabled:opacity-50"
              >
                {banUserMutation.isPending ? 'Aplicando...' : 'Confirmar banimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevokeModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={isDarkMode ? 'bg-[#1e293b] border border-gray-700 rounded-2xl p-6 max-w-sm w-full' : 'bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full'}>
            <h3 className={isDarkMode ? 'text-white text-xl font-bold mb-2' : 'text-slate-900 text-xl font-bold mb-2'}>Revogar banimento?</h3>
            <p className={isDarkMode ? 'text-gray-300 mb-5' : 'text-gray-600 mb-5'}>
              Tem certeza que deseja revogar o banimento de {selectedUser.name}?
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={closeAllModals}
                className={isDarkMode ? 'flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-full transition' : 'flex-1 bg-gray-200 hover:bg-gray-300 text-slate-800 py-2 rounded-full transition'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRevokeBan}
                disabled={revokeBanMutation.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-full transition disabled:opacity-50"
              >
                {revokeBanMutation.isPending ? 'Revogando...' : 'Confirmar revogação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
