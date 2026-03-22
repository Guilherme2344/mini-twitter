import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { PostService } from "../services/post.service";

export const postRoutes = new Elysia({ prefix: "/posts" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "super-secret-key",
    })
  )
  .get(
    "/",
    ({ query }) => {
      const page = query.page ? parseInt(query.page as string) : 1;
      const search = query.search as string | undefined;
      const sortParam = query.sort as string | undefined;
      const authorId = query.authorId ? Number(query.authorId) : undefined;
      const sort = sortParam === "oldest" || sortParam === "newest" ? sortParam : "none";

      return PostService.getAll(page, 10, search, sort, authorId);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        authorId: t.Optional(t.String()),
      }),
      detail: { tags: ["Posts"] },
    }
  )
  .guard(
    {
      async beforeHandle({ jwt, set, headers: { authorization } }) {
        if (!authorization) {
          set.status = 401;
          return { error: "Não autorizado: Token não fornecido" };
        }
        const token = authorization.split(" ")[1];

        const { AuthService } = await import("../services/auth.service");
        if (AuthService.isTokenBlacklisted(token)) {
          set.status = 401;
          return { error: "Não autorizado: Este token foi invalidado (logout realizado)" };
        }

        const payload = await jwt.verify(token);
        if (!payload) {
          set.status = 401;
          return { error: "Não autorizado: Token inválido ou expirado" };
        }

        if (typeof payload.sub !== "string") {
          set.status = 401;
          return { error: "Não autorizado: Token inválido ou expirado" };
        }

        const userId = Number(payload.sub);
        if (Number.isNaN(userId)) {
          set.status = 401;
          return { error: "Não autorizado: Token inválido ou expirado" };
        }

        const activeBan = AuthService.getActiveBanByUserId(userId);
        if (activeBan) {
          if (typeof payload.exp === "number") {
            AuthService.blacklistToken(token, payload.exp);
          }

          set.status = 401;
          return {
            error: "Conta Banida",
            code: "USER_BANNED",
            banReason: activeBan.reason,
            banDuration: activeBan.isPermanent
              ? "Para sempre"
              : `Até ${new Date(activeBan.bannedUntil as string).toLocaleString("pt-BR")}`,
          };
        }
      },
    },
    (app) =>
      app
        .post(
          "/",
          async ({ body, jwt, headers: { authorization }, set }) => {
            const token = authorization!.split(" ")[1];
            const payload = (await jwt.verify(token)) as any;

            if (body.image && body.image.length > 5 * 1024 * 1024) {
              set.status = 400;
              return { error: "Imagem muito grande: Limite de 5MB" };
            }

            return PostService.create(body.title, body.content, payload.sub, body.image);
          },
          {
            body: t.Object({
              title: t.String({ minLength: 3 }),
              content: t.String({ minLength: 1 }),
              image: t.Optional(t.String()),
            }),
            detail: { tags: ["Posts"] },
          }
        )
        .put(
          "/:id",
          async ({ params: { id }, body, jwt, set, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            const payload = (await jwt.verify(token)) as any;
            const userId = payload.sub;

            const post = PostService.getById(id);

            if (!post) {
              set.status = 404;
              return { error: "Post não encontrado" };
            }

            if (post.authorId.toString() !== userId) {
              set.status = 403;
              return { error: "Acesso negado: Você não é o autor deste post" };
            }

            if (body.image && body.image.length > 5 * 1024 * 1024) {
              set.status = 400;
              return { error: "Imagem muito grande: Limite de 5MB" };
            }

            return PostService.update(id, body.title, body.content, body.image);
          },
          {
            params: t.Object({
              id: t.Numeric(),
            }),
            body: t.Object({
              title: t.String({ minLength: 3 }),
              content: t.String({ minLength: 1 }),
              image: t.Optional(t.String()),
            }),
            detail: { tags: ["Posts"] },
          }
        )
        .delete(
          "/:id",
          async ({ params: { id }, jwt, set, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            const payload = (await jwt.verify(token)) as any;
            const userId = payload.sub;

            const post = PostService.getById(id);

            if (!post) {
              set.status = 404;
              return { error: "Post não encontrado" };
            }

            const { AuthService } = await import("../services/auth.service");
            const requester = AuthService.getUserById(Number(userId));
            const isAdmin = !!requester && AuthService.isAdminEmail(requester.email);

            if (post.authorId.toString() !== userId && !isAdmin) {
              set.status = 403;
              return { error: "Acesso negado: Você não tem permissão para excluir este post" };
            }

            return PostService.delete(id);
          },
          {
            params: t.Object({
              id: t.Numeric(),
            }),
            detail: { tags: ["Posts"] },
          }
        )
        .post(
          "/:id/like",
          async ({ params: { id }, jwt, headers: { authorization }, set }) => {
            const token = authorization!.split(" ")[1];
            const payload = (await jwt.verify(token)) as any;
            const userId = payload.sub;

            const post = PostService.getById(id);
            if (!post) {
              set.status = 404;
              return { error: "Post não encontrado" };
            }

            return PostService.toggleLike(id, userId);
          },
          {
            params: t.Object({
              id: t.Numeric(),
            }),
            detail: { tags: ["Posts"] },
          }
        )
        .post(
          "/:id/report",
          async ({ params: { id }, body, jwt, headers: { authorization }, set }) => {
            const token = authorization!.split(" ")[1];
            const payload = (await jwt.verify(token)) as any;
            const userId = Number(payload.sub);

            const post = PostService.getById(id);
            if (!post) {
              set.status = 404;
              return { error: "Post não encontrado" };
            }

            if (post.authorId === userId) {
              set.status = 400;
              return { error: "Você não pode denunciar o próprio post" };
            }

            const result = PostService.createReport(id, userId, body.reason.trim());

            if ((result as { alreadyReported?: boolean }).alreadyReported) {
              set.status = 400;
              return { error: "Você já denunciou este post e a denúncia está pendente." };
            }

            return { success: true, message: "Denúncia enviada com sucesso." };
          },
          {
            params: t.Object({
              id: t.Numeric(),
            }),
            body: t.Object({
              reason: t.String({ minLength: 5, maxLength: 500 }),
            }),
            detail: { tags: ["Posts"], summary: "Denunciar post" },
          }
        )
  );
