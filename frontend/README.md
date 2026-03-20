# Mini Twitter - Frontend

Frontend do Mini Twitter desenvolvido com React, TypeScript e Tailwind CSS para o processo seletivo.

## ⚠️ Aviso Importante (Leia)

Houve mudanças relevantes no backend durante a evolução do projeto. Sendo totalmente sincero: o sistema original não estava muito coerente com minhas vontades e com a direção que eu queria para o produto, então ele precisou de um **upgrade** para ficar mais consistente.

- Resumo das mudanças no backend: [BACKEND_CHANGES.md](../BACKEND_CHANGES.md)
- Casos de uso implementados no sistema: [CASOS_DE_USO_IMPLEMENTADOS.md](CASOS_DE_USO_IMPLEMENTADOS.md)

## 🚀 Tecnologias Utilizadas

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **React** | ^18.3.1 | Biblioteca principal para construir a interface e os componentes |
| **TypeScript** | ^5.6.2 | Tipagem estática para evitar erros e melhorar a qualidade do código |
| **Vite** | ^6.0.5 | Build tool rápida para desenvolvimento |
| **Axios** | ^1.7.9 | Cliente HTTP para comunicação com o backend |
| **TanStack Query** | ^5.66.1 | Gerenciamento de estado assíncrono e cache |
| **React Hook Form** | ^7.54.2 | Gerenciamento de formulários com performance otimizada |
| **Zod** | ^3.24.1 | Validação de esquemas e dados |
| **Tailwind CSS** | ^4.2.1 | Framework CSS utility-first para estilização |
| **React Router** | ^7.5.1 | Roteamento e navegação entre páginas |

## 📋 Funcionalidades Implementadas

### Épico: Autenticação e Gestão de Acesso

#### ✅ Registro de Novo Usuário
- Formulário com validação de campos (nome, e-mail, senha)
- Validação de formato de e-mail no frontend
- Confirmação de senha
- Mensagens de erro amigáveis
- Integração com `POST /auth/register`

#### ✅ Login de Usuário
- Formulário com validação de e-mail e senha
- Armazenamento seguro do token JWT no localStorage
- Redirecionamento automático para a timeline após login
- Tratamento de erros de credenciais inválidas
- Integração com `POST /auth/login`

#### ✅ Logout (Sair do Sistema)
- Botão de logout na página inicial
- Confirmação antes de sair
- Chamada ao endpoint `POST /auth/logout`
- Remoção do token do localStorage
- Redirecionamento para a página de login

#### ✅ Proteção de Rotas
- Rotas privadas que requerem autenticação
- Redirecionamento automático para login se não autenticado
- Persistência de sessão com localStorage

## 🛠️ Como Rodar o Projeto

### Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Backend rodando em `http://localhost:3000`

### Instalação

1. **Navegue até a pasta do frontend:**
   ```bash
   cd frontend
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador:**
   ```
   http://localhost:5173
   ```

## 📁 Estrutura do Projeto

```
frontend/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   └── PrivateRoute.tsx
│   ├── contexts/         # Contextos React
│   │   └── AuthContext.tsx
│   ├── pages/            # Páginas da aplicação
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── HomePage.tsx
│   ├── services/         # Serviços de API
│   │   └── api.service.ts
│   ├── types/            # Tipos TypeScript
│   │   └── auth.types.ts
│   ├── App.tsx           # Componente principal com rotas
│   ├── main.tsx          # Ponto de entrada
│   └── index.css         # Estilos globais com Tailwind
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🔄 Fluxo de Autenticação

1. **Registro:**
   - Usuário acessa `/register`
   - Preenche o formulário (nome, e-mail, senha)
   - Sistema valida os dados com Zod
   - Envia requisição para o backend
   - Redireciona para login em caso de sucesso

2. **Login:**
   - Usuário acessa `/login`
   - Preenche e-mail e senha
   - Sistema valida e envia para o backend
   - Backend retorna token JWT + dados do usuário
   - Token é salvo no localStorage
   - Usuário é redirecionado para a página inicial

3. **Acesso a Rotas Protegidas:**
   - Sistema verifica se há token no localStorage
   - Se não houver, redireciona para login
   - Se houver, permite acesso à rota

4. **Logout:**
   - Usuário clica no botão "Sair"
   - Sistema envia token para o backend invalidar
   - Remove token do localStorage
   - Redireciona para login

## 🎨 Estilização

O projeto utiliza **Tailwind CSS** para toda a estilização:
- Design responsivo e moderno
- Componentes estilizados com utility classes
- Tema de cores consistente (azul e índigo)
- Feedback visual para estados de loading e erros

## 🔒 Segurança

- Tokens JWT armazenados no localStorage
- Interceptor Axios para adicionar token automaticamente
- Validação de formulários no frontend e backend
- Tratamento de erros 401 (não autorizado)
- Logout com invalidação de token no servidor

## 📝 Scripts Disponíveis

```bash
npm run dev      # Inicia servidor de desenvolvimento
npm run build    # Cria build de produção
npm run preview  # Preview do build de produção
npm run lint     # Executa linter
```

## 🔗 Integração com Backend

O frontend se comunica com o backend através dos seguintes endpoints:

- `POST /auth/register` - Cadastro de novo usuário
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout

A URL base da API está configurada em `src/services/api.service.ts`:
```typescript
const API_URL = 'http://localhost:3000';
```

## ✨ Observações

- O backend **DEVE** estar rodando na porta 3000
- Certifique-se de que o CORS está habilitado no backend
- O token JWT é enviado automaticamente em todas as requisições autenticadas através do header `Authorization: Bearer <token>`

---

Desenvolvido para o processo seletivo com ❤️
