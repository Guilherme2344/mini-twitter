import { api } from './api.service';
import type { Post, CreatePostRequest, UpdatePostRequest, PostsResponse, ReportPostRequest, PostSortOption } from '../types/post.types';

interface RawPost {
  id: number;
  title: string;
  content: string;
  image?: string | null;
  imageUrl?: string | null;
  authorId: number;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email: string;
  };
  authorName?: string;
  likes?: number;
  likesCount?: number;
  hasLiked?: boolean;
}

interface RawPostsResponse {
  posts: RawPost[];
  total: number;
  page: number;
  limit: number;
}

const LIKED_POSTS_STORAGE_KEY_PREFIX = 'likedPosts:';

// Recupera id do usuário logado para separar likes por usuário.
const getCurrentUserId = (): number | null => {
  const userRaw = localStorage.getItem('user');
  if (!userRaw) return null;

  try {
    const parsed = JSON.parse(userRaw) as { id?: number };
    return typeof parsed.id === 'number' ? parsed.id : null;
  } catch {
    return null;
  }
};

// Monta chave de storage de likes por usuário.
const getLikedPostsStorageKey = () => {
  const userId = getCurrentUserId();
  return userId ? `${LIKED_POSTS_STORAGE_KEY_PREFIX}${userId}` : null;
};

// Lê mapa local de posts curtidos.
const getLikedPostsMap = (): Record<string, boolean> => {
  const storageKey = getLikedPostsStorageKey();
  if (!storageKey) return {};

  const raw = localStorage.getItem(storageKey);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
};

// Persiste estado de like local para resposta imediata na UI.
const setLikedPostState = (postId: number, liked: boolean) => {
  const storageKey = getLikedPostsStorageKey();
  if (!storageKey) return;

  const likedMap = getLikedPostsMap();
  likedMap[String(postId)] = liked;
  localStorage.setItem(storageKey, JSON.stringify(likedMap));
};

// Obtém estado local de like para um post específico.
const getLikedPostState = (postId: number): boolean => {
  const likedMap = getLikedPostsMap();
  return likedMap[String(postId)] ?? false;
};

// Normaliza payload da API para o modelo único usado no frontend.
const normalizePost = (post: RawPost): Post => ({
  id: post.id,
  title: post.title,
  content: post.content,
  imageUrl: post.imageUrl ?? post.image ?? undefined,
  authorId: post.authorId,
  createdAt: post.createdAt,
  author: post.author ?? {
    id: post.authorId,
    name: post.authorName ?? 'Usuário',
    email: '',
  },
  likes: post.likes ?? post.likesCount ?? 0,
  hasLiked: typeof post.hasLiked === 'boolean' ? post.hasLiked : getLikedPostState(post.id),
});

export const postService = {
  // Lista posts com paginação e filtros do feed.
  async getPosts(page = 1, limit = 10, search?: string, sort: PostSortOption = 'none', authorId?: number): Promise<PostsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    if (sort !== 'none') {
      params.append('sort', sort);
    }

    if (authorId) {
      params.append('authorId', String(authorId));
    }

    const response = await api.get<RawPostsResponse>(`/posts?${params.toString()}`);

    return {
      ...response.data,
      posts: response.data.posts.map(normalizePost),
    };
  },

  async createPost(data: CreatePostRequest): Promise<Post> {
    const response = await api.post<RawPost>('/posts', {
      title: data.title,
      content: data.content,
      image: data.imageUrl,
    });

    return normalizePost(response.data);
  },

  async updatePost(id: number, data: UpdatePostRequest): Promise<Post> {
    const response = await api.put<RawPost>(`/posts/${id}`, {
      title: data.title,
      content: data.content,
      image: data.imageUrl,
    });

    return normalizePost(response.data);
  },

  async deletePost(id: number): Promise<void> {
    await api.delete(`/posts/${id}`);
  },

  async toggleLike(id: number): Promise<{ liked: boolean }> {
    const response = await api.post<{ liked: boolean }>(`/posts/${id}/like`);
    setLikedPostState(id, response.data.liked);
    return response.data;
  },

  async reportPost(id: number, data: ReportPostRequest): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/posts/${id}/report`, data);
    return response.data;
  },
};
