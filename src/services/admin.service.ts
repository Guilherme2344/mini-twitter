import { db } from "../db";

export class AdminService {
  static getUsersOverview() {
    return db
      .prepare(
        `SELECT u.id, u.uuid, u.name, u.email, u.bannedUntil, u.bannedReason,
          (SELECT COUNT(*) FROM posts p WHERE p.authorId = u.id) as postsCount
         FROM users u
         ORDER BY u.id ASC`
      )
      .all() as Array<{
      id: number;
      uuid: string;
      name: string;
      email: string;
      bannedUntil?: string | null;
      bannedReason?: string | null;
      postsCount: number;
    }>;
  }

  static getUserDetails(userId: number) {
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.bannedUntil, u.bannedReason,
          (SELECT COUNT(*) FROM posts p WHERE p.authorId = u.id) as postsCount
         FROM users u
         WHERE u.id = ?`
      )
      .get(userId) as
      | { id: number; name: string; email: string; bannedUntil?: string | null; bannedReason?: string | null; postsCount: number }
      | undefined;

    if (!user) {
      return null;
    }

    const posts = db
      .prepare(
        `SELECT p.id, p.title, p.content, p.image, p.createdAt,
          (SELECT COUNT(*) FROM likes l WHERE l.postId = p.id) as likesCount
         FROM posts p
         WHERE p.authorId = ?
         ORDER BY p.createdAt DESC`
      )
      .all(userId);

    return { user, posts };
  }

  static getUserDetailsByUuid(userUuid: string) {
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.bannedUntil, u.bannedReason,
          (SELECT COUNT(*) FROM posts p WHERE p.authorId = u.id) as postsCount
         FROM users u
         WHERE u.uuid = ?`
      )
      .get(userUuid) as
      | { id: number; name: string; email: string; bannedUntil?: string | null; bannedReason?: string | null; postsCount: number }
      | undefined;

    if (!user) {
      return null;
    }

    const posts = db
      .prepare(
        `SELECT p.id, p.title, p.content, p.image, p.createdAt,
          (SELECT COUNT(*) FROM likes l WHERE l.postId = p.id) as likesCount
         FROM posts p
         WHERE p.authorId = ?
         ORDER BY p.createdAt DESC`
      )
      .all(user.id);

    return { user, posts };
  }

  static getUserReportedPostsByUuid(userUuid: string) {
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.bannedUntil, u.bannedReason,
          (SELECT COUNT(*) FROM posts p WHERE p.authorId = u.id) as postsCount
         FROM users u
         WHERE u.uuid = ?`
      )
      .get(userUuid) as
      | { id: number; name: string; email: string; bannedUntil?: string | null; bannedReason?: string | null; postsCount: number }
      | undefined;

    if (!user) {
      return null;
    }

    const posts = db
      .prepare(
        `SELECT DISTINCT p.id, p.title, p.content, p.image, p.createdAt,
          (SELECT COUNT(*) FROM likes l WHERE l.postId = p.id) as likesCount,
          (SELECT COUNT(*) FROM reports r WHERE r.postId = p.id) as reportsCount
         FROM posts p
         JOIN reports r ON r.postId = p.id
         WHERE p.authorId = ?
         ORDER BY p.createdAt DESC`
      )
      .all(user.id) as Array<{
      id: number;
      title: string;
      content: string;
      image?: string | null;
      createdAt: string;
      likesCount: number;
      reportsCount: number;
    }>;

    const postsWithReports = posts.map((post) => {
      const reports = db
        .prepare(
          `SELECT r.id, r.reason, r.status, r.createdAt,
            reporter.name as reporterName,
            reporter.email as reporterEmail
           FROM reports r
           JOIN users reporter ON reporter.id = r.reporterId
           WHERE r.postId = ?
           ORDER BY r.createdAt DESC`
        )
        .all(post.id) as Array<{
        id: number;
        reason: string;
        status: string;
        createdAt: string;
        reporterName: string;
        reporterEmail: string;
      }>;

      return {
        ...post,
        reports,
      };
    });

    return { user, posts: postsWithReports };
  }

  static updateUser(userId: number, name: string, email: string) {
    db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, userId);
    return db
      .prepare("SELECT id, name, email, bannedUntil FROM users WHERE id = ?")
      .get(userId) as { id: number; name: string; email: string; bannedUntil?: string | null };
  }

  static deleteUser(userId: number) {
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

  static revokeBanUser(userId: number) {
    db.prepare("UPDATE users SET bannedUntil = NULL, bannedReason = NULL WHERE id = ?").run(userId);
    return { success: true };
  }

  static banUser(userId: number, durationDays?: number, permanent: boolean = false, reason?: string) {
    const bannedUntil = permanent
      ? "PERMANENT"
      : new Date(Date.now() + (durationDays || 1) * 24 * 60 * 60 * 1000).toISOString();
    const bannedReason = reason?.trim() || "Não informado";

    db.prepare("UPDATE users SET bannedUntil = ?, bannedReason = ? WHERE id = ?").run(bannedUntil, bannedReason, userId);
    return { success: true, bannedUntil, permanent, bannedReason };
  }

  static getReports(status?: string) {
    const params: Array<string> = [];
    let query = `
      SELECT r.id, r.reason, r.status, r.createdAt, r.reviewedAt, r.action,
             p.id as postId, p.title as postTitle, p.content as postContent,
             reporter.id as reporterId, reporter.name as reporterName, reporter.email as reporterEmail,
             author.id as authorId, author.name as authorName, author.email as authorEmail,
             reviewer.id as reviewerId, reviewer.name as reviewerName
      FROM reports r
      JOIN posts p ON p.id = r.postId
      JOIN users reporter ON reporter.id = r.reporterId
      JOIN users author ON author.id = p.authorId
      LEFT JOIN users reviewer ON reviewer.id = r.reviewedBy
    `;

    if (status) {
      query += " WHERE r.status = ?";
      params.push(status);
    }

    query += " ORDER BY r.createdAt DESC";

    return db.prepare(query).all(...params);
  }

  static ignoreReport(reportId: number, adminId: number) {
    db.prepare(
      "UPDATE reports SET status = 'ignored', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, action = 'ignored' WHERE id = ?"
    ).run(adminId, reportId);

    return { success: true };
  }

  static banFromReport(reportId: number, adminId: number, durationDays?: number, permanent: boolean = false, reason?: string) {
    const report = db
      .prepare(
        `SELECT r.id, p.authorId
         FROM reports r
         JOIN posts p ON p.id = r.postId
         WHERE r.id = ?`
      )
      .get(reportId) as { id: number; authorId: number } | undefined;

    if (!report) {
      return null;
    }

    const banResult = this.banUser(report.authorId, durationDays, permanent, reason);

    db.prepare(
      "UPDATE reports SET status = 'actioned', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, action = 'ban' WHERE id = ?"
    ).run(adminId, reportId);

    return { success: true, bannedUntil: banResult.bannedUntil, permanent: banResult.permanent };
  }
}
