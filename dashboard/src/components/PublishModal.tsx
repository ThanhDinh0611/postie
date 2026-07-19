import { useState } from 'react';
import type { PageData } from '@/api/types.ts';
import { useToast } from '@/hooks/useToast.tsx';

interface PublishModalProps {
  content: string;
  mediaUrl?: string;
  publishProgress?: string;
  pages: PageData[];
  selectedPageId: string;
  isPublishing: boolean;
  onConfirm: (finalContent: string, scheduledAt?: number) => void;
  onCancel: () => void;
}

export default function PublishModal({
  content,
  mediaUrl,
  publishProgress,
  pages,
  selectedPageId,
  isPublishing,
  onConfirm,
  onCancel,
}: PublishModalProps) {
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const { addToast } = useToast();
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handleConfirm = () => {
    let scheduledAt: number | undefined;
    if (scheduleDate && scheduleTime) {
      const localDate = new Date(`${scheduleDate}T${scheduleTime}`);
      scheduledAt = Math.floor(localDate.getTime() / 1000);
      if (scheduledAt <= Math.floor(Date.now() / 1000)) {
        addToast('Thời gian lên lịch phải ở tương lai. Vui lòng chọn lại.', 'warning');
        return;
      }
    }
    onConfirm(content, scheduledAt);
  };

  const isScheduled = scheduleDate !== '' && scheduleTime !== '';

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onCancel(); }}
    >
      <div className="modal-content">
        <div className="flex justify-between items-center">
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

        {isPublishing && (
          <div className="flex items-center justify-center gap-8 text-base font-semibold"
            style={{
              background: 'var(--accent-light)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)', padding: '0.75rem',
              color: 'var(--accent)',
            }}>
            <span className="spinner-mini" />
            {publishProgress || '⏳ Đang xử lý đăng bài...'}
          </div>
        )}

        <div className="card-sm text-base">
          <span className="text-muted">Đăng lên: </span>
          <strong>{selectedPage?.name ?? 'Chưa chọn trang'}</strong>
          {selectedPage?.username && (
            <span className="text-muted"> (@{selectedPage.username})</span>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-muted" style={{ display: 'block', marginBottom: '0.4rem' }}>
            NỘI DUNG SẼ ĐĂNG
          </label>
          <div className="card-sm text-base" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', maxHeight: '150px', overflowY: 'auto', lineHeight: 1.5 }}>
            {content}
          </div>
        </div>

        {mediaUrl && (
          <div>
            <label className="text-sm font-semibold text-muted" style={{ display: 'block', marginBottom: '0.4rem' }}>
              HÌNH ẢNH ĐÍNH KÈM
            </label>
            <div className="card-sm flex justify-center" style={{ padding: '0.5rem' }}>
              <img src={mediaUrl} alt="Preview" loading="lazy" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: 4 }} />
            </div>
          </div>
        )}

        <div>
          <label className="text-base font-medium text-secondary flex items-center gap-8" style={{ marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => {
                if (!e.target.checked) { setScheduleDate(''); setScheduleTime(''); }
              }}
              style={{ accentColor: 'var(--accent)' }}
              disabled={isPublishing}
            />
            📅 Lên lịch đăng sau
          </label>
          {isScheduled && (
            <div className="flex gap-12">
              <div className="form-group mb-0 flex-1">
                <label htmlFor="scheduleDate" className="text-sm">Ngày</label>
                <input id="scheduleDate" type="date" className="form-control"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={isPublishing} />
              </div>
              <div className="form-group mb-0 flex-1">
                <label htmlFor="scheduleTime" className="text-sm">Giờ</label>
                <input id="scheduleTime" type="time" className="form-control"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={isPublishing} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-12" style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-flex" style={{ padding: '0.75rem' }}
            onClick={onCancel} disabled={isPublishing}>
            Huỷ
          </button>
          <button className="btn btn-primary btn-flex" style={{ padding: '0.75rem' }}
            onClick={handleConfirm} disabled={isPublishing}>
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
