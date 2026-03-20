import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';

const mockSetUser = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Maria Souza', email: 'maria@teste.com' },
    setUser: mockSetUser,
  }),
}));

describe('ProfilePage', () => {
  const renderPage = () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    mockSetUser.mockReset();
  });

  it('abre o modal de personalização de imagem ao clicar na foto', async () => {
    renderPage();

    const avatarButton = screen.getByTitle('Personalizar foto de perfil');
    await userEvent.click(avatarButton);

    expect(screen.getByText('Personalizar foto de perfil')).toBeInTheDocument();
  });

  it('mostra modal de sucesso após salvar perfil', async () => {
    renderPage();

    const submitButton = screen.getByRole('button', { name: 'Salvar perfil' });
    await userEvent.click(submitButton);

    expect(await screen.findByText('Perfil atualizado')).toBeInTheDocument();
  });

  it('salva personalização por usuário no localStorage', async () => {
    renderPage();

    const bioField = screen.getByPlaceholderText('Escreva uma breve descrição sobre você');
    await userEvent.clear(bioField);
    await userEvent.type(bioField, 'Bio de teste');

    const submitButton = screen.getByRole('button', { name: 'Salvar perfil' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      const raw = localStorage.getItem('profilePreferences:1');
      expect(raw).not.toBeNull();
      expect(raw).toContain('Bio de teste');
    });
  });
});
