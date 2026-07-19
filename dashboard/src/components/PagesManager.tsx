import { useState, useEffect } from 'react';
import { usePages } from '@/hooks/usePages.ts';
import { useLocation } from 'react-router-dom';
import { toErrorMessage } from '@/utils/errors.ts';

const FB_APP_ID = '9034587649978676';

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return <span className="badge badge-success">Active</span>;
  }
  return <span className="badge badge-muted">Inactive</span>;
}

export default function PagesManager() {
  const { pagesQuery, connectPagesMutation, deletePageMutation, selectPageMutation } = usePages();
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const pages = pagesQuery.data ?? [];
  const loading = pagesQuery.isFetching;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      const redirectUri = window.location.origin + '/pages';
      connectPagesMutation.mutate(
        { code, redirectUri },
        {
          onSuccess: () => {
            setSuccessMsg('Đã kết nối Facebook Page thành công!');
            setTimeout(() => setSuccessMsg(''), 3000);
            window.history.replaceState({}, '', '/pages');
          },
          onError: (err) => {
            setError(toErrorMessage(err, 'Kết nối thất bại'));
          }
        }
      );
    }
  }, [location.search]);

  const handleConnect = () => {
    const redirectUri = window.location.origin + '/pages';
    const fbUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=pages_manage_posts,pages_read_engagement,pages_show_list`;
    window.location.href = fbUrl;
  };

  const handleDisconnect = async (pageId: string, name: string) => {
    if (!confirm(`Disconnect "${name}"?`)) return;
    try {
      await deletePageMutation.mutateAsync(pageId);
      setSuccessMsg(`Disconnected ${name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(toErrorMessage(err, 'Disconnect failed'));
    }
  };

  const handleSetActive = async (pageId: string) => {
    try {
      await selectPageMutation.mutateAsync(pageId);
      setSuccessMsg('Default page updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to set as default'));
    }
  };

  const handleRefresh = () => { pagesQuery.refetch(); };

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const connecting = connectPagesMutation.isPending;

  return (
    <div>
      {successMsg && (
        <div className="card-sm text-success text-base" style={{ background: 'rgba(34,197,94,0.1)', marginBottom: '1rem' }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="card-sm text-danger text-base" style={{ background: 'rgba(239,68,68,0.1)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-12" style={{ marginBottom: '1.5rem' }}>
        <p className="text-muted" style={{ margin: 0 }}>
          {pages.length > 0 ? `Connected ${pages.length} page(s). Select a default page to post.` : 'Connect a Facebook page to start posting.'}
        </p>
        <div className="flex gap-8">
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Facebook Page'}
          </button>
        </div>
      </div>

      {pages.length === 0 && !loading ? (
        <div className="placeholder-card text-center" style={{ padding: '3rem 1.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>Pages</span>
          <h3 className="text-lg" style={{ marginBottom: '0.75rem' }}>No Facebook pages connected</h3>
          <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto 1.5rem' }}>
            Click "Connect Facebook Page" to log in with Facebook and grant Postie permission to manage your pages.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Facebook Page Now'}
          </button>
        </div>
      ) : (
        <div className="page-grid">
          {pages.map((page) => (
            <div key={page.id} className={'page-card' + (page.is_active ? ' active' : '')}>
              <div className="flex items-center gap-12" style={{ marginBottom: '0.75rem' }}>
                {page.avatar_url ? (
                  <img src={page.avatar_url} alt={page.name} loading="lazy"
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-hover)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    Page
                  </div>
                )}
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="page-name truncate text-md">{page.name}</div>
                  {page.username && <div className="text-sm text-muted">@{page.username}</div>}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <StatusBadge active={!!page.is_active} />
              </div>

              <div className="flex gap-6">
                {!page.is_active && (
                  <button className="btn btn-sm btn-flex" onClick={() => handleSetActive(page.id)}>
                    Set Default
                  </button>
                )}
                <button className="btn btn-sm btn-flex text-danger" style={{ borderColor: 'transparent' }} onClick={() => handleDisconnect(page.id, page.name)}>
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
