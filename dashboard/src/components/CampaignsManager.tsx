import { useState } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns.ts';
import { toErrorMessage } from '@/utils/errors.ts';
import type { CampaignData } from '@/api/types.ts';

const PALETTE: Array<{ name: string; value: string }> = [
  { name: 'Xanh dương', value: '#3b82f6' },
  { name: 'Xanh lá', value: '#10b981' },
  { name: 'Cam', value: '#f59e0b' },
  { name: 'Đỏ', value: '#ef4444' },
  { name: 'Tím', value: '#8b5cf6' },
  { name: 'Hồng', value: '#ec4899' },
  { name: 'Teal', value: '#06b6d4' }
];

const DEFAULT_COLOR: string = PALETTE[0]?.value ?? '#3b82f6';

export default function CampaignsManager() {
  const { campaignsQuery, createCampaignMutation, updateCampaignMutation, deleteCampaignMutation } = useCampaigns();

  const campaigns = campaignsQuery.data ?? [];
  const loading = campaignsQuery.isFetching;

  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSuccess(null);

    try {
      if (editingCampaignId) {
        await updateCampaignMutation.mutateAsync({ id: editingCampaignId, data: { title, description, color } });
        setSuccess('Đã cập nhật chiến dịch!');
        setEditingCampaignId(null);
      } else {
        await createCampaignMutation.mutateAsync({ title, description, color });
        setSuccess('Đã tạo chiến dịch mới!');
      }
      setTitle('');
      setDescription('');
      setColor(DEFAULT_COLOR);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save campaign'));
    }
  };

  const handleEdit = (c: CampaignData) => {
    setEditingCampaignId(c.id);
    setTitle(c.title);
    setDescription(c.description ?? '');
    setColor(c.color);
  };

  const handleCancelEdit = () => {
    setEditingCampaignId(null);
    setTitle('');
    setDescription('');
    setColor(PALETTE[0]!.value);
  };

  const handleDelete = async (c: CampaignData) => {
    if (!confirm(`Xóa chiến dịch "${c.title}"?`)) return;
    setError(null);
    try {
      await deleteCampaignMutation.mutateAsync(c.id);
      setSuccess('Đã xóa chiến dịch!');
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to delete campaign'));
    }
  };

  const handleRefresh = () => { campaignsQuery.refetch(); };

  return (
    <div className="flex" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
      <div className="card">
        <h3 className="text-md font-semibold" style={{ marginBottom: '1.25rem' }}>
          {editingCampaignId ? '📝 Sửa chiến dịch' : '📁 Tạo chiến dịch tiếp thị mới'}
        </h3>

        <form onSubmit={handleSave} className="flex-col gap-16">
          <div className="form-group mb-0">
            <label htmlFor="c-title">Tên chiến dịch</label>
            <input id="c-title" type="text" className="form-control" placeholder="Ví dụ: Khai trương, Promotion Hè, Mini game..." value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="c-desc">Mô tả ngắn</label>
            <textarea id="c-desc" className="form-control" placeholder="Mục tiêu của chiến dịch..." style={{ minHeight: '60px' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="form-group mb-0">
            <label>Màu sắc nhận diện</label>
            <div className="flex gap-6 flex-wrap mt-4">
              {PALETTE.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setColor(p.value)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: p.value,
                    border: color === p.value ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer', outline: 'none',
                    boxShadow: color === p.value ? '0 0 4px rgba(255,255,255,0.4)' : 'none'
                  }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          {error && <div className="text-danger text-sm">⚠️ {error}</div>}
          {success && <div className="text-success text-sm">✅ {success}</div>}

          <div className="flex gap-8 mt-8">
            {editingCampaignId && (
              <button type="button" className="btn btn-flex" onClick={handleCancelEdit}>Hủy</button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
              {editingCampaignId ? 'Cập nhật' : 'Tạo chiến dịch'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex-col gap-16">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-semibold">📋 Danh sách chiến dịch tiếp thị ({campaigns.length})</h3>
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>

        {campaigns.length === 0 && !loading ? (
          <div className="placeholder-card" style={{ padding: '2rem 1rem' }}>
            <p>Chưa có chiến dịch nào. Tạo chiến dịch ở bảng bên trái để quản lý bài viết tốt hơn!</p>
          </div>
        ) : (
          <div className="flex-col gap-10">
            {campaigns.map(c => (
              <div
                key={c.id}
                className="card flex justify-between items-center"
                style={{ borderLeft: `4px solid ${c.color}`, gap: '1rem' }}
              >
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-8">
                    <span className="text-md font-semibold text-secondary">{c.title}</span>
                  </div>
                  {c.description && <div className="text-sm text-muted" style={{ marginTop: '0.15rem' }}>{c.description}</div>}
                </div>

                <div className="flex gap-6 flex-shrink-0">
                  <button className="btn btn-sm" onClick={() => handleEdit(c)}>Sửa</button>
                  <button className="btn btn-sm text-danger" style={{ borderColor: 'transparent' }} onClick={() => handleDelete(c)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
