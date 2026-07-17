// ─── Constants ────────────────────────────────────────────────────────────

/** Maximum image dimension (width or height) for compression */
const MAX_IMAGE_DIM = 1200;
/** Target max file size in bytes after pre-compression (~300KB) */
const TARGET_MAX_SIZE = 300 * 1024;
/** Fallback quality for pre-compression pass */
const COMPRESS_QUALITY = 0.8;

// ─── Functions ────────────────────────────────────────────────────────────

/**
 * Compress an image file client‑side to reduce upload size and storage cost.
 * Resizes if either dimension exceeds MAX_IMAGE_DIM, and re‑encodes as JPEG
 * with a quality reduction step to stay <= TARGET_MAX_SIZE.
 */
export async function compressImage(file: File): Promise<File> {
  // Read the file as a data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Load into an Image element
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  // Calculate new dimensions while maintaining aspect ratio
  let { width, height } = img;
  if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
    const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Draw onto a canvas (always re-encode to strip EXIF / unnecessary metadata)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob with specific quality
  const toBlob = (quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        quality,
      );
    });

  let quality = COMPRESS_QUALITY;
  let blob = await toBlob(quality);

  // If still too large, reduce quality iteratively
  while (blob.size > TARGET_MAX_SIZE && quality > 0.3) {
    quality = Math.max(0.3, quality - 0.1);
    blob = await toBlob(quality);
  }

  // Preserve original name but with .jpg extension
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
