import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, type CampaignData } from '../api.ts';

const PALETTE = [
  { name: 'Xanh dương', value: '#3b82f6' },
  { name: 'Xanh lá', value: '#10b981' },
  { name: 'Cam', value: '#f59e0b' },
  { name: 'Đỏ', value: '#ef4444' },
  { name: 'Tím', value: '#8b5cf6' },
  { name: 'Hồng', value: '#ec4899' },
  { name: 'Teal', value: '#06b6d4' }
];

interface CampaignsManagerProps {
  initialCampaigns?: CampaignData[];
  onCampaignsChange?: (campaigns: CampaignData[]) => void;
}

export default function CampaignsManager({ initialCampaigns, onCampaignsChange }: CampaignsManagerProps) {
  const { getToken } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignData[]>(initialCampaigns ?? []);
  const [loading, setLoading] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PALETTE[0]!.value);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCampaigns(token);
      setCampaigns(data);
      onCampaignsChange?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialCampaigns) {
      fetchCampaigns();
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');

      if (editingCampaignId) {
        await updateCampaign(editingCampaignId, { title, description, color }, token);
        setSuccess('Đã cập nhật chiến dịch!');
        setEditingCampaignId(null);
      } else {
        await createCampaign({ title, description, color }, token);
        setSuccess('Đã tạo chiến dịch mới!');
      }

      // Reset form
      setTitle('');
      setDescription('');
      setColor(PALETTE[0]!.value);
      
      // Reload
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
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
    if (!confirm(`Xóa chiến dịch "${c.title}"? Các bài viết thuộc chiến dịch này sẽ không bị xóa nhưng sẽ không còn thuộc chiến dịch nào.`)) return;
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      await deleteCampaign(c.id, token);
      setSuccess('Đã xóa chiến dịch!');
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
      {/* Form column */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          {editingCampaignId ? '📝 Sửa chiến dịch' : '📁 Tạo chiến dịch tiếp thị mới'}
        </h3>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="c-title">Tên chiến dịch</label>
            <input
              id="c-title"
              type="text"
              className="form-control"
              placeholder="Ví dụ: Khai trương, Promotion Hè, Mini game..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="c-desc">Mô tả ngắn</label>
            <textarea
              id="c-desc"
              className="form-control"
              placeholder="Mục tiêu của chiến dịch..."
              style={{ minHeight: '60px' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Màu sắc nhận diện</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {PALETTE.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setColor(p.value)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: p.value,
                    border: color === p.value ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: color === p.value ? '0 0 4px rgba(255,255,255,0.4)' : 'none'
                  }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>⚠️ {error}</div>}
          {success && <div style={{ color: 'var(--success)', fontSize: '0.78rem' }}>✅ {success}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {editingCampaignId && (
              <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCancelEdit}>
                Hủy
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
              {editingCampaignId ? 'Cập nhật' : 'Tạo chiến dịch'}
            </button>
          </div>
        </form>
      </div>

      {/* Campaigns List Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>📋 Danh sách chiến dịch tiếp thị ({campaigns.length})</h3>
          <button className="btn btn-sm" onClick={fetchCampaigns} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="placeholder-card" style={{ padding: '2rem 1rem' }}>
            <p>Chưa có chiến dịch nào. Tạo chiến dịch ở bảng bên trái để quản lý bài viết tốt hơn!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {campaigns.map(c => (
              <div
                key={c.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${c.color}`,
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{c.title}</span>
                  </div>
                  {c.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{c.description}</div>}
                </div>
                
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button className="btn btn-sm" onClick={() => handleEdit(c)}>Sửa</button>
                  <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => handleDelete(c)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
