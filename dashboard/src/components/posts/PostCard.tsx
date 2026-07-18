import { useState } from 'react';
import type { PostData } from '../../api.ts';
import { usePosts } from '../../hooks/usePosts.ts';
import { useToast } from '../../hooks/useToast.tsx';
import CommentsSection from './CommentsSection.tsx';

interface PostCardProps {
  post: PostData;
  onRefresh?: () => void;
}

export default function PostCard({ post, onRefresh }: PostCardProps) {
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const { deletePostMutation } = usePosts();

  const handleCopyLink = async () => {
    if (!post.permalink) return;
    try {
      await navigator.clipboard.writeText(post.permalink);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      addToast('📋 Đã sao chép liên kết vào khay nhớ tạm!', 'success');
    } catch {
      addToast('Không thể sao chép liên kết.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này khỏi Facebook và cơ sở dữ liệu không?')) return;
    try {
      await deletePostMutation.mutateAsync(post.id);
      addToast('Đã xóa bài viết thành công!', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      addToast(`Lỗi xóa bài viết: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const formatNumber = (n?: number): string => {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return '---';
    return new Date(ts * 1000).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { Published: '#22c55e', Scheduled: '#f59e0b', Draft: '#64748b', Failed: '#ef4444' };
    const bgColors: Record<string, string> = { Published: 'rgba(34,197,94,0.12)', Scheduled: 'rgba(245,158,11,0.12)', Draft: 'rgba(100,116,139,0.12)', Failed: 'rgba(239,68,68,0.12)' };
    const labels: Record<string, string> = { Published: 'Đã đăng', Scheduled: 'Lên lịch', Draft: 'Bản nháp', Failed: 'Lỗi' };
    return (
      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: colors[status] ?? '#64748b', background: bgColors[status] ?? 'rgba(100,116,139,0.12)' }}>
        {labels[status] ?? status}
      </span>
    );
  };

  const isDeleting = deletePostMutation.isPending;

  return (
    <div className="link-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="link-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.5' }}>
            {post.message}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {getStatusBadge(post.status)}
          {post.post_format && post.post_format !== 'Post' ? (
            <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
              {post.post_format}
            </span>
          ) : null}
        </div>
      </div>

      {/* Campaign & Engagement Metrics Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {post.page_name ?? 'Unknown'} - {formatDate(post.published_at ?? post.created_at)}
          </span>
          {post.campaign_title && (
            <span className="campaign-tag" style={{ backgroundColor: post.campaign_color + '12', color: post.campaign_color, borderColor: post.campaign_color + '40', border: '1px solid' }}>
              📁 {post.campaign_title}
            </span>
          )}
        </div>

        {/* Likes, Comments, Shares, Views */}
        {post.status === 'Published' && (
          <div style={{ display: 'flex', gap: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            <span title="Lượt thích">❤️ {formatNumber(post.likes)}</span>
            <span title="Bình luận">💬 {formatNumber(post.comments_count)}</span>
            <span title="Chia sẻ">🔁 {formatNumber(post.shares)}</span>
            <span title="Lượt xem" style={{ color: 'var(--text-muted)' }}>👁️ {formatNumber(post.views)}</span>
          </div>
        )}

        {post.permalink ? (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-sm" onClick={handleCopyLink}
              style={copyFeedback ? { borderColor: 'var(--success)' } : {}}>
              {copyFeedback ? 'Copied!' : 'Copy'}
            </button>
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">Open</a>
            {post.status === 'Published' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setExpanded(!expanded)}
                style={expanded ? { background: 'var(--primary)', color: '#000', borderColor: 'var(--primary)' } : {}}
              >
                💬 {expanded ? 'Đóng' : 'Bình luận'}
              </button>
            )}
            <button
              className="btn btn-sm"
              onClick={handleDelete}
              disabled={isDeleting}
              style={{ color: '#ef4444', borderColor: '#ef4444', opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
            >
              {isDeleting ? '⏳ Đang xóa...' : '🗑️ Xóa'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Expanded Comments Section */}
      {expanded && (
        <CommentsSection postId={post.id} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}
