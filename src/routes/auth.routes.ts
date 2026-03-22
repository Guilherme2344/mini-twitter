import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AuthService, UserBannedError } from "../services/auth.service";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "super-secret-key",
    })
  )
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        const user = await AuthService.register(body.name, body.email, body.password);
        set.status = 201;
        return user;
      } catch (e) {
        set.status = 400;
        return { error: "Usuário já cadastrado ou dados inválidos" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 4 }),
      }),
      detail: { tags: ["Auth"] },
    }
  )
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      let user = null;

      try {
        user = await AuthService.login(body.email, body.password);
      } catch (error) {
        if (error instanceof UserBannedError) {
          set.status = 403;

          if (error.isPermanent) {
            return {
              error: "Conta Banida",
              banReason: error.reason,
              banDuration: "Para sempre",
            };
          }

          return {
            error: "Conta Banida",
            banReason: error.reason,
            banDuration: `Até ${new Date(error.bannedUntil as string).toLocaleString('pt-BR')}`,
          };
        }

        throw error;
      }

      if (!user) {
        set.status = 401;
        return { error: "Credenciais inválidas" };
      }

      const token = await jwt.sign({
        sub: user.id.toString(),
        name: user.name,
      });

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
      detail: { tags: ["Auth"] },
    }
  )
  .post(
    "/logout",
    async ({ jwt, headers: { authorization }, set }) => {
      if (!authorization) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const token = authorization.split(" ")[1];
      const payload = await jwt.verify(token);

      if (payload && typeof payload.exp === 'number') {
        AuthService.blacklistToken(token, payload.exp);
      }

      return { success: true, message: "Logout realizado com sucesso. Token invalidado." };
    },
    {
      detail: { tags: ["Auth"], summary: "Realiza logout e invalida o token atual" },
    }
  )
  .get(
    "/session-status",
    async ({ jwt, headers: { authorization }, set }) => {
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

      if (!payload || typeof payload.sub !== 'string') {
        set.status = 401;
        return { error: "Token inválido" };
      }

      const activeBan = AuthService.getActiveBanByUserId(Number(payload.sub));
      if (activeBan) {
        if (typeof payload.exp === 'number') {
          AuthService.blacklistToken(token, payload.exp);
        }

        set.status = 401;
        return {
          error: "Conta Banida",
          code: "USER_BANNED",
          banReason: activeBan.reason,
          banDuration: activeBan.isPermanent
            ? "Para sempre"
            : `Até ${new Date(activeBan.bannedUntil as string).toLocaleString('pt-BR')}`,
        };
      }

      return { active: true };
    },
    {
      detail: { tags: ["Auth"], summary: "Verifica status da sessão autenticada" },
    }
  )
  .delete(
    "/me",
    async ({ jwt, headers: { authorization }, set }) => {
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

      if (!payload || typeof payload.sub !== 'string') {
        set.status = 401;
        return { error: "Token inválido" };
      }

      AuthService.deleteUserAccount(Number(payload.sub));

      if (typeof payload.exp === 'number') {
        AuthService.blacklistToken(token, payload.exp);
      }

      return { success: true, message: "Perfil excluído com sucesso." };
    },
    {
      detail: { tags: ["Auth"], summary: "Excluir o próprio perfil" },
    }
  );
