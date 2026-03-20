# Mini Twitter Backend - Bun & ElysiaJS

Este é o back-end de uma mini rede social construída com **Bun** e **ElysiaJS**, focada em performance, segurança e facilidade de consumo por front-ends modernos.

## 🚀 Tecnologias

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [ElysiaJS](https://elysiajs.com/)
- **Banco de Dados**: SQLite (via `bun:sqlite`)
- **Autenticação**: JWT com Blacklist para logout
- **Documentação**: Swagger/OpenAPI
- **Containerização**: Docker & Docker Compose

## 🛠️ Funcionalidades

- **Autenticação Completa**: Registro, Login e Logout (com invalidação de token).
- **CRUD de Posts**: Criação, listagem, edição e exclusão.
- **Segurança**: Apenas o autor de um post pode editá-lo ou excluí-lo.
- **Paginação e Busca**: Listagem de posts com suporte a `page` e `search` (por título).
- **Sistema de Likes**: Toggle de likes em posts (apenas um por usuário).
- **Validação**: Limite de 5MB para imagens e campos obrigatórios validados via TypeBox.

## 📦 Como Rodar com Docker

A maneira mais fácil de iniciar o projeto é usando Docker:

```bash
# Iniciar o container
docker-compose up -d
```

A API estará disponível em `http://localhost:3000`.

## 💻 Como Rodar Localmente

Certifique-se de ter o [Bun](https://bun.sh/) instalado.

```bash
# Instalar dependências
bun install

# Popular o banco de dados com dados iniciais
bun run seed

# Iniciar em modo de desenvolvimento
bun run dev
```

## 📖 Documentação da API

Após iniciar o servidor, a documentação interativa (Swagger) pode ser acessada em:
`http://localhost:3000/swagger`

## 🗄️ Estrutura do Projeto

- `src/index.ts`: Ponto de entrada e configurações globais.
- `src/routes/`: Definição dos endpoints e validações.
- `src/services/`: Lógica de negócio e acesso ao banco de dados.
- `src/db.ts`: Configuração e esquema do SQLite.
- `seed.ts`: Script para popular o banco de dados.

## 🔒 Variáveis de Ambiente

O projeto utiliza as seguintes variáveis (configuradas com valores padrão):
- `JWT_SECRET`: Chave secreta para assinatura dos tokens.

---
Desenvolvido para o processo seletivo da B2Bit.
