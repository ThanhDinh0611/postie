import { useState, useEffect, useRef } from 'react';
import { usePosts } from '@/hooks/usePosts.ts';
import { usePages } from '@/hooks/usePages.ts';
import { useCampaigns } from '@/hooks/useCampaigns.ts';
import { useSync } from '@/hooks/useSync.ts';
import type { PostData } from '@/api/types.ts';
import HistoryFilters from '@/components/posts/HistoryFilters.tsx';
import PostCard from '@/components/posts/PostCard.tsx';

const PAGE_SIZE = 20;

export default function PostHistory() {
  const [pageFilter, setPageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const prevFiltersKey = useRef('');

  const filtersKey = JSON.stringify({ pageFilter, statusFilter, campaignFilter, sortBy });

  useEffect(() => {
    if (prevFiltersKey.current && prevFiltersKey.current !== filtersKey) {
      setOffset(0);
      setAllPosts([]);
    }
    prevFiltersKey.current = filtersKey;
  }, [filtersKey]);

  const { pagesQuery } = usePages();
  const { campaignsQuery } = useCampaigns();
  const { syncAllPostsMutation } = useSync();

  const pages = pagesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  useEffect(() => {
    if (pages.length > 0 && pageFilter === 'all') {
      const active = pages.find(p => p.is_active);
      if (active) {
        setPageFilter(active.id);
      }
    }
  }, [pages]);

  const { postsQuery } = usePosts({
    pageId: pageFilter === 'all' ? undefined : pageFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    campaignId: campaignFilter === 'all' ? undefined : campaignFilter,
    sortBy: sortBy,
    offset,
    limit: PAGE_SIZE
  });

  const posts = postsQuery.data ?? [];
  const loading = postsQuery.isFetching;
  const syncing = syncAllPostsMutation.isPending;
  const error = postsQuery.error;

  useEffect(() => {
    if (postsQuery.data && !postsQuery.isFetching) {
      if (offset === 0) {
        setAllPosts(postsQuery.data);
      } else {
        setAllPosts(prev => [...prev, ...postsQuery.data]);
      }
    }
  }, [postsQuery.data, postsQuery.isFetching, offset]);

  const hasMore = posts.length === PAGE_SIZE;

  const handleLoadMore = () => {
    setOffset(prev => prev + PAGE_SIZE);
  };

  const handleRefresh = () => {
    setOffset(0);
    setAllPosts([]);
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

  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    setOffset(0);
    setAllPosts([]);
  };

  return (
    <div>
      <HistoryFilters
        pageFilter={pageFilter}
        setPageFilter={handleFilterChange(setPageFilter)}
        campaignFilter={campaignFilter}
        setCampaignFilter={handleFilterChange(setCampaignFilter)}
        statusFilter={statusFilter}
        setStatusFilter={handleFilterChange(setStatusFilter)}
        sortBy={sortBy}
        setSortBy={handleFilterChange(setSortBy)}
        pages={pages}
        campaigns={campaigns}
        loading={loading}
        onRefresh={handleRefresh}
        onSync={handleSync}
        syncing={syncing}
      />

      {error ? (
        <div className="placeholder-card" style={{ borderColor: 'var(--danger)' }}>
          <p className="text-danger">Lỗi tải dữ liệu: {error instanceof Error ? error.message : String(error)}</p>
          <button className="btn btn-sm" onClick={handleRefresh}>Thử lại</button>
        </div>
      ) : loading && allPosts.length === 0 ? (
        <div className="skeleton-container">
          <div className="skeleton-box">
            <div className="skeleton-bar header"></div>
            <div className="skeleton-bar w-85"></div>
            <div className="skeleton-bar w-75"></div>
            <div className="skeleton-bar w-50"></div>
          </div>
          <div className="skeleton-box">
            <div className="skeleton-bar header"></div>
            <div className="skeleton-bar w-85"></div>
            <div className="skeleton-bar w-75"></div>
            <div className="skeleton-bar w-50"></div>
          </div>
        </div>
      ) : allPosts.length === 0 ? (
        <div className="placeholder-card">
          <p>Chưa có bài viết nào khớp với bộ lọc.</p>
        </div>
      ) : (
        <div className="link-list">
          {allPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {allPosts.length > 0 && hasMore && (
        <div className="text-center mt-16">
          <button
            className="btn"
            style={{ padding: '0.6rem 2rem' }}
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? 'Đang tải...' : 'Tải thêm bài viết'}
          </button>
        </div>
      )}

      {loading && allPosts.length > 0 && (
        <div className="text-center text-muted text-base" style={{ padding: '0.75rem' }}>
          Đang tải thêm...
        </div>
      )}
    </div>
  );
}
