import { db } from "../db";

export class PostService {
  static getAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sort: "oldest" | "newest" | "none" = "none",
    authorId?: number
  ) {

    const queryPage = isNaN(page) ? 1 : page;

    const offset = (queryPage - 1) * limit;
    let queryStr = `
      SELECT p.*, u.name as authorName, 
      (SELECT COUNT(*) FROM likes WHERE postId = p.id) as likesCount
      FROM posts p 
      JOIN users u ON p.authorId = u.id 
    `;

    const params: Array<string | number> = [];
    const whereClauses: string[] = [];

    if (search) {
      whereClauses.push(`(p.title LIKE ? OR p.content LIKE ? OR u.name LIKE ?)`);
      const likeValue = `%${search}%`;
      params.push(likeValue, likeValue, likeValue);
    }

    if (authorId) {
      whereClauses.push(`p.authorId = ?`);
      params.push(authorId);
    }

    if (whereClauses.length > 0) {
      queryStr += ` WHERE ${whereClauses.join(" AND ")} `;
    }

    if (sort === "oldest") {
      queryStr += ` ORDER BY p.createdAt ASC `;
    } else {
      queryStr += ` ORDER BY p.createdAt DESC `;
    }

    queryStr += ` LIMIT ? OFFSET ? `;
    params.push(limit, offset);

    const posts = db.prepare(queryStr).all(...params);
    
    // Total para paginação
    let countQuery = "SELECT COUNT(*) as total FROM posts p JOIN users u ON p.authorId = u.id";
    const countParams: Array<string | number> = [];

    if (search) {
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (authorId) {
      countParams.push(authorId);
    }

    if (whereClauses.length > 0) {
      countQuery += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    const total = (db.prepare(countQuery).get(...countParams) as any).total;
    return { posts, total, page: queryPage, limit };
  }

  static create(title: string, content: string, authorId: string, image?: string) {
    const query = db.prepare(
      "INSERT INTO posts (title, content, authorId, image) VALUES (?, ?, ?, ?) RETURNING *"
    );
    return query.get(title, content, authorId, image ?? null);
  }

  static getById(id: number) {
    return db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as any;
  }

  static update(id: number, title: string, content: string, image?: string) {
    db.prepare("UPDATE posts SET title = ?, content = ?, image = ? WHERE id = ?").run(title, content, image ?? null, id);
    return { success: true };
  }

  static delete(id: number) {
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    return { success: true };
  }

  static toggleLike(postId: number, userId: number) {
    const existingLike = db.prepare("SELECT id FROM likes WHERE postId = ? AND userId = ?").get(postId, userId);
    
    if (existingLike) {
      db.prepare("DELETE FROM likes WHERE postId = ? AND userId = ?").run(postId, userId);
      return { liked: false };
    } else {
      db.prepare("INSERT INTO likes (postId, userId) VALUES (?, ?)").run(postId, userId);
      return { liked: true };
    }
  }

  static createReport(postId: number, reporterId: number, reason: string) {
    const existingPending = db
      .prepare("SELECT id FROM reports WHERE postId = ? AND reporterId = ? AND status = 'pending'")
      .get(postId, reporterId) as { id: number } | undefined;

    if (existingPending) {
      return { alreadyReported: true };
    }

    db.prepare("INSERT INTO reports (postId, reporterId, reason) VALUES (?, ?, ?)").run(postId, reporterId, reason);
    return { success: true };
  }
}
