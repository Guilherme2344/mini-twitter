import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AdminService } from "../services/admin.service";
import { AuthService } from "../services/auth.service";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "super-secret-key",
    })
  )
  .guard(
    {
      async beforeHandle({ jwt, set, headers: { authorization } }) {
        if (!authorization) {
          set.status = 401;
          return { error: "Não autorizado" };
        }

        const token = authorization.split(" ")[1];

        if (AuthService.isTokenBlacklisted(token)) {
          set.status = 401;
          return { error: "Não autorizado: Este token foi invalidado (logout realizado)" };
        }

        const payload = await jwt.verify(token);

        if (!payload || typeof payload.sub !== "string") {
          set.status = 401;
          return { error: "Token inválido" };
        }

        const adminUser = AuthService.getUserById(Number(payload.sub));

        if (!adminUser || !AuthService.isAdminEmail(adminUser.email)) {
          set.status = 403;
          return { error: "Acesso restrito ao administrador" };
        }
      },
    },
    (app) =>
      app
        .get(
          "/users",
          () => {
            return AdminService.getUsersOverview();
          },
          { detail: { tags: ["Admin"], summary: "Listar usuários" } }
        )
        .get(
          "/users/:uuid/posts",
          ({ params, set }) => {
            const userUuid = params.uuid?.trim();
            if (!userUuid) {
              set.status = 400;
              return { error: "UUID de usuário inválido" };
            }

            const details = AdminService.getUserDetailsByUuid(userUuid);
            if (!details) {
              set.status = 404;
              return { error: "Usuário não encontrado" };
            }

            return details;
          },
          {
            params: t.Object({ uuid: t.String() }),
            detail: { tags: ["Admin"], summary: "Listar posts do usuário por UUID" },
          }
        )
        .put(
          "/users/:id",
          ({ params, body, set, jwt, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            return jwt.verify(token).then((payload) => {
              if (!payload || typeof payload.sub !== "string") {
                set.status = 401;
                return { error: "Token inválido" };
              }

              if (Number(payload.sub) === params.id) {
                set.status = 400;
                return { error: "Você não pode editar seu próprio usuário por esta tela." };
              }

              const updated = AdminService.updateUser(params.id, body.name, body.email);
              return { success: true, user: updated };
            });
          },
          {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
              name: t.String({ minLength: 2 }),
              email: t.String({ format: "email" }),
            }),
            detail: { tags: ["Admin"], summary: "Editar usuário" },
          }
        )
        .delete(
          "/users/:id",
          ({ params, set, jwt, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            return jwt.verify(token).then((payload) => {
              if (!payload || typeof payload.sub !== "string") {
                set.status = 401;
                return { error: "Token inválido" };
              }

              if (Number(payload.sub) === params.id) {
                set.status = 400;
                return { error: "Você não pode excluir seu próprio usuário." };
              }

              return AdminService.deleteUser(params.id);
            });
          },
          {
            params: t.Object({ id: t.Numeric() }),
            detail: { tags: ["Admin"], summary: "Excluir usuário" },
          }
        )
        .post(
          "/users/:id/ban",
          ({ params, body, set, jwt, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            return jwt.verify(token).then((payload) => {
              if (!payload || typeof payload.sub !== "string") {
                set.status = 401;
                return { error: "Token inválido" };
              }

              if (Number(payload.sub) === params.id) {
                set.status = 400;
                return { error: "Você não pode banir seu próprio usuário." };
              }

              const permanent = body.permanent === true;
              const durationDays = body.durationDays;

              if (!permanent && (!durationDays || durationDays < 1)) {
                set.status = 400;
                return { error: "Informe a quantidade de dias para o banimento temporário." };
              }

              return AdminService.banUser(params.id, durationDays, permanent, body.reason);
            });
          },
          {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
              durationDays: t.Optional(t.Numeric({ minimum: 1 })),
              permanent: t.Optional(t.Boolean()),
              reason: t.Optional(t.String({ minLength: 3, maxLength: 300 })),
            }),
            detail: { tags: ["Admin"], summary: "Banir usuário por dias ou permanentemente" },
          }
        )
        .post(
          "/users/:id/unban",
          ({ params, set, jwt, headers: { authorization } }) => {
            const token = authorization!.split(" ")[1];
            return jwt.verify(token).then((payload) => {
              if (!payload || typeof payload.sub !== "string") {
                set.status = 401;
                return { error: "Token inválido" };
              }

              if (Number(payload.sub) === params.id) {
                set.status = 400;
                return { error: "Você não pode revogar seu próprio banimento por esta tela." };
              }

              return AdminService.revokeBanUser(params.id);
            });
          },
          {
            params: t.Object({ id: t.Numeric() }),
            detail: { tags: ["Admin"], summary: "Revogar banimento de usuário" },
          }
        )
        .get(
          "/reports",
          ({ query }) => {
            return AdminService.getReports(query.status);
          },
          {
            query: t.Object({
              status: t.Optional(t.String()),
            }),
            detail: { tags: ["Admin"], summary: "Listar denúncias" },
          }
        )
        .post(
          "/reports/:id/ignore",
          async ({ params, headers: { authorization }, jwt, set }) => {
            const token = authorization!.split(" ")[1];
            const payload = await jwt.verify(token);

            if (!payload || typeof payload.sub !== "string") {
              set.status = 401;
              return { error: "Token inválido" };
            }

            return AdminService.ignoreReport(params.id, Number(payload.sub));
          },
          {
            params: t.Object({ id: t.Numeric() }),
            detail: { tags: ["Admin"], summary: "Ignorar denúncia" },
          }
        )
        .post(
          "/reports/:id/ban",
          async ({ params, body, headers: { authorization }, jwt, set }) => {
            const token = authorization!.split(" ")[1];
            const payload = await jwt.verify(token);

            if (!payload || typeof payload.sub !== "string") {
              set.status = 401;
              return { error: "Token inválido" };
            }

            const permanent = body.permanent === true;
            const durationDays = body.durationDays;

            if (!permanent && (!durationDays || durationDays < 1)) {
              set.status = 400;
              return { error: "Informe a quantidade de dias para o banimento temporário." };
            }

            const result = AdminService.banFromReport(params.id, Number(payload.sub), durationDays, permanent, body.reason);
            if (!result) {
              set.status = 404;
              return { error: "Denúncia não encontrada" };
            }

            return result;
          },
          {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
              durationDays: t.Optional(t.Numeric({ minimum: 1 })),
              permanent: t.Optional(t.Boolean()),
              reason: t.Optional(t.String({ minLength: 3, maxLength: 300 })),
            }),
            detail: { tags: ["Admin"], summary: "Banir usuário por denúncia (dias ou permanente)" },
          }
        )
  );
