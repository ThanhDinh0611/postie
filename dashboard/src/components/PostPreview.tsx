import type { PageData } from '../api.ts';

interface PostPreviewProps {
  content: string;
  isPublishing: boolean;
  onPublish: (finalContent: string) => void;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
  attachedImage: string | null;

  // Clipy Link Preview Props
  publishType: 'image' | 'link';
  linkTitle: string;
  setLinkTitle: (val: string) => void;
  linkDescription: string;
  setLinkDescription: (val: string) => void;
}

export default function PostPreview({
  content,
  isPublishing,
  onPublish,
  pages,
  selectedPageId,
  setSelectedPageId,
  attachedImage,
  publishType,
  linkTitle,
  setLinkTitle,
  linkDescription,
  setLinkDescription
}: PostPreviewProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert('📋 Đã sao chép nội dung vào khay nhớ tạm!');
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
        {/* Render attached image if present (acts as post image or link preview image) */}
        {attachedImage && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={attachedImage} alt="Attached preview" style={{ width: '100%', height: '100%', maxHeight: '200px', objectFit: 'cover' }} />
          </div>
        )}

        <div className="preview-body" style={{ flex: 1 }}>
          {content}
        </div>
      </div>

      {/* Clipy Link Preview review & edit panel */}
      {publishType === 'link' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            🔗 Xem trước & Sửa thẻ Link Preview (Clipy)
          </h4>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="linkTitle" style={{ fontSize: '0.78rem', fontWeight: 500 }}>Tiêu đề Link Card</label>
            <input
              type="text"
              id="linkTitle"
              className="form-control"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Tiêu đề hiển thị khi chia sẻ link"
              maxLength={100}
              disabled={isPublishing}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="linkDescription" style={{ fontSize: '0.78rem', fontWeight: 500 }}>Mô tả Link Card</label>
            <textarea
              id="linkDescription"
              className="form-control"
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              placeholder="Mô tả ngắn hiển thị dưới tiêu đề link"
              maxLength={200}
              rows={2}
              disabled={isPublishing}
            />
          </div>
        </div>
      )}

      {/* Publication controls */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
          onClick={() => onPublish(content)}
          disabled={isPublishing || pages.length === 0 || !selectedPageId}
        >
          {isPublishing ? '⏳ Đang đăng bài lên Facebook...' : 'Đăng lên Fanpage ngay 🚀'}
        </button>
      </div>
    </div>
  );
}
