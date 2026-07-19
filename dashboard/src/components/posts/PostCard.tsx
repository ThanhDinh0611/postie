import { useState } from 'react';
import type { PostData } from '@/api/types.ts';
import { usePosts } from '@/hooks/usePosts.ts';
import { useToast } from '@/hooks/useToast.tsx';
import { toErrorMessage } from '@/utils/errors.ts';
import CommentsSection from '@/components/posts/CommentsSection.tsx';

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
      addToast(`Lỗi xóa bài viết: ${toErrorMessage(err)}`, 'error');
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
      <span className="badge" style={{ color: colors[status] ?? '#64748b', background: bgColors[status] ?? 'rgba(100,116,139,0.12)' }}>
        {labels[status] ?? status}
      </span>
    );
  };

  const isDeleting = deletePostMutation.isPending;

  return (
    <div className="link-item flex-col items-stretch gap-10">
      <div className="flex justify-between items-start gap-12">
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="link-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.5' }}>
            {post.message}
          </div>
        </div>
        <div className="flex-shrink-0 flex-col items-end gap-6" style={{ display: 'flex' }}>
          {getStatusBadge(post.status)}
          {post.post_format && post.post_format !== 'Post' ? (
            <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
              {post.post_format}
              {post.reel_duration ? ` ${post.reel_duration}s` : ''}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex justify-between items-center font-semibold text-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-8 flex-wrap">
          <span className="text-muted font-medium">
            {post.page_name ?? 'Unknown'} - {formatDate(post.published_at ?? post.created_at)}
          </span>
          {post.campaign_title && (
            <span className="campaign-tag" style={{ backgroundColor: post.campaign_color + '12', color: post.campaign_color, borderColor: post.campaign_color + '40', border: '1px solid' }}>
              📁 {post.campaign_title}
            </span>
          )}
        </div>

        {post.status === 'Published' && (
          <div className="flex gap-12 font-medium text-secondary">
            <span title="Lượt thích">❤️ {formatNumber(post.likes)}</span>
            <span title="Bình luận">💬 {formatNumber(post.comments_count)}</span>
            <span title="Chia sẻ">🔁 {formatNumber(post.shares)}</span>
            <span title="Lượt xem" className="text-muted">👁️ {formatNumber(post.views)}</span>
          </div>
        )}

        {post.permalink ? (
          <div className="flex gap-6">
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
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)', opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
            >
              {isDeleting ? '⏳ Đang xóa...' : '🗑️ Xóa'}
            </button>
          </div>
        ) : null}
      </div>

      {expanded && (
        <CommentsSection postId={post.id} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}
