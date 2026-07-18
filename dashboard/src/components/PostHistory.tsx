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

      {loading && posts.length === 0 ? (
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