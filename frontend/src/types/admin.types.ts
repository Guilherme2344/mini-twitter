export interface AdminUserOverview {
  id: number;
  uuid: string;
  name: string;
  email: string;
  bannedUntil?: string | null;
  bannedReason?: string | null;
  postsCount: number;
}

export interface AdminUserPost {
  id: number;
  title: string;
  content: string;
  image?: string | null;
  createdAt: string;
  likesCount: number;
}

export interface AdminPostReportDetail {
  id: number;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporterName: string;
  reporterEmail: string;
}

export interface AdminReportedUserPost extends AdminUserPost {
  reportsCount: number;
  reports: AdminPostReportDetail[];
}

export interface AdminUserReportedPostsDetails {
  user: AdminUserOverview;
  posts: AdminReportedUserPost[];
}

export interface AdminUserDetails {
  user: AdminUserOverview;
  posts: AdminUserPost[];
}

export type ReportStatus = 'pending' | 'ignored' | 'actioned';

export interface AdminReport {
  id: number;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string | null;
  action?: string | null;
  postId: number;
  postTitle: string;
  postContent: string;
  reporterId: number;
  reporterName: string;
  reporterEmail: string;
  authorId: number;
  authorName: string;
  authorEmail: string;
  reviewerId?: number | null;
  reviewerName?: string | null;
}