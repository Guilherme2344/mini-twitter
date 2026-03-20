import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Post } from '../types/post.types';
import PostCard from './PostCard';

const mockToggleLike = vi.fn();
const mockDeletePost = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'João Teste', email: 'joao@teste.com' },
  }),
}));

vi.mock('../services/post.service', () => ({
  postService: {
    toggleLike: (...args: unknown[]) => mockToggleLike(...args),
    deletePost: (...args: unknown[]) => mockDeletePost(...args),
  },
}));

describe('PostCard', () => {
  const basePost: Post = {
    id: 10,
    title: 'Post de teste',
    content: 'Conteúdo de teste',
    authorId: 1,
    createdAt: '2026-03-18 18:00:00',
    author: {
      id: 1,
      name: 'João Teste',
      email: 'joao@teste.com',
    },
    likes: 3,
    hasLiked: false,
  };

  const renderComponent = (postOverride?: Partial<Post>) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PostCard post={{ ...basePost, ...postOverride }} onEdit={vi.fn()} />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    mockToggleLike.mockReset();
    mockDeletePost.mockReset();
    mockToggleLike.mockResolvedValue({ liked: true });
    mockDeletePost.mockResolvedValue(undefined);
  });

  it('renderiza conteúdo principal do post', () => {
    renderComponent();

    expect(screen.getByText('Post de teste')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo de teste')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('João Teste')).toBeInTheDocument();
  });

  it('chama toggleLike ao clicar no botão de curtir', async () => {
    renderComponent();

    const likeButton = screen.getByRole('button', { name: /3/i });
    await userEvent.click(likeButton);

    expect(mockToggleLike).toHaveBeenCalledTimes(1);
    expect(mockToggleLike).toHaveBeenCalledWith(10);
  });

  it('renderiza coração preenchido quando já curtido', () => {
    renderComponent({ hasLiked: true });

    const likedHeart = document.querySelector('svg[fill="#ef4444"]');
    expect(likedHeart).toBeInTheDocument();
  });
});
