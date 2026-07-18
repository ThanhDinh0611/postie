export class ClipyService {
  static async generateShortLink(
    env: { CLIPY_API_KEY?: string; CLIPY_API_URL?: string },
    targetUrl: string,
    title: string,
    description: string,
    imageUrl?: string
  ): Promise<string> {
    if (!env.CLIPY_API_KEY) {
      throw new Error('Lỗi cấu hình hệ thống: CLIPY_API_KEY chưa được khai báo trên Worker.');
    }
    const clipyUrl = env.CLIPY_API_URL || 'https://clipy-worker.dct98.workers.dev/api';
    
    try {
      const linkRes = await fetch(`${clipyUrl}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CLIPY_API_KEY}`
        },
        body: JSON.stringify({
          target_url: targetUrl,
          title: title,
          description: description,
          image_url: imageUrl || ''
        })
      });

      if (!linkRes.ok) {
        const errText = await linkRes.text();
        throw new Error(`Clipy API Error (${linkRes.status}): ${errText}`);
      }

      const linkData = await linkRes.json() as { short_code: string };
      const baseRedirectUrl = clipyUrl.replace(/\/api$/, '');
      return `${baseRedirectUrl}/${linkData.short_code}`;
    } catch (e) {
      throw new Error(`Lỗi kết nối Clipy API: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
