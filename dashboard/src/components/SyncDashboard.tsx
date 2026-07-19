import { useState, useEffect, useMemo } from 'react';
import { useSync } from '@/hooks/useSync.ts';
import { usePages } from '@/hooks/usePages.ts';
import { usePageAnalysis } from '@/hooks/usePageAnalysis.ts';
import { useToast } from '@/hooks/useToast.tsx';
import MetricCard from '@/components/analytics/MetricCard.tsx';
import CSSChart from '@/components/analytics/CSSChart.tsx';
import SyncLog from '@/components/analytics/SyncLog.tsx';
import { formatNumber, formatDate } from '@/utils/formatters.ts';
import { toErrorMessage } from '@/utils/errors.ts';


function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n').filter(Boolean);
  return (
    <div className="insights-markdown">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h4 key={i} className="text-secondary" style={{ marginTop: i > 0 ? '0.75rem' : 0 }}>{line.slice(3)}</h4>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-secondary" style={{ marginTop: '0.5rem' }}>{line.slice(2, -2)}</p>;
        if (line.startsWith('- ')) return <li key={i} className="text-secondary text-base" style={{ marginLeft: '1rem' }}>{line.slice(2)}</li>;
        return <p key={i} className="text-secondary text-base">{line}</p>;
      })}
    </div>
  );
}

export default function SyncDashboard() {
  const { syncStatusQuery, syncAllPostsMutation } = useSync();
  const { analyzePageMutation } = usePages();
  const { addToast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [syncResult, setSyncResult] = useState<Awaited<ReturnType<typeof syncAllPostsMutation.mutateAsync>> | null>(null);
  const [error, setError] = useState('');
  const [completedSuggestions, setCompletedSuggestions] = useState<Record<number, boolean>>({});

  const status = syncStatusQuery.data ?? null;

  useEffect(() => {
    if (status?.pages && status.pages.length > 0 && !selectedPageId) {
      if (status.pages[0]) setSelectedPageId(status.pages[0].id);
    }
  }, [status, selectedPageId]);

  const analysisData = usePageAnalysis(selectedPageId);
  const analysis = analysisData?.data ?? null;
  const isAnalysisLoading = analysisData?.isFetching ?? false;

  const progress = useMemo(() => {
    if (!status?.totalPosts) return 0;
    return Math.min(100, Math.round((status.totalPosts / 200) * 100));
  }, [status]);

  const isSyncing = syncAllPostsMutation.isPending;
  const isAnalyzing = analyzePageMutation.isPending;

  const handlePageChange = (pageId: string) => {
    setSelectedPageId(pageId);
  };

  const handleSync = async () => {
    setError('');
    if (!selectedPageId) {
      addToast('Vui lòng chọn một trang để đồng bộ.', 'warning');
      return;
    }
    try {
      const result = await syncAllPostsMutation.mutateAsync(selectedPageId);
      setSyncResult(result);
    } catch (err) {
      setError(toErrorMessage(err, 'Sync failed'));
    }
  };

  const handleRunAudit = async () => {
    if (!selectedPageId) return;
    try {
      await analyzePageMutation.mutateAsync(selectedPageId);
    } catch (err) {
      addToast('Không thể chạy AI Page Audit', 'error');
    }
  };

  const toggleSuggestion = (idx: number) => {
    setCompletedSuggestions(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const eng = status?.engagement;
  const totalEng = (eng?.totalLikes ?? 0) + (eng?.totalComments ?? 0) + (eng?.totalShares ?? 0) + (eng?.totalViews ?? 0);

  return (
    <div className="sync-dashboard">
      <div className="sync-header">
        <div>
          <h2 className="text-xl font-bold" style={{ marginBottom: '0.25rem' }}>📊 Phân tích & Chiến lược Trang</h2>
          <p className="text-muted text-base">Đồng bộ số liệu Facebook Fanpage và chạy kiểm toán thương hiệu bằng AI.</p>
        </div>
        <div className="flex gap-12 items-center flex-wrap">
          {status?.lastSyncAt && (
            <span className="text-muted text-sm" style={{ marginRight: '0.5rem' }}>
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

      {isAnalyzing || isAnalysisLoading ? (
        <div className="skeleton-container">
          <div className="skeleton-box">
            <div className="skeleton-bar header"></div>
            <div className="skeleton-bar w-85"></div>
            <div className="skeleton-bar w-75"></div>
            <div className="skeleton-bar w-50"></div>
          </div>
          <div className="flex" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="skeleton-box" style={{ height: 160 }}></div>
            <div className="skeleton-box" style={{ height: 160 }}></div>
          </div>
        </div>
      ) : analysis ? (
        <div className="insights-grid">
          <div className="flex-col gap-24">
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

          <div className="flex-col gap-24">
            <div className="insights-card">
              <h3><span>💡</span> Gợi Ý Cải Thiện Fanpage</h3>
              <div className="suggestions-list">
                {(analysis.suggestions ?? []).map((s, idx) => {
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
                          <span className={`priority-badge priority-${(s.priority ?? 'medium').toLowerCase()}`}>{s.priority}</span>
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
              <div className="flex-col gap-20">
                <CSSChart
                  title="Tỷ lệ tương tác theo công thức viết bài (ER %)"
                  data={(analysis.chartsData?.engagementByFormula ?? []).map(f => ({ label: f.formula, value: f.avgEngagementRate }))}
                />
                <CSSChart
                  title="Tỷ lệ tương tác theo loại Hook (ER %)"
                  data={(analysis.chartsData?.engagementByHook ?? []).map(h => ({ label: h.hook, value: h.avgEngagementRate }))}
                />
                <CSSChart
                  title="Tỷ lệ tương tác theo định dạng (ER %)"
                  data={(analysis.chartsData?.engagementByFormat ?? []).map(f => ({ label: f.format, value: f.avgEngagementRate }))}
                />
                <CSSChart
                  title="Số lượng bài viết theo tháng"
                  data={(analysis.chartsData?.postVolumeByMonth ?? []).map(m => ({ label: m.month, value: m.postCount }))}
                  valueSuffix=" bài"
                />
              </div>
            </div>
          </div>
        </div>
      ) : selectedPageId ? (
        <div className="placeholder-card text-center" style={{ padding: '3rem 2rem' }}>
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

      <div className="sync-section mt-16">
        <h3 className="text-lg font-semibold flex items-center gap-8" style={{ marginBottom: '1rem' }}>
          <span>📋</span> Danh sách bài đăng đồng bộ
          {syncResult?.results && <span className="text-muted font-medium text-base" style={{ marginLeft: '0.5rem' }}>({syncResult.results.length} bài đăng gần nhất)</span>}
        </h3>
        <SyncLog results={syncResult?.results ?? []} stats={syncResult?.stats ?? { totalPosts: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0, avgLikes: 0, avgComments: 0, avgShares: 0, avgViews: 0 }} />
      </div>
    </div>
  );
}
