import type { PageData } from '@/api/types.ts';
import { useToast } from '@/hooks/useToast.tsx';

interface PostPreviewProps {
  content: string;
  isPublishing: boolean;
  onPublish: (finalContent: string) => void;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
  attachedImage: string | null;

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
  const { addToast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    addToast('Đã sao chép nội dung vào khay nhớ tạm! 📋', 'success');
  };

  return (
    <div className="preview-card">
      <div className="preview-header">
        <h3 className="text-lg font-semibold">📝 Nội dung bài viết</h3>
        <button className="btn btn-sm" onClick={handleCopy}>
          📋 Sao chép
        </button>
      </div>

      <div className="flex-1 flex-col gap-12" style={{ display: 'flex' }}>
        {attachedImage && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={attachedImage} alt="Attached preview" loading="lazy" style={{ width: '100%', height: '100%', maxHeight: '200px', objectFit: 'cover' }} />
          </div>
        )}

        <div className="preview-body flex-1">
          {content}
        </div>
      </div>

      {publishType === 'link' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }} className="flex-col gap-12">
          <h4 className="text-base font-semibold text-accent flex items-center gap-6">
            🔗 Xem trước & Sửa thẻ Link Preview (Clipy)
          </h4>
          
          <div className="form-group mb-0">
            <label htmlFor="linkTitle" className="text-sm font-medium">Tiêu đề Link Card</label>
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

          <div className="form-group mb-0">
            <label htmlFor="linkDescription" className="text-sm font-medium">Mô tả Link Card</label>
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

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }} className="flex-col gap-12">
        <div className="form-group mb-0">
          <label className="font-semibold">📢 Chọn Fanpage đăng bài</label>
          {pages.length === 0 ? (
            <div className="text-muted text-base" style={{ marginTop: '0.25rem' }}>
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
          className="btn btn-primary w-full justify-center"
          style={{ padding: '0.75rem' }}
          onClick={() => onPublish(content)}
          disabled={isPublishing || pages.length === 0 || !selectedPageId || !content.trim()}
        >
          {isPublishing ? '⏳ Đang đăng bài lên Facebook...' : 'Đăng lên Fanpage ngay 🚀'}
        </button>
      </div>
    </div>
  );
}
