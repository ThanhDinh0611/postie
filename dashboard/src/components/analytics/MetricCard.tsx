interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}

export default function MetricCard({ label, value, icon, color, sub }: MetricCardProps) {
  return (
    <div className="metric-card" style={{ borderLeftColor: color }}>
      <div className="metric-header">
        <span className="metric-icon">{icon}</span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
