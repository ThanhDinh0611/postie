import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { uploadImage, type PageData } from '../api.ts';

interface PostPreviewProps {
  content: string;
  isPublishing: boolean;
  onPublish: (finalContent: string, mediaUrl?: string) => void;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
}

export default function PostPreview({
  content,
  isPublishing,
  onPublish,
  pages,
  selectedPageId,
  setSelectedPageId,
}: PostPreviewProps) {
  const { getToken } = useAuth();
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert('📋 Đã sao chép nội dung vào khay nhớ tạm!');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      
      const res = await uploadImage(file, token);
      setAttachedImage(res.image_url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Tải ảnh lên thất bại');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
  };

  return (
    <div className="preview-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="preview-header">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>📝 Nội dung bài viết</h3>
        <button className="btn btn-sm" onClick={handleCopy}>
          📋 Sao chép
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Render attached image if present */}
        {attachedImage && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={attachedImage} alt="Attached" style={{ width: '100%', height: '100%', maxHeight: '200px', objectFit: 'cover' }} />
            <button
              onClick={handleRemoveImage}
              style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1
              }}
              title="Gỡ ảnh"
            >
              ✕
            </button>
          </div>
        )}

        <div className="preview-body" style={{ flex: 1 }}>
          {content}
        </div>
      </div>

      {/* Image attachment controls */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
            🖼️ Đính kèm hình ảnh (R2 Storage)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="file"
              accept="image/*"
              id="image-attachment"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
              disabled={isUploading || isPublishing}
            />
            <label
              htmlFor="image-attachment"
              className="btn btn-sm"
              style={{
                cursor: 'pointer', background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)', display: 'inline-flex',
                alignItems: 'center', gap: '0.35rem', pointerEvents: isUploading || isPublishing ? 'none' : 'auto',
                opacity: isUploading || isPublishing ? 0.6 : 1
              }}
            >
              {isUploading ? '⏳ Đang tải lên...' : '📁 Chọn ảnh từ thiết bị'}
            </label>
            {attachedImage && (
              <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Đã đính kèm ảnh</span>
            )}
          </div>
          {uploadError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem' }}>⚠️ {uploadError}</div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="publishPage" style={{ fontWeight: 600 }}>📢 Chọn Fanpage đăng bài</label>
          {pages.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Chưa có trang Facebook nào được kết nối. Vui lòng kết nối trang trong tab <a href="/pages">Trang Facebook</a>.
            </div>
          ) : (
            <select
              id="publishPage"
              className="form-control"
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              disabled={isPublishing}
            >
              <option value="">-- Chọn một Fanpage đã kết nối --</option>
              {pages.map(page => (
                <option key={page.id} value={page.id}>
                  {page.name} ({page.username ? `@${page.username}` : page.facebook_page_id}) {page.is_active ? '★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          onClick={() => onPublish(content, attachedImage || undefined)}
          disabled={isPublishing || isUploading || pages.length === 0 || !selectedPageId}
        >
          {isPublishing ? '⏳ Đang đăng bài lên Facebook...' : 'Đăng lên Fanpage ngay 🚀'}
        </button>
      </div>
    </div>
  );
}
