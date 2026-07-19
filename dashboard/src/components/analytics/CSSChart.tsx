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
    return <div className="text-muted" style={{ fontSize: '0.8rem' }}>Không có dữ liệu biểu đồ.</div>;
  }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const colors = ['accent', 'success', 'info', 'danger'];

  return (
    <div className="chart-container flex-col gap-12">
      <h4 className="text-base font-semibold text-secondary">{title}</h4>
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
