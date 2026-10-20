import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Overview', icon: '▦', end: true },
  { to: '/approval', label: 'Approval', icon: '✓' },
  { to: '/karyawan', label: 'Karyawan', icon: '👥' },
  { to: '/kalender', label: 'Kalender', icon: '▢' },
  { to: '/rekap', label: 'Rekap', icon: '⇩' },
];

function NavList() {
  return (
    <>
      <span className="nav-label">Menu</span>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{l.icon}</span>
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Arasa</h1>
            <p>HR Dashboard</p>
          </div>
        </div>
        <NavList />
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <h1>Arasa</h1>
              <p>HR Dashboard</p>
            </div>
          </div>
        </div>
        {children}
      </main>

      <nav className="bottom-tabs">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `bottom-tab ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

