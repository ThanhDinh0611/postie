import type { PageData, CampaignData } from '@/api/types.ts';

interface HistoryFiltersProps {
  pageFilter: string;
  setPageFilter: (val: string) => void;
  campaignFilter: string;
  setCampaignFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  formatFilter: string;
  setFormatFilter: (val: string) => void;
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
  formatFilter,
  setFormatFilter,
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
    <div className="flex justify-between items-center flex-wrap gap-12" style={{ marginBottom: '1.25rem' }}>
      <div className="flex items-center gap-8">
        <h3 className="text-base font-semibold text-secondary">Danh sách bài đăng</h3>
      </div>

      <div className="flex items-center gap-8 flex-wrap">
        {/* Page Filter */}
        <select
          className="form-control form-control-sm"
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
          className="form-control form-control-sm"
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
          className="form-control form-control-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Trạng thái (Tất cả)</option>
          <option value="Published">Đã đăng</option>
          <option value="Scheduled">Lên lịch</option>
          <option value="Draft">Bản nháp</option>
          <option value="Failed">Lỗi</option>
        </select>

        {/* Format Filter */}
        <select
          className="form-control form-control-sm"
          value={formatFilter}
          onChange={e => setFormatFilter(e.target.value)}
        >
          <option value="all">Định dạng (Tất cả)</option>
          <option value="Post">Bài đăng</option>
          <option value="Reel">Reel</option>
          <option value="Video">Video</option>
        </select>

        {/* Sorting Filter */}
        <select
          className="form-control form-control-sm"
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
