import type { ReelScriptSegment, PageData } from '@/api/types.ts';
import { REEL_CATEGORIES } from '@/api/types.ts';

interface ReelPreviewProps {
  caption: string;
  scriptSegments: ReelScriptSegment[];
  reelDuration?: number;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  onVideoSelect: (file: File) => void;
  onVideoRemove: () => void;
  isPublishing: boolean;
  onPublish: () => void;
  publishProgress: string;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
  contentCategory: string;
  setContentCategory: (cat: string) => void;
}

export default function ReelPreview({
  caption,
  scriptSegments,
  reelDuration,
  videoFile,
  videoPreviewUrl,
  onVideoSelect,
  onVideoRemove,
  isPublishing,
  onPublish,
  publishProgress,
  pages,
  selectedPageId,
  setSelectedPageId,
  contentCategory,
  setContentCategory,
}: ReelPreviewProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onVideoSelect(file);
  };

  return (
    <div className="preview-card">
      <div className="preview-header">
        <h3 className="text-lg font-semibold">🎬 Kịch bản Reel</h3>
        {reelDuration && (
          <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
            {reelDuration} giây
          </span>
        )}
      </div>

      <div className="flex-col gap-12" style={{ display: 'flex' }}>
        <div className="card-sm" style={{ background: 'var(--bg-secondary)' }}>
          <span className="text-muted text-sm font-semibold">CAPTION</span>
          <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{caption}</p>
        </div>

        <div>
          <span className="text-muted text-sm font-semibold">PHÂN CẢNH</span>
          <div className="flex-col gap-8" style={{ display: 'flex', marginTop: '0.5rem' }}>
            {scriptSegments.map((seg, i) => (
              <div
                key={i}
                className="flex gap-12"
                style={{
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: i % 2 === 0 ? 'var(--bg-secondary)' : 'transparent',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center font-bold"
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--accent)', color: '#000', fontSize: '0.8rem',
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 flex-col gap-4" style={{ display: 'flex' }}>
                  <div className="text-sm">
                    <span className="text-muted">👁️ Visual:</span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{seg.visual}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted">🎙️ Voiceover:</span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{seg.voiceover}</span>
                  </div>
                  <div className="text-xs text-muted">{seg.durationSec} giây</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <label className="text-base font-semibold text-secondary" style={{ display: 'block', marginBottom: '0.4rem' }}>
            🎥 Tải lên video
          </label>
          <div className="flex items-center gap-12">
            <input
              type="file"
              accept="video/mp4,video/quicktime"
              id="video-upload"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isPublishing}
            />
            <label
              htmlFor="video-upload"
              className="btn btn-sm"
              style={{
                cursor: 'pointer', background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)', display: 'inline-flex',
                alignItems: 'center', gap: '0.35rem',
                pointerEvents: isPublishing ? 'none' : 'auto',
                opacity: isPublishing ? 0.6 : 1,
              }}
            >
              📁 Chọn video MP4
            </label>
            {videoFile && (
              <span className="text-sm text-success">✓ {videoFile.name}</span>
            )}
          </div>
          {videoPreviewUrl && (
            <div style={{ marginTop: '0.65rem' }}>
              <video
                src={videoPreviewUrl}
                controls
                style={{ width: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)' }}
              />
              <button
                className="btn btn-sm"
                onClick={onVideoRemove}
                disabled={isPublishing}
                style={{ marginTop: '0.35rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                ✕ Gỡ video
              </button>
            </div>
          )}
        </div>
      </div>

      {publishProgress && (
        <div className="flex items-center justify-center gap-8 text-base font-semibold"
          style={{
            background: 'var(--accent-light)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)', padding: '0.75rem',
            color: 'var(--accent)', marginTop: '1rem',
          }}>
          <span className="spinner-mini" />
          {publishProgress}
        </div>
      )}

      <div className="form-group mb-0">
        <label className="font-semibold">📂 Thể loại Reel</label>
        <select
          className="form-control"
          value={contentCategory}
          onChange={(e) => setContentCategory(e.target.value)}
          disabled={isPublishing}
        >
          {REEL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }} className="flex-col gap-12">
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
          onClick={onPublish}
          disabled={isPublishing || !videoFile || !caption || !selectedPageId}
        >
          {isPublishing ? '⏳ Đang đăng Reel...' : 'Đăng Reel lên Fanpage 🎬'}
        </button>
      </div>
    </div>
  );
}
