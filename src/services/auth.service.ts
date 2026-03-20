import { db } from "../db";

export const ADMIN_EMAIL = "minitwitteradmin@access.total.ok";
const ADMIN_DEFAULT_NAME = "Mini Twitter Admin";
const ADMIN_DEFAULT_PASSWORD = "minitwitter123";

export class UserBannedError extends Error {
  constructor(public bannedUntil: string | null, public reason: string, public isPermanent: boolean = false) {
    super("USER_BANNED");
    this.name = "UserBannedError";
  }
}

export class AuthService {
  private static isBanActive(bannedUntil?: string | null) {
    if (!bannedUntil) {
      return false;
    }

    if (bannedUntil === "PERMANENT") {
      return true;
    }

    return new Date(bannedUntil).getTime() > Date.now();
  }

  private static throwIfBanned(bannedUntil?: string | null, bannedReason?: string | null) {
    if (!this.isBanActive(bannedUntil)) {
      return;
    }

    const safeReason = bannedReason?.trim() || "Não informado";

    if (bannedUntil === "PERMANENT") {
      throw new UserBannedError(null, safeReason, true);
    }

    throw new UserBannedError(bannedUntil || null, safeReason);
  }

  static async ensureAdminAccount() {
    const existingAdmin = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(ADMIN_EMAIL) as { id: number } | undefined;

    if (existingAdmin) {
      return;
    }

    const hashedPassword = await Bun.password.hash(ADMIN_DEFAULT_PASSWORD);
    db.prepare("INSERT INTO users (uuid, name, email, password) VALUES (?, ?, ?, ?)").run(
      crypto.randomUUID(),
      ADMIN_DEFAULT_NAME,
      ADMIN_EMAIL,
      hashedPassword
    );
  }

  static async register(name: string, email: string, password: string) {
    const hashedPassword = await Bun.password.hash(password);

    const query = db.prepare(
      "INSERT INTO users (uuid, name, email, password) VALUES (?, ?, ?, ?) RETURNING id, name, email"
    );
    return query.get(crypto.randomUUID(), name, email, hashedPassword) as { id: number; name: string; email: string };
  }

  static async login(email: string, password: string) {
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as { id: number; name: string; email: string; password: string; bannedUntil?: string | null; bannedReason?: string | null } | undefined;

    if (!user) {
      return null;
    }

    const storedPassword = user.password;
    const looksHashed = storedPassword.startsWith("$argon2") || storedPassword.startsWith("$2");

    if (looksHashed) {
      const isValid = await Bun.password.verify(password, storedPassword);
      if (!isValid) return null;
      this.throwIfBanned(user.bannedUntil, user.bannedReason);
      return user;
    }

    if (storedPassword !== password) {
      return null;
    }

    this.throwIfBanned(user.bannedUntil, user.bannedReason);

    const upgradedHash = await Bun.password.hash(password);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(upgradedHash, user.id);
    return user;
  }

  static getUserById(userId: number) {
    return db
      .prepare("SELECT id, name, email, bannedUntil FROM users WHERE id = ?")
      .get(userId) as { id: number; name: string; email: string; bannedUntil?: string | null } | undefined;
  }

  static isAdminEmail(email: string) {
    return email.toLowerCase() === ADMIN_EMAIL;
  }

  static blacklistToken(token: string, expiresAt: number) {
    // expiresAt vem do JWT (exp) em segundos
    const date = new Date(expiresAt * 1000).toISOString();
    db.prepare("INSERT OR IGNORE INTO tokens_blacklist (token, expiresAt) VALUES (?, ?)").run(token, date);
  }

  static isTokenBlacklisted(token: string) {
    const result = db.prepare("SELECT id FROM tokens_blacklist WHERE token = ?").get(token);
    return !!result;
  }

  static deleteUserAccount(userId: number) {
    db.transaction(() => {
      db.prepare("DELETE FROM likes WHERE postId IN (SELECT id FROM posts WHERE authorId = ?)").run(userId);
      db.prepare("DELETE FROM reports WHERE postId IN (SELECT id FROM posts WHERE authorId = ?)").run(userId);
      db.prepare("DELETE FROM posts WHERE authorId = ?").run(userId);
      db.prepare("DELETE FROM likes WHERE userId = ?").run(userId);
      db.prepare("DELETE FROM reports WHERE reporterId = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    })();

    return { success: true };
  }
}
