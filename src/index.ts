import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth.routes";
import { postRoutes } from "./routes/post.routes";
import { adminRoutes } from "./routes/admin.routes";
import { AuthService } from "./services/auth.service";

await AuthService.ensureAdminAccount();

const port = Number(process.env.PORT || 3000);

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Mini Twitter API',
        version: '1.0.0',
        description: 'API para uma mini rede social focada em simplicidade e segurança.'
      }
    }
  }))
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "super-secret-key",
    })
  )
  // Tratamento de Erros Customizado
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: "Erro de validação",
        message: "Os dados enviados são inválidos ou estão incompletos.",
        // Em desenvolvimento você pode querer ver o detalhe, mas para o front-end moderno
        // uma mensagem amigável é melhor.
        details: error.all.map(e => ({
          field: e.path.substring(1),
          message: e.message
        }))
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: "Recurso não encontrado" };
    }

    console.error(error);
    return { error: "Erro interno do servidor", message: "Ocorreu um problema inesperado." };
  })
  .use(authRoutes)
  .use(postRoutes)
  .use(adminRoutes)
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
