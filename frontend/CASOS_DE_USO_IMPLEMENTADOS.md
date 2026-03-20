# Casos de Uso Implementados

Este documento resume os principais fluxos funcionais já implementados no sistema.

## 1) Autenticação
- Cadastro de usuário com validação de campos.
- Login com geração de token JWT.
- Logout com invalidação de token.
- Proteção de rotas privadas.

## 2) Feed de Posts
- Criação de post com título, conteúdo e imagem opcional.
- Edição e exclusão de posts do próprio autor.
- Curtida e descurtida de posts.
- Busca de posts por título, conteúdo e nome do autor.
- Filtros de feed: sem filtro, mais recente, mais antigo e meus posts.

## 3) Perfil de Usuário
- Atualização de nome e e-mail no frontend.
- Personalização de avatar e bio (persistência local por usuário).
- Exclusão da própria conta com remoção no backend.

## 4) Fluxo Administrativo
- Listagem de usuários com e-mail e status de banimento.
- Edição e exclusão de usuários.
- Banimento temporário e permanente.
- Revogação de banimento com confirmação.
- Visualização e exclusão de posts de usuário específico via UUID.

## 5) Moderação por Denúncia
- Denúncia de posts por usuários.
- Painel de denúncias para administrador.
- Ações de ignorar denúncia ou banir autor denunciado.

## 6) Consistência de Sessão e Segurança
- Interceptor de autenticação para anexar token automaticamente.
- Tratamento global de 401 com limpeza de sessão local.
- Validação de formulários com React Hook Form + Zod.

## 7) Compatibilidade de Dados
- Migração de identificação de usuário para UUID.
- Ajuste de seed para criação de usuários compatível com UUID.
