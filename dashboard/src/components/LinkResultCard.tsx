interface LinkResultCardProps {
  permalink: string;
  facebookPostId: string;
  onReset: () => void;
}

export default function LinkResultCard({ permalink, facebookPostId, onReset }: LinkResultCardProps) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(permalink);
    alert('📋 Đã sao chép liên kết bài viết!');
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
      <span style={{ fontSize: '3rem' }}>🎉</span>
      <h2 style={{ color: 'var(--success)', fontSize: '1.4rem' }}>Đăng bài thành công!</h2>
      <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto' }}>
        Bài viết của bạn đã được xuất bản lên Facebook thành công. Liên kết bài viết và mã ID bài viết đã sẵn sàng.
      </p>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'left', wordBreak: 'break-all', fontSize: '0.88rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>ID bài viết:</strong> <code style={{ color: 'var(--accent)' }}>{facebookPostId}</code>
        </div>
        <div>
          <strong>Link bài viết:</strong> <a href={permalink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{permalink}</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
        <button className="btn" onClick={handleCopyLink}>
          📋 Copy Link
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
