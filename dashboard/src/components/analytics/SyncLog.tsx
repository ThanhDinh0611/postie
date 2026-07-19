import { useState } from 'react';
import { type SyncResponse, type SyncStats } from '@/api/types.ts';
import { formatNumber } from '@/utils/formatters.ts';

interface SyncLogProps {
  results: SyncResponse['results'];
  stats: SyncStats;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mini-bar-track">
      <div className="mini-bar-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export default function SyncLog({ results, stats }: SyncLogProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!results || results.length === 0) {
    return (
      <div className="placeholder-card">
        <p>Chưa có bài viết nào được đồng bộ. Click "Đồng bộ ngay" để bắt đầu.</p>
      </div>
    );
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
