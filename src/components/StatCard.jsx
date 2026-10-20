export default function StatCard({ label, value, icon, tone = 'indigo', foot }) {
  return (
    <div className="stat-card">
      {icon && <div className={`stat-icon ${tone}`}>{icon}</div>}
      <div className="stat-label">{label}</div>
      <div className="stat-val">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

