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

    const publicUrl = `${c.env.R2_PUBLIC_URL}/${fileName}`;
    return c.json({ image_url: publicUrl, fileName });
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
    const images = objects.objects.map((obj) => ({
      fileName: obj.key,
      url: `${c.env.R2_PUBLIC_URL}/${obj.key}`,
      uploadedAt: obj.uploaded,
      size: obj.size,
    }));
    return c.json(images);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to list images' }, 500);
  }
});
