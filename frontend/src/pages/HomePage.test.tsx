import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

const mockLogout = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'João Silva', email: 'joao@teste.com' },
    logout: mockLogout,
  }),
}));

const mockGetPosts = vi.fn();
const mockCreatePost = vi.fn();
const mockUpdatePost = vi.fn();

vi.mock('../services/post.service', () => ({
  postService: {
    getPosts: (...args: unknown[]) => mockGetPosts(...args),
    createPost: (...args: unknown[]) => mockCreatePost(...args),
    updatePost: (...args: unknown[]) => mockUpdatePost(...args),
  },
}));

describe('HomePage', () => {
  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HomePage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    mockLogout.mockReset();
    mockGetPosts.mockResolvedValue({ posts: [], total: 0, page: 1, limit: 10 });
    mockCreatePost.mockResolvedValue({});
    mockUpdatePost.mockResolvedValue({});
  });

  it('renderiza a saudação com primeiro nome do usuário', async () => {
    renderPage();

    expect(await screen.findByText(/Bom dia, João|Boa tarde, João|Boa noite, João/)).toBeInTheDocument();
  });

  it('abre o modal de criar post ao clicar no card de criação', async () => {
    renderPage();

    const createPostTrigger = await screen.findByText('E aí, o que está rolando? Clique aqui e poste algo!');
    await userEvent.click(createPostTrigger);

    expect(screen.getByText('Criar novo post')).toBeInTheDocument();
  });

  it('abre modal de confirmação de logout', async () => {
    renderPage();

    const logoutButton = await screen.findByRole('button', { name: /sair/i });
    await userEvent.click(logoutButton);

    expect(screen.getByText('Sair da conta?')).toBeInTheDocument();
  });

  it('mostra erro de validação para título curto e não envia criação', async () => {
    renderPage();

    const createPostTrigger = await screen.findByText('E aí, o que está rolando? Clique aqui e poste algo!');
    await userEvent.click(createPostTrigger);

    await userEvent.type(screen.getByPlaceholderText('Digite o título'), 'ab');
    await userEvent.type(screen.getByPlaceholderText('O que você está pensando?'), 'Conteúdo válido');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Título deve ter pelo menos 3 caracteres')).toBeInTheDocument();
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('mostra erro para URL inválida da imagem e não envia criação', async () => {
    renderPage();

    const createPostTrigger = await screen.findByText('E aí, o que está rolando? Clique aqui e poste algo!');
    await userEvent.click(createPostTrigger);

    await userEvent.type(screen.getByPlaceholderText('Digite o título'), 'Título válido');
    await userEvent.type(screen.getByPlaceholderText('O que você está pensando?'), 'Conteúdo válido');
    const imageUrlField = screen.getByPlaceholderText('https://exemplo.com/imagem.jpg');
    await userEvent.type(imageUrlField, 'url-invalida');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(imageUrlField).toBeInvalid();
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('envia criação de post ao submeter formulário válido', async () => {
    renderPage();

    const createPostTrigger = await screen.findByText('E aí, o que está rolando? Clique aqui e poste algo!');
    await userEvent.click(createPostTrigger);

    await userEvent.type(screen.getByPlaceholderText('Digite o título'), 'Título de teste');
    await userEvent.type(screen.getByPlaceholderText('O que você está pensando?'), 'Conteúdo de teste');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledTimes(1);
      expect(mockCreatePost.mock.calls[0][0]).toEqual({
        title: 'Título de teste',
        content: 'Conteúdo de teste',
        imageUrl: undefined,
      });
    });
  });

  it('mostra preview da imagem ao informar URL no modal de criação', async () => {
    renderPage();

    const createPostTrigger = await screen.findByText('E aí, o que está rolando? Clique aqui e poste algo!');
    await userEvent.click(createPostTrigger);

    await userEvent.type(
      screen.getByPlaceholderText('https://exemplo.com/imagem.jpg'),
      'https://img.exemplo.com/foto.jpg'
    );

    expect(screen.getByAltText('Preview da imagem do post')).toBeInTheDocument();
  });

  it('abre modal de edição e envia atualização de post', async () => {
    mockGetPosts.mockResolvedValueOnce({
      posts: [
        {
          id: 99,
          title: 'Post inicial',
          content: 'Conteúdo inicial',
          authorId: 1,
          createdAt: '2026-03-18 18:00:00',
          likes: 0,
          hasLiked: false,
          author: {
            id: 1,
            name: 'João Silva',
            email: 'joao@teste.com',
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });

    renderPage();

    expect(await screen.findByText('Post inicial')).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('Editar'));

    expect(screen.getByText('Editar post')).toBeInTheDocument();
    const contentField = screen.getByDisplayValue('Conteúdo inicial');
    await userEvent.clear(contentField);
    await userEvent.type(contentField, 'Conteúdo atualizado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledTimes(1);
      expect(mockUpdatePost).toHaveBeenCalledWith(99, {
        title: 'Post inicial',
        content: 'Conteúdo atualizado',
        imageUrl: undefined,
      });
    });
  });
});
