import { useState } from 'react';
import type { CampaignData } from '@/api/types.ts';
import FileAttachment from '@/components/FileAttachment.tsx';

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

export const REEL_DURATION_OPTIONS = [
  { value: 10, label: '10 giây' },
  { value: 15, label: '15 giây' },
  { value: 30, label: '30 giây' },
  { value: 60, label: '60 giây' },
  { value: 90, label: '90 giây' },
];

interface PostGeneratorProps {
  campaigns?: CampaignData[];
  onGenerate: (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
    campaignId?: string;
    publishType: 'image' | 'link';
    targetUrl: string;
    reelDuration?: number;
  }) => void;
  isGenerating: boolean;

  attachedFile: File | null;
  attachedImage: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;

  publishType: 'image' | 'link';
  setPublishType: (type: 'image' | 'link') => void;
}

export default function PostGenerator({
  campaigns = [],
  onGenerate,
  isGenerating,
  attachedFile,
  attachedImage,
  onImageSelect,
  onImageRemove,
  publishType,
  setPublishType
}: PostGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState('1. Sự thật thú vị (Interesting fact)');
  const [formula, setFormula] = useState('PAS (Problem-Agitation-Solution)');
  const [tone, setTone] = useState('Friendly');
  const [postFormat, setPostFormat] = useState<'Post' | 'Reel' | 'Video'>('Post');
  const [campaignId, setCampaignId] = useState('');
  const [targetUrl, setTargetUrl] = useState('https://google.com');
  const [reelDuration, setReelDuration] = useState(30);

  const isReel = postFormat === 'Reel';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({
      topic,
      hookType,
      formula,
      tone,
      postFormat,
      campaignId: campaignId || undefined,
      publishType: isReel ? 'image' : publishType,
      targetUrl,
      reelDuration: isReel ? reelDuration : undefined,
    });
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold" style={{ marginBottom: '1.25rem' }}>⚙️ Cấu hình nội dung AI</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="topic">Chủ đề {isReel ? 'Reel' : 'bài viết'}</label>
          <textarea
            id="topic"
            className="form-control"
            placeholder={isReel
              ? 'Ví dụ: Review quán cafe mới mở, một ngày làm việc của barista, mẹo pha cà phê tại nhà...'
              : 'Ví dụ: Giới thiệu quán cafe acoustic mới mở tại quận 1, phong cách ấm cúng, phù hợp cho cặp đôi...'}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            required
          />
        </div>

        {!isReel && (
          <div className="flex" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
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
        )}

        {!isReel && publishType === 'link' && (
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

        <div className="flex" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

          {isReel ? (
            <div className="form-group">
              <label htmlFor="reelDuration">Thời lượng Reel</label>
              <select
                id="reelDuration"
                className="form-control"
                value={reelDuration}
                onChange={(e) => setReelDuration(Number(e.target.value))}
                disabled={isGenerating}
              >
                {REEL_DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          ) : (
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
          )}
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

        {!isReel && (
          <FileAttachment
            attachedFile={attachedFile}
            attachedImage={attachedImage}
            onImageSelect={onImageSelect}
            onImageRemove={onImageRemove}
            isGenerating={isGenerating}
            publishType={publishType}
          />
        )}

        <button
          type="submit"
          className="btn btn-primary w-full justify-center"
          style={{ marginTop: '1.25rem', padding: '0.75rem' }}
          disabled={isGenerating || !topic.trim()}
        >
          {isGenerating
            ? '⏳ Đang tạo nội dung AI...'
            : isReel
              ? 'Tạo kịch bản Reel 🎬'
              : 'Tạo bài viết với AI 🤖'}
        </button>
      </form>
    </div>
  );
}
