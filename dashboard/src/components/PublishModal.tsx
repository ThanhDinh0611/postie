import { useState } from 'react';
import type { PageData } from '../api.ts';

interface PublishModalProps {
  content: string;
  pages: PageData[];
  selectedPageId: string;
  isPublishing: boolean;
  onConfirm: (finalContent: string, scheduledAt?: number) => void;
  onCancel: () => void;
}

export default function PublishModal({
  content,
  pages,
  selectedPageId,
  isPublishing,
  onConfirm,
  onCancel,
}: PublishModalProps) {
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handleConfirm = () => {
    let scheduledAt: number | undefined;
    if (scheduleDate && scheduleTime) {
      const localDate = new Date(`${scheduleDate}T${scheduleTime}`);
      scheduledAt = Math.floor(localDate.getTime() / 1000);
      if (scheduledAt <= Math.floor(Date.now() / 1000)) {
        alert('⚠️ Thời gian lên lịch phải ở tương lai. Vui lòng chọn lại.');
        return;
      }
    }
    onConfirm(content, scheduledAt);
  };

  const isScheduled = scheduleDate !== '' && scheduleTime !== '';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onCancel(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', width: '100%', maxWidth: 540,
          maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>📢 Xác nhận đăng bài</h3>
          {!isPublishing && (
            <button
              onClick={onCancel}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '1.3rem', cursor: 'pointer', padding: '0.25rem',
              }}
              aria-label="Đóng"
            >
              ✕
            </button>
          )}
        </div>

        {/* Page info */}
        <div
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.85rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Đăng lên: </span>
          <strong>{selectedPage?.name ?? 'Chưa chọn trang'}</strong>
          {selectedPage?.username && (
            <span style={{ color: 'var(--text-muted)' }}> (@{selectedPage.username})</span>
          )}
        </div>

        {/* Content preview */}
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            NỘI DUNG SẼ ĐĂNG
          </label>
          <div
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.85rem',
              whiteSpace: 'pre-wrap', color: 'var(--text-secondary)',
              maxHeight: '200px', overflowY: 'auto', lineHeight: 1.5,
            }}
          >
            {content}
          </div>
        </div>

        {/* Schedule option */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => {
                if (!e.target.checked) { setScheduleDate(''); setScheduleTime(''); }
              }}
              style={{ accentColor: 'var(--accent)' }}
            />
            📅 Lên lịch đăng sau
          </label>
          {isScheduled && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="scheduleDate" style={{ fontSize: '0.78rem' }}>Ngày</label>
                <input
                  id="scheduleDate" type="date" className="form-control"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={isPublishing}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="scheduleTime" style={{ fontSize: '0.78rem' }}>Giờ</label>
                <input
                  id="scheduleTime" type="time" className="form-control"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={isPublishing}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <button
            className="btn" style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
            onClick={onCancel} disabled={isPublishing}
          >
            Huỷ
          </button>
          <button
            className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
            onClick={handleConfirm} disabled={isPublishing}
          >
            {isPublishing
              ? '⏳ Đang đăng...'
              : isScheduled
                ? '📅 Lên lịch đăng'
                : '✅ Xác nhận đăng ngay'
            }
          </button>
        </div>
      </div>
    </div>
  );
}