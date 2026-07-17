import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  syncAllPosts, getSyncStatus, getPageAnalysis, analyzePage,
  type SyncResponse, type SyncStatusResponse, type SyncStats, type PageAnalysisData
} from '../api.ts';

// ─── Helper functions ────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return 'Never';
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Vừa xong';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' phút trước';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' giờ trước';
  return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text: string) {
  if (!text) return null;
  // Convert headers: ### header -> <h4>header</h4>
  let html = text.replace(/### (.*?)(?:\n|$)/g, '<h4>$1</h4>');
  html = html.replace(/## (.*?)(?:\n|$)/g, '<h4>$1</h4>');
  // Convert bold: **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert bullet points: - item -> <li>item</li>
  html = html.replace(/(?:^|\n)-\s(.*?)(?=\n|$)/g, '\n<li>$1</li>');
  // Wrap contiguous <li> blocks in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // Fix duplicate <ul><ul>
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  const paragraphs = html.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li>')) return p;
    return `<p>${p.replace(/\n/g, '<br />')}</p>`;
  });
  
  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: paragraphs.join('') }} />;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mini-bar-track">
      <div className="mini-bar-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

function MetricCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
}) {
  return (
    <div className="metric-card" style={{ borderLeftColor: color }}>
      <div className="metric-header">
        <span className="metric-icon">{icon}</span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function CSSChart({ title, data, valueSuffix = '%' }: {
  title: string;
  data: Array<{ label: string; value: number }>;
  valueSuffix?: string;
}) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Không có dữ liệu biểu đồ.</div>;
  }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const colors = ['accent', 'success', 'info', 'danger'];

  return (
    <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</h4>
      <div className="chart-bar-container">
        {data.map((item, idx) => {
          const colorClass = colors[idx % colors.length] || 'accent';
          return (
            <div key={idx} className="chart-bar-row">
              <div className="chart-bar-label" title={item.label}>{item.label}</div>
              <div className="chart-bar-track">
                <div className={`chart-bar-fill ${colorClass}`} style={{ width: `${(item.value / maxVal) * 100}%` }} />
              </div>
              <div className="chart-bar-value">{item.value.toFixed(1)}{valueSuffix}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SyncLog({ results, stats }: { results: SyncResponse['results']; stats: SyncStats }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!results || results.length === 0) {
    return <div className="placeholder-card"><p>Chưa có bài viết nào được đồng bộ. Click "Đồng bộ ngay" để bắt đầu.</p></div>;
  }

  return (
    <div>
      <div className="sync-mini-stats">
        <span>{'❤️'} {formatNumber(stats.totalLikes)}</span>
        <span>{'💬'} {formatNumber(stats.totalComments)}</span>
        <span>{'🔁'} {formatNumber(stats.totalShares)}</span>
        <span>{'👁️'} {formatNumber(stats.totalViews)}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          Trung bình: {stats.avgLikes} ❤️ / {stats.avgComments} 💬 / {stats.avgShares} 🔁
        </span>
      </div>
      <div className="sync-post-list">
        {results.map((item) => {
          const isExpanded = expanded === item.postId;
          const eng = item.engagement;
          const maxVal = eng ? Math.max(eng.likes, eng.comments, eng.shares, eng.views, 1) : 1;
          return (
            <div
              key={item.postId}
              className={'sync-post-item' + (isExpanded ? ' expanded' : '')}
              onClick={() => setExpanded(isExpanded ? null : item.postId)}
            >
              <div className="sync-post-header">
                <div className="sync-post-message">{item.message || '(Không có nội dung)'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span className="sync-page-badge">{item.pageName}</span>
                  {eng
                    ? <span className="status-badge status-synced">Đã đồng bộ</span>
                    : <span className="status-badge status-pending">Chưa có số liệu</span>}
                </div>
              </div>
              {eng && (
                <div className="sync-post-metrics">
                  <div className="sync-metric-row">
                    <span className="sync-metric-label">{'❤️'} {formatNumber(eng.likes)}</span>
                    <MiniBar value={eng.likes} max={maxVal} color="#ef4444" />
                  </div>
                  <div className="sync-metric-row">
                    <span className="sync-metric-label">{'💬'} {formatNumber(eng.comments)}</span>
                    <MiniBar value={eng.comments} max={maxVal} color="#3b82f6" />
                  </div>
                  <div className="sync-metric-row">
                    <span className="sync-metric-label">{'🔁'} {formatNumber(eng.shares)}</span>
                    <MiniBar value={eng.shares} max={maxVal} color="#22c55e" />
                  </div>
                  <div className="sync-metric-row">
                    <span className="sync-metric-label">{'👁️'} {formatNumber(eng.views)}</span>
                    <MiniBar value={eng.views} max={maxVal} color="#a855f7" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main SyncDashboard Component ──────────────────────────────────────────

interface SyncDashboardProps {
  onDataChange?: () => void;
}

export default function SyncDashboard({ onDataChange }: SyncDashboardProps) {
  const { getToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [analysis, setAnalysis] = useState<PageAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [completedSuggestions, setCompletedSuggestions] = useState<Record<string, boolean>>({});

  const loadStatusAndAnalysis = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      
      const statusRes = await getSyncStatus(token);
      setStatus(statusRes);

      // Find active page to load analysis
      let pageId = selectedPageId;
      if (!pageId && statusRes.pages && statusRes.pages.length > 0) {
        // Find active page or default to first
        const active = statusRes.pages.find(p => p.id); // Or active check
        pageId = active?.id || statusRes.pages[0]!.id;
        setSelectedPageId(pageId);
      }

      if (pageId) {
        const analysisRes = await getPageAnalysis(pageId, token);
        setAnalysis(analysisRes);
        
        // Load checked suggestions from localStorage
        const stored = localStorage.getItem(`suggestions_completed_${pageId}`);
        if (stored) {
          try { setCompletedSuggestions(JSON.parse(stored)); } catch { /* ignore */ }
        } else {
          setCompletedSuggestions({});
        }
      }
    } catch (err) {
      console.error('Failed to load status/analysis:', err);
    }
  }, [getToken, selectedPageId]);

  useEffect(() => {
    loadStatusAndAnalysis();
  }, [loadStatusAndAnalysis]);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setProgress(10);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      setProgress(30);
      const result = await syncAllPosts(token);
      setProgress(100);
      setSyncResult(result);
      onDataChange?.();
      await loadStatusAndAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      setProgress(0);
    }
  };

  const handleRunAudit = async () => {
    if (!selectedPageId) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      const result = await analyzePage(selectedPageId, token);
      setAnalysis(result);
      localStorage.setItem(`suggestions_completed_${selectedPageId}`, '{}');
      setCompletedSuggestions({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Page Audit failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    const next = { ...completedSuggestions, [index]: !completedSuggestions[index] };
    setCompletedSuggestions(next);
    if (selectedPageId) {
      localStorage.setItem(`suggestions_completed_${selectedPageId}`, JSON.stringify(next));
    }
  };

  const handlePageChange = (pageId: string) => {
    setSelectedPageId(pageId);
    setAnalysis(null);
  };

  const eng = status?.engagement;
  const totalEng = (eng?.totalLikes ?? 0) + (eng?.totalComments ?? 0) + (eng?.totalShares ?? 0) + (eng?.totalViews ?? 0);

  return (
    <div className="sync-dashboard">
      {/* Upper header controls */}
      <div className="sync-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>📊 Phân tích & Chiến lược Trang</h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>Đồng bộ số liệu Facebook Fanpage và chạy kiểm toán thương hiệu bằng AI.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {status?.lastSyncAt && (
            <span className="text-muted" style={{ fontSize: '0.78rem', marginRight: '0.5rem' }}>
              Đồng bộ lần cuối: {formatDate(status.lastSyncAt)}
            </span>
          )}
          {status?.pages && status.pages.length > 0 && (
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={selectedPageId}
              onChange={e => handlePageChange(e.target.value)}
              disabled={isSyncing || isAnalyzing}
            >
              {status.pages.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <button className={'btn btn-primary' + (isSyncing ? ' syncing' : '')} onClick={handleSync} disabled={isSyncing || isAnalyzing}>
            {isSyncing ? <><span className="spinner" /> Đang đồng bộ...</> : '🔄 Đồng bộ số liệu'}
          </button>

          <button
            className="btn"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
            onClick={handleRunAudit}
            disabled={isSyncing || isAnalyzing || !selectedPageId}
          >
            {isAnalyzing ? <><span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> Đang phân tích...</> : '🤖 AI Page Audit'}
          </button>
        </div>
      </div>

      {isSyncing && <div className="sync-progress-track"><div className="sync-progress-fill" style={{ width: progress + '%' }} /></div>}
      {error && <div className="sync-error"><span>⚠️</span> {error}</div>}

      {syncResult && !isSyncing && (
        <div className="sync-success">
          <span>✅</span> Đã đồng bộ thành công {syncResult.totalSynced} trên tổng số {syncResult.totalFetched} bài viết của {syncResult.pages} fanpage trong {syncResult.duration}.
          <button className="btn btn-sm" style={{ marginLeft: '1rem' }} onClick={() => setSyncResult(null)}>Đóng</button>
        </div>
      )}

      {/* Aggregate Metrics cards */}
      {status && (
        <div className="metrics-grid">
          <MetricCard label="Tổng bài đăng" value={status.totalPosts} icon="📝" color="#f59e0b" sub={status.pageCount + ' trang kết nối'} />
          <MetricCard label="Lượt thích" value={formatNumber(eng?.totalLikes ?? 0)} icon="❤️" color="#ef4444" />
          <MetricCard label="Bình luận" value={formatNumber(eng?.totalComments ?? 0)} icon="💬" color="#3b82f6" />
          <MetricCard label="Chia sẻ" value={formatNumber(eng?.totalShares ?? 0)} icon="🔁" color="#22c55e" />
          <MetricCard label="Lượt xem" value={formatNumber(eng?.totalViews ?? 0)} icon="👁️" color="#a855f7" />
          <MetricCard label="Tổng tương tác" value={formatNumber(totalEng)} icon="📈" color="#f59e0b" sub={`Avg ER: ${analysis?.metricsSummary?.avgEngagementRate?.toFixed(2) ?? '0.00'}%`} />
        </div>
      )}

      {/* AI Page Analysis Strategic Section */}
      {isAnalyzing ? (
        <div className="skeleton-container">
          <div className="skeleton-box">
            <div className="skeleton-bar header"></div>
            <div className="skeleton-bar w-85"></div>
            <div className="skeleton-bar w-75"></div>
            <div className="skeleton-bar w-50"></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="skeleton-box" style={{ height: 160 }}></div>
            <div className="skeleton-box" style={{ height: 160 }}></div>
          </div>
        </div>
      ) : analysis ? (
        <div className="insights-grid">
          {/* Left Column: Report & Writing style */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="insights-card">
              <h3><span>📋</span> Báo Cáo Kiểm Toán Chiến Lược AI</h3>
              {renderMarkdown(analysis.summary)}
            </div>

            <div className="insights-card">
              <h3><span>✍️</span> Brand Voice & Hướng Dẫn Viết Bài (Đã Đồng Bộ Với AI Generator)</h3>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '-0.5rem', marginBottom: '0.25rem' }}>
                Hướng dẫn này tự động được áp dụng vào prompt khi bạn tạo bài viết mới bằng AI cho trang này.
              </p>
              <div className="brand-voice-box">
                {analysis.writingStyleInstructions}
              </div>
            </div>
          </div>

          {/* Right Column: Suggestions checklist & CSS charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="insights-card">
              <h3><span>💡</span> Gợi Ý Cải Thiện Fanpage</h3>
              <div className="suggestions-list">
                {analysis.suggestions.map((s, idx) => {
                  const isCompleted = !!completedSuggestions[idx];
                  return (
                    <div
                      key={idx}
                      className={`suggestion-row ${isCompleted ? 'completed' : ''}`}
                      onClick={() => toggleSuggestion(idx)}
                    >
                      <div className="suggestion-checkbox">
                        {isCompleted && '✓'}
                      </div>
                      <div className="suggestion-content">
                        <div className="suggestion-title-row">
                          <span className="suggestion-title">{s.title}</span>
                          <span className={`priority-badge priority-${s.priority.toLowerCase()}`}>{s.priority}</span>
                        </div>
                        <span className="suggestion-desc">{s.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="insights-card">
              <h3><span>📊</span> Biểu Đồ Hiệu Suất</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <CSSChart
                  title="Tỷ lệ tương tác theo công thức viết bài (ER %)"
                  data={analysis.chartsData.engagementByFormula.map(f => ({ label: f.formula, value: f.avgEngagementRate }))}
                />
                <CSSChart
                  title="Tỷ lệ tương tác theo loại Hook (ER %)"
                  data={analysis.chartsData.engagementByHook.map(h => ({ label: h.hook, value: h.avgEngagementRate }))}
                />
                <CSSChart
                  title="Tỷ lệ tương tác theo định dạng (ER %)"
                  data={analysis.chartsData.engagementByFormat.map(f => ({ label: f.format, value: f.avgEngagementRate }))}
                />
                <CSSChart
                  title="Số lượng bài viết theo tháng"
                  data={analysis.chartsData.postVolumeByMonth.map(m => ({ label: m.month, value: m.postCount }))}
                  valueSuffix=" bài"
                />
              </div>
            </div>
          </div>
        </div>
      ) : selectedPageId ? (
        <div className="placeholder-card" style={{ padding: '3rem 2rem' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔮</span>
          <h3>Chưa có phân tích chiến lược cho trang này</h3>
          <p className="text-muted" style={{ margin: '0.5rem auto 1.5rem', maxWidth: '480px' }}>
            Nhấp nút "AI Page Audit" ở góc trên bên phải để kích hoạt hệ thống phân tích AI. AI sẽ kiểm tra các bài đăng gần đây của bạn, đo lường tương tác và lập chiến lược giọng điệu cho các bài viết tiếp theo.
          </p>
          <button className="btn btn-primary" onClick={handleRunAudit} disabled={isSyncing || isAnalyzing}>
            🚀 Bắt đầu AI Page Audit
          </button>
        </div>
      ) : null}

      {/* Bottom Synced Post Log */}
      <div className="sync-section" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Danh sách bài đăng đồng bộ
          {syncResult?.results && <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.85rem', marginLeft: '0.5rem' }}>({syncResult.results.length} bài đăng gần nhất)</span>}
        </h3>
        <SyncLog results={syncResult?.results ?? []} stats={syncResult?.stats ?? { totalPosts: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0, avgLikes: 0, avgComments: 0, avgShares: 0, avgViews: 0 }} />
      </div>
    </div>
  );
}