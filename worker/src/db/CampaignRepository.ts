export interface CampaignRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  created_at: number;
}

export class CampaignRepository {
  static async getCampaignsByUser(db: D1Database, userId: string): Promise<CampaignRow[]> {
    const res = await db
      .prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<CampaignRow>();
    return res.results ?? [];
  }

  static async findCampaignByIdAndUser(db: D1Database, id: string, userId: string): Promise<CampaignRow | null> {
    return db
      .prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first<CampaignRow>();
  }

  static async createCampaign(
    db: D1Database,
    id: string,
    userId: string,
    title: string,
    description: string | null,
    color: string
  ): Promise<void> {
    await db
      .prepare('INSERT INTO campaigns (id, user_id, title, description, color) VALUES (?, ?, ?, ?, ?)')
      .bind(id, userId, title, description, color)
      .run();
  }

  static async updateCampaign(
    db: D1Database,
    id: string,
    userId: string,
    fields: { title?: string; description?: string | null; color?: string }
  ): Promise<boolean> {
    const updates: string[] = [];
    const binds: unknown[] = [];

    if (fields.title !== undefined) {
      updates.push('title = ?');
      binds.push(fields.title);
    }
    if (fields.description !== undefined) {
      updates.push('description = ?');
      binds.push(fields.description);
    }
    if (fields.color !== undefined) {
      updates.push('color = ?');
      binds.push(fields.color);
    }

    if (updates.length === 0) return false;

    binds.push(id, userId);
    const res = await db
      .prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...binds)
      .run();
    return res.meta.changes > 0;
  }

  static async deleteCampaign(db: D1Database, id: string, userId: string): Promise<boolean> {
    const res = await db
      .prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();
    return res.meta.changes > 0;
  }
}
