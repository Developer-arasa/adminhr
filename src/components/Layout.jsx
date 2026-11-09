import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckCircle2,
  Users,
  CalendarDays,
  FileSpreadsheet,
  Sparkles,
  Bell,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { normalizeStatus, formatTanggal } from '../lib/utils';

export default function Layout({ children }) {
  const izin = useAppStore((s) => s.izin);
  const lembur = useAppStore((s) => s.lembur);

  const pendingCount =
    (izin?.filter((x) => normalizeStatus(x.status) === 'PENDING').length || 0) +
    (lembur?.filter((x) => normalizeStatus(x.status) === 'PENDING').length || 0);

  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/approval', label: 'Approval', icon: CheckCircle2, badge: pendingCount },
    { to: '/karyawan', label: 'Karyawan', icon: Users },
    { to: '/kalender', label: 'Kalender', icon: CalendarDays },
    { to: '/rekap', label: 'Rekap', icon: FileSpreadsheet },
  ];

  const todayStr = formatTanggal(new Date(), 'day-short');

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} className="brand-icon" />
          </div>
          <div className="brand-info">
            <h1 className="brand-title">Arasa</h1>
            <span className="brand-tag">HR System</span>
          </div>
        </div>

        <div className="nav-section">
          <span className="nav-label">Menu Utama</span>
          <nav className="nav-list">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon-wrap">
                    <Icon size={19} strokeWidth={2.2} />
                  </span>
                  <span className="nav-text">{l.label}</span>
                  {Boolean(l.badge && l.badge > 0) && (
                    <span className="nav-badge">{l.badge}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Widget */}
        <div className="sidebar-footer">
          <div className="sidebar-date-card">
            <div className="sidebar-date-header">
              <Clock size={14} className="sidebar-clock-icon" />
              <span>Hari ini</span>
            </div>
            <p className="sidebar-date-text">{todayStr}</p>
            {pendingCount > 0 ? (
              <div className="sidebar-alert-pill">
                <span className="alert-dot" />
                <span>{pendingCount} pengajuan butuh approval</span>
              </div>
            ) : (
              <div className="sidebar-ok-pill">
                <span>Semua beres ✨</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* Mobile Topbar */}
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="brand-title">Arasa</h1>
              <span className="brand-tag">HR Portal</span>
            </div>
          </div>
          <div className="topbar-actions">
            {pendingCount > 0 && (
              <NavLink to="/approval" className="topbar-bell-btn">
                <Bell size={18} />
                <span className="bell-badge">{pendingCount}</span>
              </NavLink>
            )}
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>

      {/* Mobile Floating Bottom Dock */}
      <nav className="bottom-tabs">
        <div className="bottom-tabs-inner">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `bottom-tab ${isActive ? 'active' : ''}`}
              >
                <div className="bottom-tab-icon-wrap">
                  <Icon size={20} strokeWidth={2.2} />
                  {Boolean(l.badge && l.badge > 0) && (
                    <span className="bottom-tab-badge">{l.badge}</span>
                  )}
                </div>
                <span className="bottom-tab-label">{l.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
