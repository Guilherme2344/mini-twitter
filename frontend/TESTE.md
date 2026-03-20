# 🧪 Guia de Testes - Sistema de Autenticação

## 📋 Pré-requisitos

1. **Backend rodando:**
   ```bash
   cd c:/Users/T-GAMER/Downloads/mini-twitter-backend-main
   bun run dev
   # ou
   docker-compose up
   ```
   O backend deve estar em: `http://localhost:3000`

2. **Frontend rodando:**
   ```bash
   cd c:/Users/T-GAMER/Downloads/mini-twitter-backend-main/frontend
   npm run dev
   ```
   O frontend estará em: `http://localhost:5173`

## 🎯 Cenários de Teste

### 1️⃣ Teste de Registro

**Objetivo:** Verificar se um novo usuário consegue se cadastrar

**Passos:**
1. Acesse `http://localhost:5173`
2. Você será redirecionado para `/login`
3. Clique em "Cadastre-se"
4. Preencha o formulário:
   - **Nome:** João Silva
   - **E-mail:** joao@email.com
   - **Senha:** 1234
   - **Confirmar Senha:** 1234
5. Clique em "Cadastrar"

**Resultado Esperado:**
- ✅ Mensagem de sucesso: "Cadastro realizado com sucesso! Redirecionando..."
- ✅ Redirecionamento automático para `/login` após 2 segundos

**Validações Testadas:**
- Nome com mínimo 2 caracteres
- E-mail em formato válido
- Senha com mínimo 4 caracteres
- Confirmação de senha igual à senha
- Tratamento de erro se e-mail já existe

---

### 2️⃣ Teste de Login

**Objetivo:** Verificar se usuário consegue fazer login com credenciais válidas

**Passos:**
1. Na tela de login, preencha:
   - **E-mail:** joao@email.com
   - **Senha:** 1234
2. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Redirecionamento para a página inicial (`/`)
- ✅ Nome do usuário exibido no header: "Olá, João Silva"
- ✅ Token JWT salvo no localStorage
- ✅ Informações do usuário salvas no localStorage

**Validações Testadas:**
- E-mail em formato válido
- Senha não pode estar vazia
- Tratamento de erro para credenciais inválidas

---

### 3️⃣ Teste de Proteção de Rotas

**Objetivo:** Verificar se rotas protegidas não são acessíveis sem autenticação

**Passos:**
1. Faça logout (se estiver logado)
2. Tente acessar diretamente `http://localhost:5173/`

**Resultado Esperado:**
- ✅ Redirecionamento automático para `/login`
- ✅ Não consegue acessar conteúdo protegido sem estar autenticado

---

### 4️⃣ Teste de Logout

**Objetivo:** Verificar se o logout funciona corretamente

**Passos:**
1. Faça login com um usuário válido
2. Na página inicial, clique no botão "Sair" (vermelho, canto superior direito)
3. Confirme a ação na caixa de diálogo

**Resultado Esperado:**
- ✅ Chamada ao endpoint `POST /auth/logout`
- ✅ Token removido do localStorage
- ✅ Informações do usuário removidas do localStorage
- ✅ Redirecionamento para `/login`
- ✅ Não consegue mais acessar rotas protegidas

---

### 5️⃣ Teste de Persistência de Sessão

**Objetivo:** Verificar se a sessão persiste após recarregar a página

**Passos:**
1. Faça login com um usuário válido
2. Recarregue a página (F5)

**Resultado Esperado:**
- ✅ Usuário continua logado
- ✅ Nome e informações continuam exibidos
- ✅ Não é redirecionado para login

---

### 6️⃣ Teste de Validação - E-mail Inválido

**Passos:**
1. Na tela de login, digite:
   - **E-mail:** emailinvalido
   - **Senha:** 1234
2. Tente enviar o formulário

**Resultado Esperado:**
- ✅ Mensagem de erro abaixo do campo e-mail: "E-mail inválido"
- ✅ Formulário não é enviado
- ✅ Campo fica destacado em vermelho

---

### 7️⃣ Teste de Validação - Senhas Não Coincidem

**Passos:**
1. Na tela de registro, preencha:
   - **Nome:** Maria
   - **E-mail:** maria@email.com
   - **Senha:** 1234
   - **Confirmar Senha:** 5678
2. Tente enviar o formulário

**Resultado Esperado:**
- ✅ Mensagem de erro: "As senhas não coincidem"
- ✅ Formulário não é enviado

---

### 8️⃣ Teste de E-mail Já Cadastrado

**Passos:**
1. Tente cadastrar um usuário com e-mail que já existe:
   - **E-mail:** joao@email.com (usado no teste 1)
2. Preencha os outros campos e envie

**Resultado Esperado:**
- ✅ Mensagem de erro: "Usuário já cadastrado ou dados inválidos"
- ✅ Usuário não é cadastrado

---

### 9️⃣ Teste de Credenciais Inválidas

**Passos:**
1. Na tela de login, digite:
   - **E-mail:** usuario@inexistente.com
   - **Senha:** senhaerrada
2. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Mensagem de erro: "Credenciais inválidas"
- ✅ Usuário não é autenticado
- ✅ Permanece na tela de login

---

### 🔟 Teste de Loading States

**Objetivo:** Verificar feedback visual durante requisições

**Passos:**
1. Faça login
2. Observe o botão durante a requisição

**Resultado Esperado:**
- ✅ Botão mostra "Entrando..." durante o carregamento
- ✅ Botão fica desabilitado e opaco
- ✅ Cursor muda para "not-allowed"

---

## 🔍 Verificações no DevTools

### LocalStorage
Após fazer login, verifique no DevTools (F12 → Application → Local Storage):
- `token`: Token JWT (string longa)
- `user`: JSON com `{id, name, email}`

### Network
Verifique no DevTools (F12 → Network) as requisições:
- **POST /auth/register**: Status 201 (sucesso) ou 400 (erro)
- **POST /auth/login**: Status 200 (sucesso) ou 401 (não autorizado)
- **POST /auth/logout**: Status 200 com header `Authorization: Bearer <token>`

---

## ✅ Checklist de Funcionalidades

- [x] Registro de novo usuário
- [x] Validação de formato de e-mail
- [x] Validação de campos obrigatórios
- [x] Confirmação de senha
- [x] Login com e-mail e senha
- [x] Armazenamento de token JWT
- [x] Persistência de sessão
- [x] Proteção de rotas
- [x] Logout com invalidação de token
- [x] Remoção de dados do localStorage
- [x] Tratamento de erros
- [x] Feedback visual (loading, erros)
- [x] Redirecionamentos automáticos
- [x] Interface responsiva

---

## 🚨 Troubleshooting

### Erro: "Network Error"
- ✅ Verifique se o backend está rodando na porta 3000
- ✅ Verifique se o CORS está habilitado no backend

### Erro: "401 Unauthorized"
- ✅ Token pode estar expirado ou inválido
- ✅ Faça logout e login novamente

### Página em branco
- ✅ Verifique o console do navegador (F12 → Console)
- ✅ Verifique se há erros no terminal do frontend

---

## 📊 Métricas de Sucesso

- ✅ Todas as funcionalidades funcionam conforme especificado
- ✅ Validações impedem dados inválidos
- ✅ Tratamento de erros é amigável ao usuário
- ✅ Interface é responsiva e intuitiva
- ✅ Sem erros no console
- ✅ Build de produção funciona (`npm run build`)

---

**Boa sorte no processo seletivo! 🚀**
