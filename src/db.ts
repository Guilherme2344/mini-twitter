import { Database } from "bun:sqlite";

const databasePath = process.env.DATABASE_PATH || "db.sqlite";
const db = new Database(databasePath, { create: true });

const hasColumn = (table: string, column: string) => {
  const columns = db
    .query(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;

  return columns.some((current) => current.name === column);
};

// Habilitar Foreign Keys
db.run("PRAGMA foreign_keys = ON;");

// Criar tabelas
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    bannedUntil DATETIME,
    bannedReason TEXT
  );
`);

if (!hasColumn("users", "bannedUntil")) {
  db.run("ALTER TABLE users ADD COLUMN bannedUntil DATETIME");
}

if (!hasColumn("users", "bannedReason")) {
  db.run("ALTER TABLE users ADD COLUMN bannedReason TEXT");
}

if (!hasColumn("users", "uuid")) {
  db.run("ALTER TABLE users ADD COLUMN uuid TEXT");
}

const usersWithoutUuid = db
  .prepare("SELECT id FROM users WHERE uuid IS NULL OR uuid = ''")
  .all() as Array<{ id: number }>;

for (const user of usersWithoutUuid) {
  db.prepare("UPDATE users SET uuid = ? WHERE id = ?").run(crypto.randomUUID(), user.id);
}

db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid)");

db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    authorId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(postId, userId),
    FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tokens_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postId INTEGER NOT NULL,
    reporterId INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewedBy INTEGER,
    reviewedAt DATETIME,
    action TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (reporterId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewedBy) REFERENCES users(id) ON DELETE SET NULL
  );
`);

export { db };
