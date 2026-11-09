import { isValidElement } from 'react';

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'purple',
  foot,
  badge,
  onClick,
}) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null)) {
      return <Icon size={20} strokeWidth={2.2} />;
    }
    return Icon;
  };

  return (
    <div
      className={`stat-card stat-tone-${tone} ${onClick ? 'stat-card-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stat-card-header">
        <div className={`stat-icon-wrapper ${tone}`}>
          {renderIcon()}
        </div>
        {badge && <span className={`stat-card-badge ${tone}`}>{badge}</span>}
      </div>

      <div className="stat-card-body">
        <div className="stat-val">{value}</div>
        <div className="stat-label">{label}</div>
        {foot && <div className="stat-sub-mobile">{foot}</div>}
      </div>

      {foot && (
        <div className="stat-foot">
          <span className="stat-foot-dot" />
          <span>{foot}</span>
        </div>
      )}
    </div>
  );
}
