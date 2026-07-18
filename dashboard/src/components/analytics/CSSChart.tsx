interface ChartItem {
  label: string;
  value: number;
}

interface CSSChartProps {
  title: string;
  data: ChartItem[];
  valueSuffix?: string;
}

export default function CSSChart({ title, data, valueSuffix = '%' }: CSSChartProps) {
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
