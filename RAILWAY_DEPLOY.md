# Deploy no Railway (Backend)

## Pré-requisitos
- Repositório no GitHub com este projeto.
- Conta no Railway.

## Passo a passo
1. No Railway, clique em **New Project**.
2. Escolha **Deploy from GitHub repo**.
3. Selecione este repositório.
4. No serviço criado, adicione a variável de ambiente:
   - `JWT_SECRET` = uma chave forte (ex.: 32+ caracteres).
5. Faça deploy.

## Como obter a URL pública
- Após deploy, o Railway gera um domínio público (ex.: `https://seu-app.up.railway.app`).
- Use essa URL no frontend (`VITE_API_URL`).

## Configuração do frontend (Vercel)
No projeto do frontend no Vercel, configure:
- `VITE_API_URL` = URL pública do backend no Railway.

## Observação importante sobre banco
Este backend usa `SQLite` em arquivo local (`db.sqlite`). Em ambientes cloud, isso pode ter limitações de persistência/escala dependendo do plano e estratégia de volume.

Para produção com menos risco, o ideal é migrar para PostgreSQL (Railway Postgres, Supabase ou Neon).

## Teste rápido pós-deploy
- `GET /posts?page=1`
- `POST /auth/register`
- `POST /auth/login`
- `GET /swagger`
