export interface PageRow {
  id: string;
  facebook_page_id: string;
  name: string;
  username: string | null;
  access_token: string;
  avatar_url: string | null;
  is_active: number;
  user_id: string;
}

export interface PageAnalysisRow {
  id: string;
  page_id: string;
  user_id: string;
  analyzed_at: number;
  summary: string;
  writing_style: string;
  suggestions: string;
  charts_data: string;
  metrics_summary: string;
}

export class PageRepository {
  static async getPagesByUser(db: D1Database, userId: string): Promise<PageRow[]> {
    const rows = await db
      .prepare('SELECT id, facebook_page_id, name, username, avatar_url, is_active, user_id FROM pages WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<PageRow>();
    return rows.results ?? [];
  }

  static async getPagesByUserWithTokens(db: D1Database, userId: string): Promise<PageRow[]> {
    const rows = await db
      .prepare('SELECT id, facebook_page_id, name, username, access_token, avatar_url, is_active, user_id FROM pages WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<PageRow>();
    return rows.results ?? [];
  }

  static async findPageByIdAndUser(db: D1Database, pageId: string, userId: string): Promise<PageRow | null> {
    return db
      .prepare('SELECT id, facebook_page_id, name, username, access_token, avatar_url, is_active, user_id FROM pages WHERE id = ? AND user_id = ?')
      .bind(pageId, userId)
      .first<PageRow>();
  }

  static async findActivePageByUser(db: D1Database, userId: string): Promise<PageRow | null> {
    return db
      .prepare('SELECT id, facebook_page_id, name, username, access_token, avatar_url, is_active, user_id FROM pages WHERE user_id = ? AND is_active = 1')
      .bind(userId)
      .first<PageRow>();
  }

  static async deletePage(db: D1Database, pageId: string, userId: string): Promise<boolean> {
    const res = await db.prepare('DELETE FROM pages WHERE id = ? AND user_id = ?').bind(pageId, userId).run();
    return res.meta.changes > 0;
  }

  static async setActivePage(db: D1Database, userId: string, pageId: string): Promise<void> {
    await db.batch([
      db.prepare('UPDATE pages SET is_active = 0 WHERE user_id = ?').bind(userId),
      db.prepare('UPDATE pages SET is_active = 1 WHERE id = ?').bind(pageId)
    ]);
  }

  static async saveOAuthPages(
    db: D1Database,
    userId: string,
    fbPages: Array<{ id: string; name: string; username?: string; access_token: string; picture?: { data: { url: string } } }>
  ): Promise<Array<{ id: string; name: string; username?: string; avatarUrl?: string }>> {
    const saved: Array<{ id: string; name: string; username?: string; avatarUrl?: string }> = [];

    for (const page of fbPages) {
      const avatarUrl = page.picture?.data?.url ?? null;

      const existing = await db
        .prepare('SELECT id, user_id FROM pages WHERE facebook_page_id = ?')
        .bind(page.id)
        .first<{ id: string; user_id: string }>();

      if (existing) {
        await db
          .prepare('UPDATE pages SET name = ?, username = ?, access_token = ?, avatar_url = ?, user_id = ? WHERE id = ?')
          .bind(page.name, page.username ?? null, page.access_token, avatarUrl, userId, existing.id)
          .run();
        saved.push({ id: existing.id, name: page.name, username: page.username, avatarUrl: avatarUrl ?? undefined });
      } else {
        const newId = crypto.randomUUID();
        await db
          .prepare('INSERT INTO pages (id, facebook_page_id, name, username, access_token, avatar_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(newId, page.id, page.name, page.username ?? null, page.access_token, avatarUrl, userId)
          .run();
        saved.push({ id: newId, name: page.name, username: page.username, avatarUrl: avatarUrl ?? undefined });
      }
    }

    return saved;
  }

  static async getLatestAnalysis(db: D1Database, pageId: string, userId: string): Promise<PageAnalysisRow | null> {
    return db
      .prepare('SELECT * FROM page_analyses WHERE page_id = ? AND user_id = ? ORDER BY analyzed_at DESC LIMIT 1')
      .bind(pageId, userId)
      .first<PageAnalysisRow>();
  }

  static async insertAnalysis(
    db: D1Database,
    analysis: Omit<PageAnalysisRow, 'analyzed_at'>
  ): Promise<void> {
    await db
      .prepare(`
        INSERT INTO page_analyses (id, page_id, user_id, summary, writing_style, suggestions, charts_data, metrics_summary, analyzed_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `)
      .bind(
        analysis.id,
        analysis.page_id,
        analysis.user_id,
        analysis.summary,
        analysis.writing_style,
        analysis.suggestions,
        analysis.charts_data,
        analysis.metrics_summary
      )
      .run();
  }
}
