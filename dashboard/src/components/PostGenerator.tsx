import { useState } from 'react';

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
  onGenerate: (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
  }) => void;
  isGenerating: boolean;
}

export default function PostGenerator({ onGenerate, isGenerating }: PostGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState(HOOK_OPTIONS[0]!);
  const [formula, setFormula] = useState(FORMULA_OPTIONS[0]!);
  const [tone, setTone] = useState(TONE_OPTIONS[0]!);
  const [postFormat, setPostFormat] = useState<'Post' | 'Reel' | 'Video'>('Post');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({ topic, hookType, formula, tone, postFormat });
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="postFormat">Định dạng</label>
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

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
          disabled={isGenerating || !topic.trim()}
        >
          {isGenerating ? '⏳ Đang tạo nội dung AI...' : 'Tạo bài viết với AI 🤖'}
        </button>
      </form>
    </div>
  );
}
