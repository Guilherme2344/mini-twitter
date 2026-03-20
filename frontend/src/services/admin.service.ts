import { api } from './api.service';
import type { AdminReport, AdminUserDetails, AdminUserOverview, ReportStatus } from '../types/admin.types';

// Serviço para operações administrativas (usuários, denúncias e banimentos).
export const adminService = {
  async getUsers(): Promise<AdminUserOverview[]> {
    const response = await api.get<AdminUserOverview[]>('/admin/users');
    return response.data;
  },

  async getUserDetailsByUuid(userUuid: string): Promise<AdminUserDetails> {
    const response = await api.get<AdminUserDetails>(`/admin/users/${userUuid}/posts`);
    return response.data;
  },

  async updateUser(userId: number, name: string, email: string): Promise<{ success: boolean; user: AdminUserOverview }> {
    const response = await api.put<{ success: boolean; user: AdminUserOverview }>(`/admin/users/${userId}`, {
      name,
      email,
    });
    return response.data;
  },

  async deleteUser(userId: number): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/admin/users/${userId}`);
    return response.data;
  },

  async banUser(userId: number, durationDays?: number, permanent: boolean = false, reason?: string): Promise<{ success: boolean; bannedUntil: string; permanent?: boolean }> {
    const response = await api.post<{ success: boolean; bannedUntil: string }>(`/admin/users/${userId}/ban`, {
      durationDays,
      permanent,
      reason,
    });
    return response.data;
  },

  async unbanUser(userId: number): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`/admin/users/${userId}/unban`);
    return response.data;
  },

  async getReports(status?: ReportStatus): Promise<AdminReport[]> {
    const params = status ? { status } : undefined;
    const response = await api.get<AdminReport[]>('/admin/reports', { params });
    return response.data;
  },

  async ignoreReport(reportId: number): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`/admin/reports/${reportId}/ignore`);
    return response.data;
  },

  async banFromReport(reportId: number, durationDays?: number, permanent: boolean = false, reason?: string): Promise<{ success: boolean; bannedUntil: string; permanent?: boolean }> {
    const response = await api.post<{ success: boolean; bannedUntil: string }>(`/admin/reports/${reportId}/ban`, {
      durationDays,
      permanent,
      reason,
    });
    return response.data;
  },
};