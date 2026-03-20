export interface Post {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: number;
  createdAt: string;
  author: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  likes: number;
  hasLiked: boolean;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  imageUrl?: string;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  imageUrl?: string;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}

export type PostSortOption = 'none' | 'oldest' | 'newest';

export interface ReportPostRequest {
  reason: string;
}
