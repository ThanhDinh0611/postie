import type { PageData, CampaignData } from '../../api.ts';

interface HistoryFiltersProps {
  pageFilter: string;
  setPageFilter: (val: string) => void;
  campaignFilter: string;
  setCampaignFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  pages: PageData[];
  campaigns: CampaignData[];
  loading: boolean;
  onRefresh: () => void;
  onSync: () => void;
  syncing: boolean;
}

export default function HistoryFilters({
  pageFilter,
  setPageFilter,
  campaignFilter,
  setCampaignFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  pages,
  campaigns,
  loading,
  onRefresh,
  onSync,
  syncing
}: HistoryFiltersProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Danh sách bài đăng</h3>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Page Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
          value={pageFilter}
          onChange={e => setPageFilter(e.target.value)}
        >
          <option value="all">Tất cả trang</option>
          {pages.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.is_active ? '★' : ''}
            </option>
          ))}
        </select>

        {/* Campaign Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
          value={campaignFilter}
          onChange={e => setCampaignFilter(e.target.value)}
        >
          <option value="all">Tất cả chiến dịch</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Trạng thái (Tất cả)</option>
          <option value="Published">Đã đăng</option>
          <option value="Scheduled">Lên lịch</option>
          <option value="Draft">Bản nháp</option>
          <option value="Failed">Lỗi</option>
        </select>

        {/* Sorting Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="latest">Mới nhất</option>
          <option value="engagement">Tương tác cao nhất</option>
          <option value="likes">Yêu thích nhất</option>
          <option value="comments">Bình luận nhiều nhất</option>
          <option value="shares">Chia sẻ nhiều nhất</option>
          <option value="views">Lượt xem nhiều nhất</option>
        </select>
        <button className="btn btn-sm" onClick={onRefresh} disabled={loading || syncing}>
          {loading ? '...' : 'Refresh'}
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={onSync}
          disabled={loading || syncing || pageFilter === 'all'}
          title={pageFilter === 'all' ? 'Vui lòng chọn một trang cụ thể để đồng bộ' : 'Đồng bộ trang này từ Facebook'}
        >
          {syncing ? 'Đồng bộ...' : '🔄 Đồng bộ Trang'}
        </button>
      </div>
    </div>
  );
}
