import { useState } from 'react';
import { type PageData } from '../api.ts';

interface PostPreviewProps {
  content: string;
  variants: string[];
  isPublishing: boolean;
  onPublish: (finalContent: string) => void;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
}

export default function PostPreview({
  content,
  variants,
  isPublishing,
  onPublish,
  pages,
  selectedPageId,
  setSelectedPageId,
}: PostPreviewProps) {
  // Deduplicate and filter empty variants
  const allVariants = Array.from(new Set([content, ...variants].map(v => v.trim()).filter(Boolean)));
  const [activeTab, setActiveTab] = useState(0);

  const activeContent = allVariants[activeTab] ?? content;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    alert('📋 Đã sao chép nội dung vào khay nhớ tạm!');
  };

  return (
    <div className="preview-card">
      <div className="preview-header">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>📝 Nội dung bài viết</h3>
        <button className="btn btn-sm" onClick={handleCopy}>
          📋 Sao chép
        </button>
      </div>

      {allVariants.length > 1 && (
        <div className="tab-list">
          {allVariants.map((_, idx) => (
            <button
              key={idx}
              className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
            >
              {idx === 0 ? 'Bản gốc' : `Biến thể ${idx}`}
            </button>
          ))}
        </div>
      )}

      <div className="preview-body">
        {activeContent}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: 'auto' }}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
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
          onClick={() => onPublish(activeContent)}
          disabled={isPublishing || pages.length === 0 || !selectedPageId}
        >
          {isPublishing ? '⏳ Đang đăng bài lên Facebook...' : 'Đăng lên Fanpage ngay 🚀'}
        </button>
      </div>
    </div>
  );
}
