import { db } from "./src/db";

console.log("🌱 Populando o banco de dados...");

// Limpar dados existentes
db.run("DELETE FROM likes");
db.run("DELETE FROM posts");
db.run("DELETE FROM users");
db.run("DELETE FROM sqlite_sequence WHERE name IN ('users', 'posts', 'likes')");

// Criar usuários
const users = [
  { name: "Alice Silva", email: "alice@example.com", password: "password123" },
  { name: "Bob Santos", email: "bob@example.com", password: "password123" },
  { name: "Charlie Oliveira", email: "charlie@example.com", password: "password123" },
];

const insertUser = db.prepare("INSERT INTO users (uuid, name, email, password) VALUES (?, ?, ?, ?) RETURNING id");

const userIds: number[] = [];
for (const user of users) {
  const hashedPassword = await Bun.password.hash(user.password);
  const result = insertUser.get(crypto.randomUUID(), user.name, user.email, hashedPassword) as { id: number };
  userIds.push(result.id);
}

console.log(`✅ ${userIds.length} usuários criados.`);

// Criar posts
const posts = [
  { title: "Meu primeiro post", content: "Olá mundo! Este é o meu primeiro tweet no Mini Twitter.", authorId: userIds[0] },
  { title: "ElysiaJS é incrível", content: "Estou adorando construir APIs com Bun e ElysiaJS. É muito rápido!", authorId: userIds[0] },
  { title: "Dica de Bun", content: "Você sabia que o Bun tem um SQLite nativo super veloz?", authorId: userIds[1] },
  { title: "Frontend Moderno", content: "Uma API bem estruturada facilita muito a vida de quem desenvolve o front.", authorId: userIds[2] },
  { title: "TypeScript em todo lugar", content: "Segurança de tipos é essencial para projetos escaláveis.", authorId: userIds[2] },
  { title: "Café e Código", content: "Nada como um bom café para começar o dia programando.", authorId: userIds[1] },
  { title: "Deploy Simples", content: "Com Bun, o deploy de aplicações backend ficou muito mais direto.", authorId: userIds[0] },
];

const insertPost = db.prepare("INSERT INTO posts (title, content, authorId) VALUES (?, ?, ?)");
posts.forEach(p => insertPost.run(p.title, p.content, p.authorId));

console.log(`✅ ${posts.length} posts criados.`);

// Criar alguns likes aleatórios
const insertLike = db.prepare("INSERT INTO likes (postId, userId) VALUES (?, ?)");
const allPosts = db.prepare("SELECT id FROM posts").all() as any[];

allPosts.forEach((post, index) => {
  // Alice dá like em quase tudo
  if (index % 2 === 0) insertLike.run(post.id, userIds[0]);
  // Bob dá like nos posts pares
  if (index % 3 === 0) insertLike.run(post.id, userIds[1]);
});

console.log("✅ Likes iniciais adicionados.");
console.log("🚀 Banco de dados populado com sucesso!");
