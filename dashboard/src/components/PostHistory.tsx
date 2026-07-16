import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getPosts, getLinks, type PostData, type LinkData } from '../api.ts';

interface PostHistoryProps {
  initialPosts?: PostData[];
  initialLinks?: LinkData[];
  onRefresh?: () => void;
}

export default function PostHistory({ initialPosts, initialLinks, onRefresh }: PostHistoryProps) {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState<PostData[]>(initialPosts ?? []);
  const [links, setLinks] = useState<LinkData[]>(initialLinks ?? []);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      if (showLinks) {
        const fetchedLinks = await getLinks(token);
        setLinks(fetchedLinks);
      } else {
        const fetchedPosts = await getPosts(token);
        setPosts(fetchedPosts);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, showLinks]);

  useEffect(() => { if (initialPosts) setPosts(initialPosts); }, [initialPosts]);
  useEffect(() => { if (initialLinks) setLinks(initialLinks); }, [initialLinks]);

  const handleCopyLink = async (permalink: string) => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyFeedback(permalink);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      alert('Cannot copy.');
    }
  };

  const handleRefresh = () => { fetchData(); if (onRefresh) onRefresh(); };

  const filteredData = showLinks ? links : statusFilter === 'all' ? posts : posts.filter(p => p.status === statusFilter);

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
    const labels: Record<string, string> = { Published: 'Published', Scheduled: 'Scheduled', Draft: 'Draft', Failed: 'Failed' };
    return (
      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: colors[status] ?? '#64748b', background: bgColors[status] ?? 'rgba(100,116,139,0.12)' }}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className={`btn btn-sm ${!showLinks ? 'btn-primary' : ''}`} onClick={() => setShowLinks(false)}>Posts</button>
          <button className={`btn btn-sm ${showLinks ? 'btn-primary' : ''}`} onClick={() => setShowLinks(true)}>Links</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!showLinks && (
            <select className="form-control" style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Published">Published</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Failed">Failed</option>
            </select>
          )}
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="placeholder-card"><p>No items yet.</p></div>
      ) : (
        <div className="link-list">
          {(showLinks ? filteredData as LinkData[] : filteredData as PostData[]).map(item => {
            const isLink = showLinks;
            const link = item as LinkData;
            const post = item as PostData;
            return (
              <div key={item.id} className="link-item" style={!isLink ? { flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' } : {}}>
                {isLink ? (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="link-message">{link.message?.slice(0, 100)}...</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {link.page_name} - {formatDate(link.published_at ?? link.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button className="btn btn-sm" onClick={() => handleCopyLink(link.permalink)}
                        style={copyFeedback === link.permalink ? { borderColor: 'var(--success)' } : {}}>
                        {copyFeedback === link.permalink ? 'Copied!' : 'Copy'}
                      </button>
                      <a href={link.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">Open</a>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="link-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {post.message?.slice(0, 150)}{(post.message?.length ?? 0) > 150 ? '...' : ''}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>{getStatusBadge(post.status)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>
                        {post.page_name ?? 'Unknown'} - {formatDate(post.published_at ?? post.created_at)}
                        {post.post_format && post.post_format !== 'Post' ? <span style={{ marginLeft: '0.5rem', color: 'var(--accent)' }}>{post.post_format}</span> : null}
                      </span>
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
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}