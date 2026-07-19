import { useState } from 'react';

interface LinkResultCardProps {
  permalink: string;
  facebookPostId: string;
  onReset: () => void;
}

export default function LinkResultCard({ permalink, facebookPostId, onReset }: LinkResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(permalink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(facebookPostId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="card text-center flex-col gap-20" style={{ borderColor: 'var(--success)', padding: '2rem', marginTop: '1.5rem' }}>
      <span style={{ fontSize: '3rem' }}>🎉</span>
      <h2 className="text-success" style={{ fontSize: '1.4rem' }}>Đăng bài thành công!</h2>
      <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto' }}>
        Bài viết của bạn đã được xuất bản lên Facebook thành công. Liên kết bài viết và mã ID bài viết đã sẵn sàng.
      </p>

      <div className="card-sm" style={{ textAlign: 'left', wordBreak: 'break-all', fontSize: '0.88rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>ID bài viết:</strong> <code className="text-accent">{facebookPostId}</code>
        </div>
        <div>
          <strong>Link bài viết:</strong> <a href={permalink} target="_blank" rel="noopener noreferrer" className="text-accent" style={{ textDecoration: 'underline' }}>{permalink}</a>
        </div>
      </div>

      <div className="flex justify-center gap-12 flex-wrap" style={{ marginTop: '0.5rem' }}>
        <button className="btn" onClick={handleCopyLink} style={copied ? { borderColor: 'var(--success)' } : {}}>
          {copied ? '✅ Đã copy' : '📋 Copy Link'}
        </button>
        <button className="btn" onClick={handleCopyId} style={copiedId ? { borderColor: 'var(--success)' } : {}}>
          {copiedId ? '✅ Đã copy' : '🆔 Copy ID'}
        </button>
        <a href={permalink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          🔗 Xem trên Facebook
        </a>
        <button className="btn" onClick={onReset} style={{ border: '1px solid var(--border)' }}>
          ✍️ Viết bài mới
        </button>
      </div>
    </div>
  );
}
