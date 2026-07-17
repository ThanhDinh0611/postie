import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getPages, oauthConnectPages, deletePage, selectActivePage, type PageData } from '../api.ts';

const FB_GRAPH_VERSION = 'v25.0';
const FB_OAUTH_SCOPE = 'pages_manage_posts,pages_read_engagement,pages_show_list';

interface PagesManagerProps {
  initialPages?: PageData[];
  onPagesChange?: (pages: PageData[]) => void;
}

export default function PagesManager({ initialPages, onPagesChange }: PagesManagerProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pages, setPages] = useState<PageData[]>(initialPages ?? []);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;

    const handleOAuthCallback = async () => {
      setConnecting(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error('Unauthorized');
        const redirectUri = window.location.origin + window.location.pathname;
        const result = await oauthConnectPages(code, redirectUri, token);
        setPages(result.pages);
        onPagesChange?.(result.pages);
        setSuccessMsg('Connected ' + result.pages.length + ' page(s) successfully!');
        navigate(window.location.pathname, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      } finally {
        setConnecting(false);
      }
    };

    handleOAuthCallback();
  }, [searchParams, getToken, navigate, onPagesChange]);

  const handleConnect = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!fbAppId) {
      setError('Missing VITE_FACEBOOK_APP_ID in .env');
      return;
    }
    const oauthUrl = 'https://www.facebook.com/' + FB_GRAPH_VERSION + '/dialog/oauth?' +
      'client_id=' + fbAppId +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&scope=' + encodeURIComponent(FB_OAUTH_SCOPE) +
      '&response_type=code' +
      '&state=' + encodeURIComponent(crypto.randomUUID());
    window.location.href = oauthUrl;
  };

  const handleSetActive = async (pageId: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      await selectActivePage(pageId, token);
      const updated = pages.map((p: PageData) => ({ ...p, is_active: p.id === pageId ? 1 : 0 }));
      setPages(updated);
      onPagesChange?.(updated);
      setSuccessMsg('Set as default page');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active');
    }
  };

  const handleDisconnect = async (pageId: string, pageName: string) => {
    if (!confirm('Disconnect "' + pageName + '"?')) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      await deletePage(pageId, token);
      const updated = pages.filter((p: PageData) => p.id !== pageId);
      setPages(updated);
      onPagesChange?.(updated);
      setSuccessMsg('Disconnected "' + pageName + '"');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      const fetched = await getPages(token);
      setPages(fetched);
      onPagesChange?.(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <div>
      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--success)' }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p className="text-muted" style={{ margin: 0 }}>
          {pages.length > 0 ? 'Connected ' + pages.length + ' page(s). Select a default page to post.' : 'Connect a Facebook page to start posting.'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Facebook Page'}
          </button>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="placeholder-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>Pages</span>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>No Facebook pages connected</h3>
          <p className="text-muted" style={{ marginBottom: '1.5rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {page.avatar_url ? (
                  <img src={page.avatar_url} alt={page.name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-hover)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    Page
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="page-name" style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {page.name}
                  </div>
                  {page.username && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{page.username}</div>}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                {page.is_active ? (
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.12)' }}>
                    Active
                  </span>
                ) : (
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'rgba(100,116,139,0.12)' }}>
                    Inactive
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {!page.is_active && (
                  <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleSetActive(page.id)}>
                    Set Default
                  </button>
                )}
                <button className="btn btn-sm" style={{ flex: page.is_active ? 1 : undefined, justifyContent: 'center', borderColor: 'transparent', color: 'var(--danger)' }} onClick={() => handleDisconnect(page.id, page.name)}>
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