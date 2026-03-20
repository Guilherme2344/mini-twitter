# Alterações aplicadas no backend e motivos

## 1) Busca e filtros no feed (`GET /posts`)
- **O que mudou**:
  - Busca passou a considerar `title`, `content` e `name` do autor.
  - Endpoint passou a aceitar `sort` (`none|newest|oldest`) e `authorId`.
- **Motivo**:
  - Atender requisito de pesquisa mais útil na homepage e filtros de ordenação/meus posts.

## 2) UUID para usuários
- **O que mudou**:
  - Tabela `users` recebeu coluna `uuid` única.
  - Migração preenche UUID para usuários antigos sem valor.
  - Criação de usuários (registro e bootstrap admin) passou a salvar UUID.
- **Motivo**:
  - Substituir uso de `hash_id` por identificador estável e padrão (UUID).

## 3) Rotas administrativas de posts por usuário
- **O que mudou**:
  - Rota administrativa de listagem de posts por usuário passou para UUID:
    - de caminho baseado em id/hash para `/admin/users/:uuid/posts`.
  - Serviço administrativo ganhou consulta por UUID (`getUserDetailsByUuid`).
  - Listagem de usuários para admin inclui `uuid`.
- **Motivo**:
  - Manter consistência com a migração para UUID e simplificar navegação frontend/backend.

## 4) Painel administrativo (suporte de dados)
- **O que mudou**:
  - Estruturas retornadas para o frontend preservam dados de banimento (`bannedUntil`, `bannedReason`) e agora também `uuid`.
- **Motivo**:
  - Suportar ações de moderação e navegação para posts de usuários sem depender de codificação de ID.

## 5) Seed do banco (`seed.ts`)
- **O que mudou**:
  - Inserção de usuários no seed agora preenche `uuid` com `crypto.randomUUID()`.
- **Motivo**:
  - Garantir que usuários criados automaticamente via seed estejam compatíveis com os novos fluxos por UUID.

## Arquivos impactados (backend)
- `src/db.ts`
- `src/services/auth.service.ts`
- `src/services/post.service.ts`
- `src/routes/post.routes.ts`
- `src/services/admin.service.ts`
- `src/routes/admin.routes.ts`
- `seed.ts`
