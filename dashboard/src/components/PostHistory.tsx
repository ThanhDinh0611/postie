import { useState, useEffect } from 'react';
import { usePosts } from '../hooks/usePosts.ts';
import { usePages } from '../hooks/usePages.ts';
import { useCampaigns } from '../hooks/useCampaigns.ts';
import { useSync } from '../hooks/useSync.ts';
import HistoryFilters from './posts/HistoryFilters.tsx';
import PostCard from './posts/PostCard.tsx';

export default function PostHistory() {
  // Filters local states
  const [pageFilter, setPageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  // React Query calls
  const { pagesQuery } = usePages();
  const { campaignsQuery } = useCampaigns();
  const { syncAllPostsMutation } = useSync();

  const pages = pagesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  // Default page filter to the active page if loaded
  useEffect(() => {
    if (pages.length > 0 && pageFilter === 'all') {
      const active = pages.find(p => p.is_active);
      if (active) {
        setPageFilter(active.id);
      }
    }
  }, [pages]);

  // Posts listing query with filter parameters
  const { postsQuery } = usePosts({
    pageId: pageFilter === 'all' ? undefined : pageFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    campaignId: campaignFilter === 'all' ? undefined : campaignFilter,
    sortBy: sortBy
  });

  const posts = postsQuery.data ?? [];
  const loading = postsQuery.isFetching;
  const syncing = syncAllPostsMutation.isPending;
  const error = postsQuery.error;

  // Debug: log posts data to console
  console.log('[PostHistory] pages loaded:', pages.length, 'pageFilter:', pageFilter);
  console.log('[PostHistory] postsQuery state:', { isLoading: postsQuery.isLoading, isFetching: postsQuery.isFetching, isError: postsQuery.isError, dataLength: posts?.length, error: postsQuery.error });

  const handleRefresh = () => {
    postsQuery.refetch();
  };

  const handleSync = async () => {
    if (pageFilter === 'all') return;
    try {
      await syncAllPostsMutation.mutateAsync(pageFilter);
    } catch (err) {
      console.error('Failed to sync page:', err);
    }
  };

  return (
    <div>
      <HistoryFilters
        pageFilter={pageFilter}
        setPageFilter={setPageFilter}
        campaignFilter={campaignFilter}
        setCampaignFilter={setCampaignFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        pages={pages}
        campaigns={campaigns}
        loading={loading}
        onRefresh={handleRefresh}
        onSync={handleSync}
        syncing={syncing}
      />

      {error ? (
        <div className="placeholder-card" style={{ borderColor: '#ef4444' }}>
          <p style={{ color: '#ef4444' }}>❌ Lỗi tải dữ liệu: {error instanceof Error ? error.message : String(error)}</p>
          <button className="btn btn-sm" onClick={handleRefresh}>Thử lại</button>
        </div>
      ) : loading && posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Đang tải lịch sử bài viết...
        </div>
      ) : posts.length === 0 ? (
        <div className="placeholder-card">
          <p>Chưa có bài viết nào khớp với bộ lọc.</p>
        </div>
      ) : (
        <div className="link-list">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}