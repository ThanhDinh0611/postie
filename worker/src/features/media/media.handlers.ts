import { Hono } from 'hono';
import { getUserIdFromRequest } from '../../core/auth.ts';

export const mediaRouter = new Hono<{ Bindings: Env }>();

// POST /api/media/upload — Upload an image to R2 bucket
mediaRouter.post('/media/upload', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return c.json({ error: 'No image file provided' }, 400);

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }, 400);
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File too large. Max 10MB' }, 400);
  }

  try {
    const ext = file.type.split('/')[1] ?? 'jpg';
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    await c.env.IMAGES.put(fileName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { userId },
    });

    const baseUrl = c.env.R2_PUBLIC_URL ? c.env.R2_PUBLIC_URL.replace(/\/$/, '') : `${new URL(c.req.url).origin}/media/file`;
    const publicUrl = `${baseUrl}/${fileName}`;
    return c.json({ image_url: publicUrl, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Upload failed' }, 500);
  }
});

// POST /api/media/upload-video — Upload a video to R2 bucket for Reels
mediaRouter.post('/media/upload-video', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData();
  const file = formData.get('video') as File | null;
  if (!file) return c.json({ error: 'No video file provided' }, 400);

  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: MP4, MOV, AVI, WMV' }, 400);
  }

  // Validate file size (max 1GB)
  if (file.size > 1024 * 1024 * 1024) {
    return c.json({ error: 'File too large. Max 1GB' }, 400);
  }

  try {
    const ext = file.type.split('/')[1] ?? 'mp4';
    const fileName = `${userId}/videos/${crypto.randomUUID()}.${ext}`;

    await c.env.IMAGES.put(fileName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { userId },
    });

    const baseUrl = c.env.R2_PUBLIC_URL ? c.env.R2_PUBLIC_URL.replace(/\/$/, '') : `${new URL(c.req.url).origin}/media/file`;
    const publicUrl = `${baseUrl}/${fileName}`;
    return c.json({ video_url: publicUrl, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Upload failed' }, 500);
  }
});

// GET /api/media — List user's uploaded images
mediaRouter.get('/media', async (c) => {
  const userId = await getUserIdFromRequest(c.req.raw, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const objects = await c.env.IMAGES.list({ prefix: `${userId}/` });
    const baseUrl = c.env.R2_PUBLIC_URL ? c.env.R2_PUBLIC_URL.replace(/\/$/, '') : `${new URL(c.req.url).origin}/media/file`;
    const images = objects.objects.map((obj) => ({
      fileName: obj.key,
      url: `${baseUrl}/${obj.key}`,
      uploadedAt: obj.uploaded,
      size: obj.size,
    }));
    return c.json(images);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to list images' }, 500);
  }
});
