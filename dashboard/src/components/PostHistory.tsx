import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getPosts, type PostData, type CampaignData, type PageData } from '../api.ts';
import { useToast } from '../hooks/useToast.tsx';

interface PostHistoryProps {
  initialPosts?: PostData[];
  pages?: PageData[];
  campaigns?: CampaignData[];
  onRefresh?: () => void;
}

export default function PostHistory({ initialPosts, pages = [], campaigns = [], onRefresh }: PostHistoryProps) {
  const { getToken } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<PostData[]>(initialPosts ?? []);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [pageFilter, setPageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Set default page filter to the active page once pages are loaded
  useEffect(() => {
    if (pages.length > 0 && pageFilter === 'all') {
      const active = pages.find(p => p.is_active);
      if (active) {
        setPageFilter(active.id);
      }
    }
  }, [pages]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const fetchedPosts = await getPosts(token, {
        pageId: pageFilter === 'all' ? undefined : pageFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        campaignId: campaignFilter === 'all' ? undefined : campaignFilter,
        sortBy: sortBy
      });
      setPosts(fetchedPosts);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, pageFilter, statusFilter, campaignFilter, sortBy]);

  // Refetch when filters/sort change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => { if (initialPosts) setPosts(initialPosts); }, [initialPosts]);

  const handleCopyLink = async (permalink: string) => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyFeedback(permalink);
      setTimeout(() => setCopyFeedback(null), 2000);
      addToast('📋 Đã sao chép liên kết vào khay nhớ tạm!', 'success');
    } catch {
      addToast('Không thể sao chép liên kết.', 'error');
    }
  };

  const handleRefresh = () => { fetchData(); if (onRefresh) onRefresh(); };

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

  return (
    <div>
      {/* Filters and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Danh sách bài đăng</h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Page Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={pageFilter}
            onChange={e => setPageFilter(e.target.value)}
          >
            <option value="all">Tất cả trang</option>
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_active ? '★' : ''}
              </option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
          >
            <option value="all">Tất cả chiến dịch</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Trạng thái (Tất cả)</option>
            <option value="Published">Đã đăng</option>
            <option value="Scheduled">Lên lịch</option>
            <option value="Draft">Bản nháp</option>
            <option value="Failed">Lỗi</option>
          </select>

          {/* Sorting Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="latest">Mới nhất</option>
            <option value="engagement">Tương tác cao nhất</option>
            <option value="likes">Yêu thích nhất</option>
            <option value="comments">Bình luận nhiều nhất</option>
            <option value="shares">Chia sẻ nhiều nhất</option>
            <option value="views">Lượt xem nhiều nhất</option>
          </select>
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
        </div>
      </div>

      {loading && posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Đang tải lịch sử bài viết...</div>
      ) : posts.length === 0 ? (
        <div className="placeholder-card"><p>Chưa có bài viết nào khớp với bộ lọc.</p></div>
      ) : (
        <div className="link-list">
          {posts.map(post => (
            <div key={post.id} className="link-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="link-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {post.message?.slice(0, 200)}{(post.message?.length ?? 0) > 200 ? '...' : ''}
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
                    <button className="btn btn-sm" onClick={() => handleCopyLink(post.permalink!)}
                      style={copyFeedback === post.permalink ? { borderColor: 'var(--success)' } : {}}>
                      {copyFeedback === post.permalink ? 'Copied!' : 'Copy'}
                    </button>
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">Open</a>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}