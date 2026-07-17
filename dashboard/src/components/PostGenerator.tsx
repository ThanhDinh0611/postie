import type { CampaignData } from '../api.ts';

export const HOOK_OPTIONS = [
  '1. Sự thật thú vị (Interesting fact)',
  '2. Câu chuyện hấp dẫn (Story - STAR model)',
  '3. Câu hỏi kích thích tư duy (Thought-provoking question)',
  '4. Hot trend (Trending topic)',
  '5. Số liệu cụ thể (Specific numbers)',
  '6. Thông tin thiếu (Incomplete info / curiosity)',
  '7. Bí mật / Bí quyết (Secret / Tip)',
  '8. Tuyên bố gây sốc (Shocking statement)',
  '9. Nếu... thì... (If... then...)',
  '10. Hậu trường (Behind-the-scenes)'
];

export const FORMULA_OPTIONS = [
  'PAS (Problem-Agitation-Solution)',
  'AIDA (Attention-Interest-Desire-Action)',
  'FAB (Features-Advantages-Benefits)',
  'ABC Checklist'
];

export const TONE_OPTIONS = ['Friendly', 'Professional', 'Humorous', 'Curious', 'Formal'];

interface PostGeneratorProps {
  campaigns?: CampaignData[];
  onGenerate: (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
    campaignId?: string;
  }) => void;
  isGenerating: boolean;

  // Persisted Draft Props
  topic: string;
  setTopic: (val: string) => void;
  hookType: string;
  setHookType: (val: string) => void;
  formula: string;
  setFormula: (val: string) => void;
  tone: string;
  setTone: (val: string) => void;
  postFormat: 'Post' | 'Reel' | 'Video';
  setPostFormat: (val: 'Post' | 'Reel' | 'Video') => void;
  campaignId: string;
  setCampaignId: (val: string) => void;

  // Publish Format & File Props
  publishType: 'image' | 'link';
  setPublishType: (val: 'image' | 'link') => void;
  targetUrl: string;
  setTargetUrl: (val: string) => void;
  attachedFile: File | null;
  setAttachedFile: (file: File | null) => void;
  attachedImage: string | null;
  setAttachedImage: (url: string | null) => void;
  onImageSelect: (file: File) => void;
}

export default function PostGenerator({
  campaigns = [],
  onGenerate,
  isGenerating,
  topic,
  setTopic,
  hookType,
  setHookType,
  formula,
  setFormula,
  tone,
  setTone,
  postFormat,
  setPostFormat,
  campaignId,
  setCampaignId,
  publishType,
  setPublishType,
  targetUrl,
  setTargetUrl,
  attachedFile,
  setAttachedFile,
  attachedImage,
  setAttachedImage,
  onImageSelect
}: PostGeneratorProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({
      topic,
      hookType,
      formula,
      tone,
      postFormat,
      campaignId: campaignId || undefined
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setAttachedFile(null);
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 600 }}>⚙️ Cấu hình nội dung AI</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="topic">Chủ đề bài viết</label>
          <textarea
            id="topic"
            className="form-control"
            placeholder="Ví dụ: Giới thiệu quán cafe acoustic mới mở tại quận 1, phong cách ấm cúng, phù hợp cho cặp đôi..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            required
          />
        </div>

        {/* Publish Type selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="publishType">Định dạng xuất bản</label>
            <select
              id="publishType"
              className="form-control"
              value={publishType}
              onChange={(e) => setPublishType(e.target.value as 'image' | 'link')}
              disabled={isGenerating}
            >
              <option value="image">🖼️ Đăng kèm hình ảnh (Image)</option>
              <option value="link">🔗 Đăng kèm link Clipy (Link)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tone">Giọng điệu (Tone)</label>
            <select
              id="tone"
              className="form-control"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={isGenerating}
            >
              {TONE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Target URL - Only visible for Link Post */}
        {publishType === 'link' && (
          <div className="form-group">
            <label htmlFor="targetUrl">Link đích (Destination URL)</label>
            <input
              type="url"
              id="targetUrl"
              className="form-control"
              placeholder="Ví dụ: https://my-website.com/product"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isGenerating}
              required={publishType === 'link'}
            />
          </div>
        )}

        {/* Campaign selector */}
        <div className="form-group">
          <label htmlFor="campaign">Chiến dịch tiếp thị (Campaign)</label>
          <select
            id="campaign"
            className="form-control"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={isGenerating}
          >
            <option value="">-- Không chọn chiến dịch --</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="postFormat">Định dạng bài viết</label>
            <select
              id="postFormat"
              className="form-control"
              value={postFormat}
              onChange={(e) => setPostFormat(e.target.value as 'Post' | 'Reel' | 'Video')}
              disabled={isGenerating}
            >
              <option value="Post">Bài đăng (Facebook Post)</option>
              <option value="Reel">Phim ngắn (Facebook Reel)</option>
              <option value="Video">Video dài</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="formula">Công thức viết bài</label>
            <select
              id="formula"
              className="form-control"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              disabled={isGenerating}
            >
              {FORMULA_OPTIONS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="hookType">Loại Hook (Dẫn dắt)</label>
          <select
            id="hookType"
            className="form-control"
            value={hookType}
            onChange={(e) => setHookType(e.target.value)}
            disabled={isGenerating}
          >
            {HOOK_OPTIONS.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        {/* Image Attachment */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              🖼️ Đính kèm hình ảnh {publishType === 'link' ? '(để tạo Link Preview Card)' : ''}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="file"
                accept="image/*"
                id="image-attachment-generator"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isGenerating}
              />
              <label
                htmlFor="image-attachment-generator"
                className="btn btn-sm"
                style={{
                  cursor: 'pointer', background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)', display: 'inline-flex',
                  alignItems: 'center', gap: '0.35rem', pointerEvents: isGenerating ? 'none' : 'auto',
                  opacity: isGenerating ? 0.6 : 1
                }}
              >
                📁 Chọn ảnh từ thiết bị
              </label>
              {attachedFile && (
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Đã đính kèm ảnh</span>
              )}
            </div>
            {attachedImage && (
              <div style={{ position: 'relative', width: '100%', maxHeight: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', marginTop: '0.65rem' }}>
                <img src={attachedImage} alt="Preview" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  style={{
                    position: 'absolute', top: '0.25rem', right: '0.25rem',
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                    fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1
                  }}
                  title="Gỡ ảnh"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem', padding: '0.75rem' }}
          disabled={isGenerating || !topic.trim()}
        >
          {isGenerating ? '⏳ Đang tạo nội dung AI...' : 'Tạo bài viết với AI 🤖'}
        </button>
      </form>
    </div>
  );
}
